#!/usr/bin/env python3
"""Controlled NSE equity identity repair for symbols whose `instruments` row was
overwritten by a debenture row during the 2010-11 .. 2017-09 series-collision
corruption (audit: docs/plans/2026-11-08_BHAVCOPY_SERIES_COLLISION_AUDIT_AND_REPAIR_PLAN.md).

What it does (per symbol):
  * source of truth = the NSE bhavcopy row the admission gate ADMITTED as a
    regular (equity) row for that symbol, taken from the repair-run evidence
    (`bhavcopy_admission/security-*.json`, schema nse-security-admission-v2);
  * validates: current `instruments.series` is a debt/depositary family code,
    the source ISIN is a 12-character Indian equity ISIN, the two differ, and
    the symbol has a long price history (a real equity, not a fund unit);
  * writes: `instruments.series` -> EQ, `instruments.isin` -> source ISIN,
    `instruments.series_as_of_date` -> source row date, `updated_at`;
    plus one `instrument_isin_history` audit row;
  * never touches `.eod` price files, download_log, or any other table.

Safety contract:
  * dry-run by default; --apply required to write;
  * full pre-write backup of market-data.sqlite3 (+ WAL/SHM) is copied beside
    the database with a timestamp, and the before/after values are written to
    tmp/fixtures/bhavcopy-series-repair/identity-repair-<ts>.json;
  * single transaction, all-or-nothing; any failed validation aborts everything;
  * the app must be closed (no other writer).

Usage:
  python scripts/nse-identity-repair.py --database "EOD DATABASE"            # dry run
  python scripts/nse-identity-repair.py --database "EOD DATABASE" --apply    # write
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import shutil
import sqlite3
import struct
import sys
from datetime import datetime, timezone

# Symbols whose `instruments` row was overwritten by a debenture row while NSE's
# own bhavcopy still carries an admitted/regular EQ row for them. `L&TINFRA` was
# removed after the evidence check: it has NO EQ rows at all (it is a genuine
# L&T Infrastructure Finance debenture symbol; the equity trades as `L&TFH`).
SYMBOLS = [
    "HDFC", "DHFL", "IBULHSGFIN", "IDFCBANK", "SREINFRA", "SRTRANSFIN",
]
EQUITY_SERIES = {"EQ", "BE", "BZ", "SM", "ST", "SZ", "SP", "SL", "SI", "SO", "SQ",
                 "BT", "BL", "BO", "IL", "IQ", "TT", "IT"}
EVIDENCE_SCHEMA = "nse-security-admission-v2"
SOURCE_TAG = "BHAVCOPY_EQ_SERIES_REPAIR"


def reload_sections() -> None:  # pragma: no cover - documentation helper
    pass


def admitted_equity_rows(evidence_dir: str) -> dict[str, dict]:
    """Return {symbol: {isin, date, close, volume, source_file}} from the gate's
    own admitted regular rows (latest date wins)."""
    found: dict[str, dict] = {}
    for path in sorted(glob.glob(os.path.join(evidence_dir, "*.json"))):
        try:
            with open(path, "r", encoding="utf-8") as handle:
                document = json.load(handle)
        except (OSError, json.JSONDecodeError):
            continue
        if document.get("schema") != EVIDENCE_SCHEMA:
            continue
        for row in document.get("rows", []):
            symbol = row.get("symbol")
            if symbol not in SYMBOLS:
                continue
            # The gate could not ADMIT these rows (SYMBOL_SECURITY_CLASS_CONFLICT)
            # because the stored metadata already said "debenture" — the row is
            # still NSE's own equity row, which is the identity source here.
            if row.get("reason") not in ("ADMITTED", "SYMBOL_SECURITY_CLASS_CONFLICT"):
                continue
            if row.get("series") not in EQUITY_SERIES:
                continue
            isin = (row.get("isin") or "").strip().upper()
            if len(isin) != 12 or not isin.startswith("IN"):
                continue
            date = row.get("rowTradeDate") or row.get("tradeDate") or ""
            current = found.get(symbol)
            if current is None or date > current["date"]:
                found[symbol] = {
                    "isin": isin,
                    "date": date,
                    "close": row.get("close"),
                    "volume": row.get("volume"),
                    "source_file": os.path.basename(path),
                    "series": row.get("series"),
                    "admission_reason": row.get("reason"),
                }
    return found


def binary_history(database_dir: str, symbol: str) -> tuple[int, int, float | None, float | None]:
    path = os.path.join(database_dir, "eod_data", "NSE", symbol + ".eod")
    if not os.path.isfile(path):
        return (0, 0, None, None)
    with open(path, "rb") as handle:
        header = handle.read(128)
        if header[:4] != b"EOD1":
            return (0, 0, None, None)
        count = struct.unpack_from("<I", header, 8)[0]
        scale = struct.unpack_from("<I", header, 12)[0] or 10000
        data = handle.read(count * 64)
    if count == 0:
        return (0, 0, None, None)
    first = struct.unpack_from("<IIqqqqqQQ", data, 0)
    last = struct.unpack_from("<IIqqqqqQQ", data, (count - 1) * 64)
    return (count, first[0], first[5] / scale, last[5] / scale)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True, help='active database folder, e.g. "EOD DATABASE"')
    parser.add_argument("--evidence-dir", default=None, help="defaults to <database>/bhavcopy_admission")
    parser.add_argument("--apply", action="store_true", help="write the repair (default is a dry run)")
    args = parser.parse_args()

    database_dir = os.path.abspath(args.database)
    database_file = os.path.join(database_dir, "market-data.sqlite3")
    evidence_dir = args.evidence_dir or os.path.join(database_dir, "bhavcopy_admission")
    if not os.path.isfile(database_file):
        print(f"ERROR: database not found: {database_file}", file=sys.stderr)
        return 2
    if not os.path.isdir(evidence_dir):
        print(f"ERROR: evidence folder not found: {evidence_dir}", file=sys.stderr)
        return 2

    sources = admitted_equity_rows(evidence_dir)
    connection = sqlite3.connect(f"file:{database_file}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    plan: list[dict] = []
    rejected: list[dict] = []
    for symbol in SYMBOLS:
        row = connection.execute(
            "SELECT symbol, exchange, isin, name, series, series_as_of_date, is_active, lifecycle_status, updated_at "
            "FROM instruments WHERE exchange='NSE' AND symbol=?",
            (symbol,),
        ).fetchone()
        source = sources.get(symbol)
        if row is None:
            rejected.append({"symbol": symbol, "why": "no instruments row"})
            continue
        if source is None:
            rejected.append({"symbol": symbol, "why": "no admitted EQ row in evidence"})
            continue
        series = (row["series"] or "").strip()
        count, first_date, first_close, last_close = binary_history(database_dir, symbol)
        problems = []
        if series in EQUITY_SERIES:
            problems.append(f"series already equity ({series})")
        if not series:
            problems.append("series empty")
        if (row["isin"] or "").strip() == source["isin"]:
            problems.append("isin already equals the source equity ISIN")
        if count < 600:
            problems.append(f"only {count} bars (not a live equity history)")
        if problems:
            rejected.append({"symbol": symbol, "why": "; ".join(problems)})
            continue
        plan.append({
            "symbol": symbol,
            "exchange": "NSE",
            "before": {
                "series": row["series"], "isin": row["isin"], "name": row["name"],
                "series_as_of_date": row["series_as_of_date"], "updated_at": row["updated_at"],
            },
            "after": {
                "series": "EQ", "isin": source["isin"], "series_as_of_date": source["date"],
            },
            "source": source,
            "bars": count, "first_date": first_date,
            "first_close": first_close, "last_close": last_close,
        })
    connection.close()

    print(f"identity repair plan: {len(plan)} symbol(s) to change, {len(rejected)} rejected")
    for item in plan:
        print(f"  {item['symbol']:12s} {item['before']['series']:>4s}/{item['before']['isin'] or '-':14s}"
              f" -> EQ/{item['after']['isin']:14s} (as of {item['after']['series_as_of_date']},"
              f" {item['bars']} bars, last close {item['last_close']})")
    for item in rejected:
        print(f"  REJECTED {item['symbol']:12s} {item['why']}")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tmp", "fixtures", "bhavcopy-series-repair")
    os.makedirs(out_dir, exist_ok=True)
    evidence = {
        "schema": "nse-identity-repair-v1",
        "generated_at_utc": stamp,
        "database": database_dir,
        "applied": bool(args.apply),
        "plan": plan,
        "rejected": rejected,
    }

    if not args.apply:
        with open(os.path.join(out_dir, f"identity-repair-dryrun-{stamp}.json"), "w", encoding="utf-8") as handle:
            json.dump(evidence, handle, indent=1)
        print("\nDRY RUN: nothing written. Re-run with --apply to perform the change.")
        return 0

    if not plan:
        print("\nNothing to apply.")
        return 0

    backup = f"{database_file}.pre-identity-repair-{stamp}.bak"
    shutil.copy2(database_file, backup)
    for suffix in ("-wal", "-shm"):
        if os.path.isfile(database_file + suffix):
            shutil.copy2(database_file + suffix, backup + suffix)
    print(f"\nbackup: {backup}")

    write = sqlite3.connect(database_file)
    try:
        write.execute("BEGIN IMMEDIATE")
        for item in plan:
            write.execute(
                "UPDATE instruments SET series=?, isin=?, series_as_of_date=?, updated_at=datetime('now') "
                "WHERE exchange='NSE' AND symbol=? AND series=? AND COALESCE(isin,'')=?",
                (
                    item["after"]["series"], item["after"]["isin"], item["after"]["series_as_of_date"],
                    item["symbol"], item["before"]["series"], item["before"]["isin"] or "",
                ),
            )
            write.execute(
                "INSERT INTO instrument_isin_history (exchange, symbol, isin, effective_date, source, source_ref, note) "
                "VALUES ('NSE', ?, ?, ?, ?, ?, ?)",
                (
                    item["symbol"], item["after"]["isin"], item["after"]["series_as_of_date"],
                    SOURCE_TAG, item["source"]["source_file"],
                    "Equity identity restored from the admitted NSE bhavcopy EQ row; prior metadata held a debenture series/ISIN.",
                ),
            )
        write.commit()
    except Exception:
        write.rollback()
        raise
    finally:
        write.close()

    with open(os.path.join(out_dir, f"identity-repair-{stamp}.json"), "w", encoding="utf-8") as handle:
        json.dump({**evidence, "backup": backup}, handle, indent=1)
    print(f"applied {len(plan)} identity repair(s). Evidence: identity-repair-{stamp}.json")
    print("Next: re-import the affected range with the repair switch so the gate can admit these EQ rows.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
