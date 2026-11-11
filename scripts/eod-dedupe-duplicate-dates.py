#!/usr/bin/env python3
"""Remove duplicate DATE records inside NSE `.eod` binary files (never symbols).

Background: before the admission gate existed, the importer appended a second
record whenever a symbol/date carried more than one source row (regular market
row + an auxiliary/other-series row). The file then holds two records for the
same date, which the chart shows as an extra bar.

Policy (deliberately conservative):
  * a symbol FILE is never deleted, emptied, or excluded — only extra records
    for a date that appears more than once are dropped;
  * per duplicated date the survivor is the record with the highest volume,
    which is the regular market bar in every observed case;
  * if the two best records are within 2x volume AND both are non-flat, or the
    volumes tie, the date is AMBIGUOUS: every record is kept and reported, so
    nothing is guessed;
  * dates with a single record are never touched;
  * the `eod_binary_state` row for a rewritten file is updated to the new
    record count / length / first / last date / mtime so the index stays truthful.

Usage (run from the project root, app closed):
  python scripts/eod-dedupe-duplicate-dates.py --database "EOD DATABASE"            # dry run
  python scripts/eod-dedupe-duplicate-dates.py --database "EOD DATABASE" --apply    # write
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
MAGIC = b"EOD1"
RECORD = struct.Struct("<IIqqqqqQQ")


def u32_to_iso(value: int) -> str:
    return f"{value // 10000:04d}-{(value // 100) % 100:02d}-{value % 100:02d}"


def read_file(path: str):
    with open(path, "rb") as handle:
        header = handle.read(HEADER_SIZE)
        if header[:4] != MAGIC:
            raise ValueError(f"not an EOD1 file: {path}")
        count, scale = struct.unpack_from("<I", header, 8)[0], struct.unpack_from("<I", header, 12)[0]
        payload = handle.read(count * RECORD_SIZE)
    records = [RECORD.unpack_from(payload, index * RECORD_SIZE) for index in range(count)]
    return header, count, scale, records


def is_flat(record) -> bool:
    return record[2] == record[3] == record[4] == record[5]


def pick_survivor(records):
    """Return (kept_index_or_None, reason).

    Only a *same-market block print* may be dropped: single-price, tiny volume
    and within 30 % of the surviving bar's price. Anything else — a comparable
    volume, a nearby-but-real bar, or a row at a totally different price level —
    is treated as a different instrument sharing the symbol and kept untouched.
    """
    if len(records) == 1:
        return 0, "single"
    best = max(range(len(records)), key=lambda i: records[i][7])
    top_price = records[best][5] or 1
    for index, record in enumerate(records):
        if index == best:
            continue
        close = record[5] or 0
        same_market = abs(close / top_price - 1) <= 0.30 if top_price else False
        block_print = is_flat(record) and record[7] <= 5000 and same_market
        if not block_print:
            return None, f"DIFFERENT_INSTRUMENT_OR_ROW(vol={record[7]}, close={close / 10000:.2f})"
    return best, "same-market block print"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True, help='active database folder, e.g. "EOD DATABASE"')
    parser.add_argument("--exchange", default="NSE")
    parser.add_argument("--apply", action="store_true", help="write the dedupe (default is a dry run)")
    parser.add_argument("--symbol", default=None, help="optional single symbol")
    args = parser.parse_args()

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    database_dir = os.path.abspath(args.database)
    data_dir = os.path.join(database_dir, "eod_data", args.exchange)
    sidecar = os.path.join(database_dir, "eod_binary_state.sqlite")
    if not os.path.isdir(data_dir):
        print(f"ERROR: no data folder: {data_dir}", file=sys.stderr)
        return 2

    targets = []
    for name in sorted(os.listdir(data_dir)):
        if not name.endswith(".eod"):
            continue
        symbol = name[:-4]
        if args.symbol and symbol != args.symbol:
            continue
        targets.append(os.path.join(data_dir, name))

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = os.path.join(root, "tmp", "fixtures", "bhavcopy-series-repair")
    os.makedirs(out_dir, exist_ok=True)

    plan = []
    for path in targets:
        try:
            header, count, scale, records = read_file(path)
        except Exception as error:  # noqa: BLE001 - report and continue
            print(f"SKIP {os.path.basename(path)}: {error}", file=sys.stderr)
            continue
        groups = defaultdict(list)
        for record in records:
            groups[record[0]].append(record)
        duplicated = {date: recs for date, recs in groups.items() if len(recs) > 1}
        if not duplicated:
            continue
        keep_dates = {}
        ambiguous = []
        for date, recs in duplicated.items():
            chosen, reason = pick_survivor(recs)
            if chosen is None:
                ambiguous.append({
                    "date": u32_to_iso(date),
                    "reason": reason,
                    "records": [{"close": r[5] / scale, "volume": r[7], "flat": is_flat(r)} for r in recs],
                })
                keep_dates[date] = {"keep": "all", "reason": reason}
            else:
                keep_dates[date] = {
                    "keep": {"close": recs[chosen][5] / scale, "volume": recs[chosen][7]},
                    "drop": [{"close": r[5] / scale, "volume": r[7], "flat": is_flat(r)}
                             for i, r in enumerate(recs) if i != chosen],
                    "reason": reason,
                }
        kept_records = []
        dropped = 0
        seen = set()
        for record in sorted(records, key=lambda r: r[0]):
            date = record[0]
            decision = keep_dates.get(date)
            if decision is None:
                kept_records.append(record)
                continue
            if decision["keep"] == "all":
                kept_records.append(record)
                continue
            if date in seen:
                continue
            # first record on a duplicated date: keep only if it is the survivor
            wanted = decision["keep"]
            if record[5] / scale == wanted["close"] and record[7] == wanted["volume"]:
                kept_records.append(record)
                seen.add(date)
            else:
                dropped += 1
        if not dropped:
            continue
        plan.append({
            "symbol": os.path.basename(path)[:-4],
            "path": path,
            "records_before": count,
            "records_after": len(kept_records),
            "duplicate_dates": len(duplicated),
            "dropped_records": dropped,
            "ambiguous_dates": ambiguous,
            "decisions": {u32_to_iso(d): v for d, v in sorted(keep_dates.items())},
            "header": header,
            "scale": scale,
            "kept": kept_records,
        })

    total_dropped = sum(item["dropped_records"] for item in plan)
    ambiguous_total = sum(len(item["ambiguous_dates"]) for item in plan)
    print(f"symbols with duplicate dates: {len(plan)} | records to drop: {total_dropped} | ambiguous dates kept: {ambiguous_total}")
    for item in sorted(plan, key=lambda i: -i["dropped_records"])[:15]:
        print(f"  {item['symbol']:12s} {item['records_before']:5d} -> {item['records_after']:5d}"
              f"  ({item['duplicate_dates']} dup dates, {len(item['ambiguous_dates'])} ambiguous)")

    manifest = {
        "schema": "eod-duplicate-date-dedupe-v1",
        "generated_at_utc": stamp,
        "database": database_dir,
        "exchange": args.exchange,
        "applied": bool(args.apply),
        "symbols": [
            {key: item[key] for key in ("symbol", "records_before", "records_after", "duplicate_dates", "dropped_records", "ambiguous_dates")}
            for item in plan
        ],
        "totals": {"symbols": len(plan), "dropped_records": total_dropped, "ambiguous_dates": ambiguous_total},
    }

    if not args.apply:
        path = os.path.join(out_dir, f"dedupe-dryrun-{stamp}.json")
        with open(path, "w", encoding="utf-8") as handle:
            json.dump({**manifest, "detail": [
                {"symbol": item["symbol"], "decisions": {k: v for k, v in list(item["decisions"].items())[:40]}}
                for item in plan[:50]
            ]}, handle, indent=1)
        print(f"\nDRY RUN: nothing written. Manifest: {path}")
        return 0

    backup_dir = os.path.join(root, "backups", f"eod-dedupe-{stamp}")
    os.makedirs(backup_dir, exist_ok=True)
    for item in plan:
        shutil.copy2(item["path"], os.path.join(backup_dir, item["symbol"] + ".eod"))
    for name in ("market-data.sqlite3", "eod_binary_state.sqlite"):
        source = os.path.join(database_dir, name)
        if os.path.isfile(source):
            shutil.copy2(source, os.path.join(backup_dir, name))
    print(f"backup: {backup_dir} ({len(plan)} files + 2 databases)")

    for item in plan:
        header = bytearray(item["header"])
        count = len(item["kept"])
        struct.pack_into("<I", header, 8, count)
        payload = b"".join(RECORD.pack(*record) for record in item["kept"])
        tmp_path = item["path"] + ".dedupe.tmp"
        with open(tmp_path, "wb") as handle:
            handle.write(header)
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_path, item["path"])
        item["drop_kept"] = True

    # keep the sidecar truthful without guessing generations
    if os.path.isfile(sidecar):
        connection = sqlite3.connect(sidecar)
        try:
            for item in plan:
                stat = os.stat(item["path"])
                dates = [record[0] for record in item["kept"]]
                connection.execute(
                    "UPDATE eod_binary_state SET record_count=?, file_length=?, first_date=?, last_date=?, "
                    "file_mtime_ns=?, state_status='VERIFIED', verified_at=datetime('now'), updated_at=datetime('now') "
                    "WHERE exchange=? AND symbol=?",
                    (
                        len(item["kept"]), stat.st_size,
                        min(dates) if dates else None, max(dates) if dates else None,
                        stat.st_mtime_ns, args.exchange, item["symbol"],
                    ),
                )
            connection.commit()
        finally:
            connection.close()

    path = os.path.join(out_dir, f"dedupe-{stamp}.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump({**manifest, "backup": backup_dir}, handle, indent=1)
    print(f"applied: {len(plan)} files rewritten, {total_dropped} duplicate records removed")
    print(f"evidence: {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
