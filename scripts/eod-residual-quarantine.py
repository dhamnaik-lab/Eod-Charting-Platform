#!/usr/bin/env python3
"""P4 — quarantine "foreign" residual bars (archive, never delete).

Scope: the pairs the residual review triaged as `foreign_bar_candidate` — stored
bars on dates where NSE published no regular-equity row and no government/fund
row for that symbol (e.g. IRFC's 2012-2020 debenture bars under an equity symbol
that only listed in 2021).

Action (dry run by default, `--apply` to execute):
  1. read the review manifest and take only `triage == "foreign_bar_candidate"`;
  2. archive every affected record in full into
     `EOD DATABASE/bhavcopy_multisecurity_quarantine/<exchange>/<SYMBOL>.json`
     (merged with any earlier archive, never overwritten);
  3. remove exactly those records from the symbol binary, keeping every other
     date untouched (including other residual verdicts);
  4. back up the affected files + both databases first, then update the index row.

Nothing else is touched: no symbol, no file, no `keep_*` residual pair, and the
rows that stay remain readable in the archive.

Usage:
  python scripts/eod-residual-quarantine.py --database "EOD DATABASE" \
      --manifest tmp/fixtures/bhavcopy-series-repair/residual-review-p3b-chunk4.json
  ... --apply
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sqlite3
import struct
import sys
from collections import defaultdict
from datetime import datetime, timezone

HEADER_SIZE = 128
RECORD_SIZE = 64
RECORD = struct.Struct("<IIqqqqqQQ")
TRIAGE = "foreign_bar_candidate"


def iso(value: int) -> str:
    return f"{value // 10000:04d}-{(value // 100) % 100:02d}-{value % 100:02d}"


def date_key(value: str) -> int:
    return int(value.replace("-", ""))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True)
    parser.add_argument("--exchange", default="NSE")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    database_dir = os.path.abspath(args.database)
    data_dir = os.path.join(database_dir, "eod_data", args.exchange)
    sidecar = os.path.join(database_dir, "eod_binary_state.sqlite")
    archive_dir = os.path.join(database_dir, "bhavcopy_multisecurity_quarantine", args.exchange)

    with open(args.manifest, "r", encoding="utf-8") as handle:
        manifest = json.load(handle)
    targets: dict[str, set[int]] = defaultdict(set)
    for pair in manifest.get("pairs", []):
        if pair.get("verdict") == "delete_candidate" and pair.get("triage") == TRIAGE:
            targets[pair["symbol"]].add(date_key(pair["date"]))
    if not targets:
        print("Nothing triaged as foreign_bar_candidate.")
        return 0

    plans = []
    for symbol, dates in sorted(targets.items()):
        path = os.path.join(data_dir, symbol + ".eod")
        if not os.path.isfile(path):
            print(f"SKIP {symbol}: no binary file", file=sys.stderr)
            continue
        with open(path, "rb") as handle:
            header = handle.read(HEADER_SIZE)
            if header[:4] != b"EOD1":
                print(f"SKIP {symbol}: not an EOD1 file", file=sys.stderr)
                continue
            count = struct.unpack_from("<I", header, 8)[0]
            scale = struct.unpack_from("<I", header, 12)[0] or 10000
            payload = handle.read(count * RECORD_SIZE)
        keep, archive = [], []
        for index in range(count):
            record = RECORD.unpack_from(payload, index * RECORD_SIZE)
            (archive if record[0] in dates else keep).append(record)
        if not archive:
            continue
        plans.append({
            "symbol": symbol, "path": path, "header": header, "scale": scale,
            "records_before": count, "keep": keep, "archive": archive,
            "requested_dates": len(dates),
            "matched_dates": len({record[0] for record in archive}),
        })

    total = sum(len(plan["archive"]) for plan in plans)
    print(f"symbols: {len(plans)} | records to quarantine: {total}")
    for plan in sorted(plans, key=lambda p: -len(p["archive"])):
        missing = plan["requested_dates"] - plan["matched_dates"]
        print(f"  {plan['symbol']:14s} {plan['records_before']:5d} -> {len(plan['keep']):5d}"
              f"  (quarantine {len(plan['archive'])}, unmatched dates {missing})")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    summary = {
        "schema": "eod-residual-quarantine-v1",
        "generated_at_utc": stamp,
        "database": database_dir,
        "manifest": os.path.abspath(args.manifest),
        "triage": TRIAGE,
        "applied": bool(args.apply),
        "symbols": [
            {"symbol": plan["symbol"], "records_before": plan["records_before"],
             "records_after": len(plan["keep"]), "quarantined": len(plan["archive"])}
            for plan in plans
        ],
        "totals": {"symbols": len(plans), "quarantined_records": total},
    }

    out_dir = os.path.join(root, "tmp", "fixtures", "bhavcopy-series-repair")
    os.makedirs(out_dir, exist_ok=True)
    if not args.apply:
        path = os.path.join(out_dir, f"residual-quarantine-dryrun-{stamp}.json")
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(summary, handle, indent=1)
        print(f"\nDRY RUN: nothing written. Manifest: {path}")
        return 0

    backup_dir = os.path.join(root, "backups", f"eod-residual-quarantine-{stamp}")
    os.makedirs(backup_dir, exist_ok=True)
    for plan in plans:
        shutil.copy2(plan["path"], os.path.join(backup_dir, plan["symbol"] + ".eod"))
    for name in ("market-data.sqlite3", "eod_binary_state.sqlite"):
        source = os.path.join(database_dir, name)
        if os.path.isfile(source):
            shutil.copy2(source, os.path.join(backup_dir, name))
    print(f"backup: {backup_dir}")

    os.makedirs(archive_dir, exist_ok=True)
    for plan in plans:
        archive_path = os.path.join(archive_dir, plan["symbol"] + ".json")
        existing = []
        if os.path.isfile(archive_path):
            try:
                with open(archive_path, "r", encoding="utf-8") as handle:
                    existing = json.load(handle).get("records", [])
            except (OSError, json.JSONDecodeError):
                existing = []
        seen = {(r["date"], r["close"], r["volume"]) for r in existing}
        merged = list(existing)
        for record in plan["archive"]:
            entry = {
                "date": iso(record[0]),
                "open": record[2] / plan["scale"], "high": record[3] / plan["scale"],
                "low": record[4] / plan["scale"], "close": record[5] / plan["scale"],
                "prev_close": record[6] / plan["scale"],
                "volume": record[7], "oi": record[8], "flags": record[1],
            }
            key = (entry["date"], entry["close"], entry["volume"])
            if key in seen:
                continue
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
        struct.pack_into("<I", header, 8, len(plan["keep"]))
        tmp_path = plan["path"] + ".residual.tmp"
        with open(tmp_path, "wb") as handle:
            handle.write(header)
            for record in plan["keep"]:
                handle.write(RECORD.pack(*record))
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_path, plan["path"])

    if os.path.isfile(sidecar):
        connection = sqlite3.connect(sidecar)
        try:
            for plan in plans:
                stat = os.stat(plan["path"])
                dates = [record[0] for record in plan["keep"]]
                connection.execute(
                    "UPDATE eod_binary_state SET record_count=?, file_length=?, first_date=?, last_date=?, "
                    "file_mtime_ns=?, state_status='VERIFIED', verified_at=datetime('now'), updated_at=datetime('now') "
                    "WHERE exchange=? AND symbol=?",
                    (len(plan["keep"]), stat.st_size, min(dates) if dates else None,
                     max(dates) if dates else None, stat.st_mtime_ns, args.exchange, plan["symbol"]),
                )
            connection.commit()
        finally:
            connection.close()

    path = os.path.join(out_dir, f"residual-quarantine-{stamp}.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump({**summary, "backup": backup_dir, "archive": archive_dir}, handle, indent=1)
    print(f"applied: {len(plans)} files rewritten | {total} records quarantined")
    print(f"evidence: {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
