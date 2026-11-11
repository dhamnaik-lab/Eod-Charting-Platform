#!/usr/bin/env python3
"""Multi-security rows inside one NSE `.eod` file — quarantine (never delete).

Some legacy NSE files hold several *different securities* under one symbol: a
regular equity bar plus bond/other-series rows for the same date (e.g. `ICICI`
1996-10-01 carries the ₹72 equity bar and ₹4,750/5,010/5,400 rows at 1–2 units).
The admission gate no longer writes such rows, but they are already on disk and
they render as spikes.

Action (dry run by default, `--apply` to execute):

  1. keep one record per date — within ±2 % of the symbol's continuous level the
     highest-volume record wins, otherwise the record closest to the median of
     the surrounding single-record dates;
  2. QUARANTINE (not delete) every other record, in full, into
     `EOD DATABASE/bhavcopy_multisecurity_quarantine/<exchange>/<SYMBOL>.json`;
  3. rewrite the `.eod` with the kept records and update its index row;
  4. dates with no continuous-neighbour evidence are left exactly as they are;
  5. no symbol, file, or delisted name is ever removed.

Usage:
  python scripts/eod-multisecurity-manifest.py --database "EOD DATABASE"            # dry run
  python scripts/eod-multisecurity-manifest.py --database "EOD DATABASE" --apply    # write
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sqlite3
import statistics
import struct
import sys
from collections import defaultdict
from datetime import datetime, timezone

HEADER_SIZE = 128
RECORD_SIZE = 64
RECORD = struct.Struct("<IIqqqqqQQ")


def iso(value: int) -> str:
    return f"{value // 10000:04d}-{(value // 100) % 100:02d}-{value % 100:02d}"


def read_file(path: str):
    with open(path, "rb") as handle:
        header = handle.read(HEADER_SIZE)
        if header[:4] != b"EOD1":
            return None
        count = struct.unpack_from("<I", header, 8)[0]
        scale = struct.unpack_from("<I", header, 12)[0] or 10000
        payload = handle.read(count * RECORD_SIZE)
    records = [RECORD.unpack_from(payload, index * RECORD_SIZE) for index in range(count)]
    return header, count, scale, records


def build_plan(path: str, fallback: bool = False):
    loaded = read_file(path)
    if loaded is None:
        return None
    header, count, scale, records = loaded
    by_date = defaultdict(list)
    for record in records:
        by_date[record[0]].append(record)
    multi = {date: recs for date, recs in by_date.items() if len(recs) > 1}
    if not multi:
        return None
    dates = sorted(by_date)
    single_close = {date: recs[0][5] for date, recs in by_date.items() if len(recs) == 1}
    decisions = {}
    for date, recs in multi.items():
        position = dates.index(date)
        neighbours = []
        for offset in range(1, 11):
            for candidate in (position - offset, position + offset):
                if 0 <= candidate < len(dates):
                    close = single_close.get(dates[candidate])
                    if close:
                        neighbours.append(close)
            if len(neighbours) >= 6:
                break
        if len(neighbours) < 3:
            # Fallback for files where almost every date is multi-record: the
            # traded daily bar is the dominant volume. Only accept it when it is
            # at least 10x the next record, so comparable multi-instrument dates
            # stay untouched and reported.
            if not fallback:
                continue
            by_volume = sorted(recs, key=lambda r: -r[7])
            if len(by_volume) >= 2 and by_volume[0][7] >= max(1, by_volume[1][7] * 10):
                decisions[date] = {
                    "keep": by_volume[0],
                    "quarantine": by_volume[1:],
                    "median": 0,
                    "source": "max_volume",
                }
            continue
        median = statistics.median(neighbours)
        near = [i for i, rec in enumerate(recs) if median and abs(rec[5] / median - 1) <= 0.02]
        pool = near if near else list(range(len(recs)))
        keep = max(pool, key=lambda i: recs[i][7]) if near else min(pool, key=lambda i: abs(recs[i][5] - median))
        decisions[date] = {
            "keep": recs[keep],
            "quarantine": [rec for i, rec in enumerate(recs) if i != keep],
            "median": median,
            "source": "neighbour_median",
        }
    if not decisions:
        return None
    kept = []
    for date in dates:
        if date in decisions:
            kept.append(decisions[date]["keep"])
        else:
            kept.extend(by_date[date])
    return {
        "header": header,
        "scale": scale,
        "records_before": count,
        "records": kept,
        "multi_dates": len(multi),
        "resolved_dates": len(decisions),
        "quarantined": sum(len(v["quarantine"]) for v in decisions.values()),
        "by_neighbour": sum(1 for v in decisions.values() if v.get("source") == "neighbour_median"),
        "by_fallback": sum(1 for v in decisions.values() if v.get("source") == "max_volume"),
        "decisions": decisions,
    }


def describe(record, scale):
    return {
        "date": iso(record[0]),
        "open": record[2] / scale, "high": record[3] / scale, "low": record[4] / scale,
        "close": record[5] / scale, "prev_close": record[6] / scale,
        "volume": record[7], "oi": record[8], "flags": record[1],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True)
    parser.add_argument("--exchange", default="NSE")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--fallback", action="store_true",
                        help="use the 10x-max-volume rule for dates without neighbour evidence")
    parser.add_argument("--symbol", action="append", default=None,
                        help="limit to these symbols (repeatable; pilot mode)")
    args = parser.parse_args()

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    database_dir = os.path.abspath(args.database)
    data_dir = os.path.join(database_dir, "eod_data", args.exchange)
    sidecar = os.path.join(database_dir, "eod_binary_state.sqlite")
    archive_dir = os.path.join(database_dir, "bhavcopy_multisecurity_quarantine", args.exchange)
    out_dir = os.path.join(root, "tmp", "fixtures", "bhavcopy-series-repair")
    os.makedirs(out_dir, exist_ok=True)

    plans = []
    for name in sorted(os.listdir(data_dir)):
        if not name.endswith(".eod"):
            continue
        symbol = name[:-4]
        if args.symbol and symbol not in args.symbol:
            continue
        plan = build_plan(os.path.join(data_dir, name), fallback=args.fallback)
        if plan:
            plan["symbol"] = symbol
            plan["path"] = os.path.join(data_dir, name)
            plans.append(plan)

    total_q = sum(p["quarantined"] for p in plans)
    total_dates = sum(p["resolved_dates"] for p in plans)
    left = sum(p["multi_dates"] - p["resolved_dates"] for p in plans)
    by_nb = sum(p["by_neighbour"] for p in plans)
    by_fb = sum(p["by_fallback"] for p in plans)
    print(f"symbols: {len(plans)} | resolvable dates: {total_dates} (neighbour {by_nb}, max-volume {by_fb})"
          f" | records to quarantine: {total_q} | multi-dates left untouched: {left}")
    for plan in sorted(plans, key=lambda p: -p["quarantined"])[:10]:
        print(f"  {plan['symbol']:12s} {plan['records_before']:5d} -> {len(plan['records']):5d}"
              f"  (quarantine {plan['quarantined']}, unresolved {plan['multi_dates'] - plan['resolved_dates']})")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    manifest = {
        "schema": "eod-multisecurity-quarantine-v1",
        "generated_at_utc": stamp,
        "database": database_dir,
        "exchange": args.exchange,
        "applied": bool(args.apply),
        "policy": "quarantine archival — no record, symbol, file or delisted name is deleted",
        "totals": {
            "symbols": len(plans),
            "resolvable_dates": total_dates,
            "quarantined_records": total_q,
            "unresolved_multi_dates": left,
        },
        "symbols": [
            {
                "symbol": plan["symbol"],
                "records_before": plan["records_before"],
                "records_after": len(plan["records"]),
                "resolvable_dates": plan["resolved_dates"],
                "quarantined_records": plan["quarantined"],
                "unresolved_multi_dates": plan["multi_dates"] - plan["resolved_dates"],
            }
            for plan in plans
        ],
    }

    if not args.apply:
        path = os.path.join(out_dir, f"multisecurity-dryrun-{stamp}.json")
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(manifest, handle, indent=1)
        print(f"\nDRY RUN: nothing written. Manifest: {path}")
        return 0

    if not plans:
        print("Nothing to apply.")
        return 0

    backup_dir = os.path.join(root, "backups", f"eod-multisecurity-{stamp}")
    os.makedirs(backup_dir, exist_ok=True)
    for plan in plans:
        shutil.copy2(plan["path"], os.path.join(backup_dir, plan["symbol"] + ".eod"))
    for name in ("market-data.sqlite3", "eod_binary_state.sqlite"):
        source = os.path.join(database_dir, name)
        if os.path.isfile(source):
            shutil.copy2(source, os.path.join(backup_dir, name))
    print(f"backup: {backup_dir} ({len(plans)} files + 2 databases)")

    os.makedirs(archive_dir, exist_ok=True)
    for plan in plans:
        archived = [describe(record, plan["scale"]) for decision in plan["decisions"].values()
                    for record in decision["quarantine"]]
        # Merge, never overwrite: a second pass over the same symbol must not
        # lose the rows archived by the first pass.
        archive_path = os.path.join(archive_dir, plan["symbol"] + ".json")
        existing = []
        if os.path.isfile(archive_path):
            try:
                with open(archive_path, "r", encoding="utf-8") as handle:
                    existing = json.load(handle).get("records", [])
            except (OSError, json.JSONDecodeError):
                existing = []
        seen = {(r["date"], r["open"], r["high"], r["low"], r["close"], r["prev_close"], r["volume"], r["oi"])
                for r in existing}
        merged = list(existing)
        for entry in archived:
            key = (entry["date"], entry["open"], entry["high"], entry["low"], entry["close"],
                   entry["prev_close"], entry["volume"], entry["oi"])
            if key not in seen:
                seen.add(key)
                merged.append(entry)
        with open(archive_path, "w", encoding="utf-8") as handle:
            json.dump({
                "schema": "eod-multisecurity-archive-v1",
                "exchange": args.exchange,
                "symbol": plan["symbol"],
                "quarantined_at_utc": stamp,
                "note": "Rows removed from the symbol's binary file because they belong to a different security that shared the same symbol/date. Retained here in full; no data deleted.",
                "records": merged,
            }, handle, indent=1)

        header = bytearray(plan["header"])
        struct.pack_into("<I", header, 8, len(plan["records"]))
        tmp_path = plan["path"] + ".quarantine.tmp"
        with open(tmp_path, "wb") as handle:
            handle.write(header)
            for record in plan["records"]:
                handle.write(RECORD.pack(*record))
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_path, plan["path"])

    if os.path.isfile(sidecar):
        connection = sqlite3.connect(sidecar)
        try:
            for plan in plans:
                stat = os.stat(plan["path"])
                dates = [record[0] for record in plan["records"]]
                connection.execute(
                    "UPDATE eod_binary_state SET record_count=?, file_length=?, first_date=?, last_date=?, "
                    "file_mtime_ns=?, state_status='VERIFIED', verified_at=datetime('now'), updated_at=datetime('now') "
                    "WHERE exchange=? AND symbol=?",
                    (len(plan["records"]), stat.st_size, min(dates) if dates else None,
                     max(dates) if dates else None, stat.st_mtime_ns, args.exchange, plan["symbol"]),
                )
            connection.commit()
        finally:
            connection.close()

    path = os.path.join(out_dir, f"multisecurity-{stamp}.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump({**manifest, "backup": backup_dir, "archive": archive_dir}, handle, indent=1)
    print(f"applied: {len(plans)} files rewritten | {total_q} records quarantined to {archive_dir}")
    print(f"evidence: {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
