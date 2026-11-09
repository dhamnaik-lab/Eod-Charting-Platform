#!/usr/bin/env python3
"""READ-ONLY EOD binary-store integrity validator (bhavcopy series-collision audit, C3).

Reports, per exchange/symbol, against the binary .eod store:
  (a) duplicate dates inside a symbol file
  (b) header/length/record-count divergence between the .eod file and its
      eod_binary_state.sqlite index row
  (c) prev_close = 0 bars (the first record of a file is expected and excluded)
  (d) prev_close != previous record's close
  (e) single-price bars with volume below a fraction of the symbol's median
      volume (auxiliary / block-print leakage candidates)
  (f) sustained price-plateau windows with collapsed volume (debt-series
      leakage candidates, e.g. N-series debenture bars under an equity symbol);
      fragments separated by <= --plateau-merge-gap sessions are merged into
      one range (fragment list kept secondary)

prev_close_mismatch excludes bars whose stored prev_close is 0, so it does not
double-count the prev_close_zero finding; the two counts are separate.

Report schema: "eod-store-integrity-v1". Prices are emitted as decimal values
(raw / price_scale); volume and open interest are unscaled counts in the store
and stay integers; "price_scale" is explicit per symbol.

Safety contract:
  - Opens every SQLite database with URI mode=ro; opens every .eod file 'rb'.
  - Writes NOTHING to the database folder. Output goes to stdout, and only to
    tmp\\ when --out is given (paths outside tmp\\ are refused).

Usage (from the project root):
  python scripts/eod-store-integrity-validator.py --database "EOD DATABASE"
  python scripts/eod-store-integrity-validator.py --database "EOD DATABASE" \
      --exchange NSE --symbol SBIN --from 2005-01-01 --to 2017-09-30 \
      --out tmp/fixtures/bhavcopy-series-repair/integrity-report.json
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import statistics
import struct
import sys
from datetime import datetime, timezone

HEADER_SIZE = 128
RECORD_SIZE = 64
MAGIC = b"EOD1"
DEFAULT_SCALE = 10000
SCHEMA_ID = "eod-store-integrity-v1"
RECORD_STRUCT = struct.Struct("<IIqqqqQQQ")

# Series legend mirrored from src-tauri-shell/src/bhavcopy/security_admission.rs
# (classify() + auxiliary_market()). Used only to label leakage candidates; the
# validator never rewrites admission decisions.
EQUITY_SERIES = {
    "EQ", "BE", "BZ", "SM", "ST", "SZ", "SP", "SL", "SI", "SO", "SQ",
    "BT", "BL", "BO", "IL", "IQ", "TT", "IT",
}
AUXILIARY_MARKET_SERIES = {"IL", "IQ", "BL", "SL", "SI", "SQ"}


def u32_to_date(value: int) -> str:
    s = f"{value:08d}"
    return f"{s[0:4]}-{s[4:6]}-{s[6:8]}"


def date_to_u32(date: str) -> int:
    return int(date.replace("-", ""))


class EodFile:
    def __init__(self, path: str):
        self.path = path
        with open(path, "rb") as handle:
            data = handle.read()
        self.raw = data
        self.truncated = len(data) < HEADER_SIZE
        if self.truncated:
            return
        header = data[:HEADER_SIZE]
        self.magic = header[0:4]
        self.version = struct.unpack("<H", header[4:6])[0]
        self.record_size = struct.unpack("<H", header[6:8])[0]
        self.record_count = struct.unpack("<I", header[8:12])[0]
        self.price_scale = struct.unpack("<I", header[12:16])[0]
        self.symbol = header[16:48].rstrip(b"\x00").decode("ascii", "replace")
        self.exchange = header[48:64].rstrip(b"\x00").decode("ascii", "replace")
        self.expected_length = HEADER_SIZE + self.record_count * RECORD_SIZE
        self.records = []
        if not self.truncated and len(data) >= self.expected_length:
            payload = data[HEADER_SIZE:self.expected_length]
            for offset in range(0, len(payload), RECORD_SIZE):
                date, flags, o, h, l, c, pc, v, oi = RECORD_STRUCT.unpack_from(payload, offset)
                self.records.append({
                    "date": date, "flags": flags, "open": o, "high": h,
                    "low": l, "close": c, "prev_close": pc, "volume": v, "oi": oi,
                })
            self.records.sort(key=lambda r: r["date"])
            self.extra_bytes = len(data) - self.expected_length
        else:
            self.extra_bytes = 0

    @property
    def parseable(self) -> bool:
        return (
            not self.truncated
            and self.magic == MAGIC
            and self.record_size == RECORD_SIZE
            and len(self.records) == self.record_count
        )


def open_read_only(path: str) -> sqlite3.Connection:
    uri = f"file:{path.replace(os.sep, '/')}?mode=ro"
    return sqlite3.connect(uri, uri=True)


def load_index_rows(database_folder: str, exchange: str | None) -> dict[tuple[str, str], dict]:
    sidecar = os.path.join(database_folder, "eod_binary_state.sqlite")
    if not os.path.isfile(sidecar):
        return {}
    connection = open_read_only(sidecar)
    try:
        if exchange:
            rows = connection.execute(
                "SELECT exchange, symbol, relative_path, record_count, price_scale,"
                " file_length, first_date, last_date, state_status"
                " FROM eod_binary_state WHERE exchange = ?",
                (exchange,),
            ).fetchall()
        else:
            rows = connection.execute(
                "SELECT exchange, symbol, relative_path, record_count, price_scale,"
                " file_length, first_date, last_date, state_status"
                " FROM eod_binary_state"
            ).fetchall()
    finally:
        connection.close()
    return {
        (row[0], row[1]): {
            "relative_path": row[2], "record_count": row[3], "price_scale": row[4],
            "file_length": row[5], "first_date": row[6], "last_date": row[7],
            "state_status": row[8],
        }
        for row in rows
    }


def classify_leakage(records: list[dict], volume_ratio: float, plateau_min_days: int,
                     plateau_tolerance: float, from_date: int, to_date: int) -> tuple[list[dict], list[dict]]:
    """Returns (single-price sub-threshold bars, plateau windows).

    A plateau window is a run of consecutive records with collapsed volume
    (below volume_ratio x symbol median) whose close stays within
    plateau_tolerance of the first close of the run - the signature of a
    debt/auxiliary series that trades flat and thin under an equity symbol.
    """
    volumes = [r["volume"] for r in records if r["volume"] > 0]
    median_volume = statistics.median(volumes) if volumes else 0
    threshold = median_volume * volume_ratio

    single_price = []
    for record in records:
        if not (from_date <= record["date"] <= to_date):
            continue
        if record["open"] == record["high"] == record["low"] == record["close"]:
            if median_volume > 0 and record["volume"] < threshold:
                single_price.append({
                    "date": u32_to_date(record["date"]),
                    "close": record["close"],
                    "volume": record["volume"],
                })

    plateaus: list[dict] = []
    run: list[dict] = []

    def close_run() -> None:
        nonlocal run
        if len(run) >= plateau_min_days:
            plateaus.append(_plateau_entry(run))
        run = []

    for record in records:
        in_range = from_date <= record["date"] <= to_date
        low_volume = in_range and median_volume > 0 and record["volume"] < threshold
        if not low_volume:
            close_run()
            continue
        if run:
            base = run[0]["close"]
            if abs(record["close"] - base) > max(abs(base) * plateau_tolerance, 1):
                close_run()
        run.append(record)
    close_run()

    return single_price, plateaus


def _plateau_entry(run: list[dict]) -> dict:
    return {
        "from": u32_to_date(run[0]["date"]),
        "to": u32_to_date(run[-1]["date"]),
        "days": len(run),
        "close_first": run[0]["close"],
        "close_last": run[-1]["close"],
        "max_volume": max(r["volume"] for r in run),
    }


def _levels_compatible(previous_close: float, next_close: float, max_drift: float) -> bool:
    """Two fragments may only be bridged when they sit at a comparable price
    level. Without this guard a large session gap could merge unrelated
    plateaus (e.g. a 13.10 segment with a 1,180 segment) and report one
    meaningless range."""
    if previous_close <= 0 or next_close <= 0:
        return False
    return abs(previous_close - next_close) / max(previous_close, next_close) <= max_drift


def _merge_plateaus(fragments: list[dict], records: list[dict], merge_gap: int,
                    merge_level: float = 0.25) -> list[dict]:
    """Merge plateau fragments separated by <= merge_gap sessions into one
    leakage range. A session is one record of the file; the gap is the number
    of records strictly between two fragments. The merged range spans the
    first fragment's start to the last fragment's end. Fragments are only
    bridged while their price levels stay within merge_level of each other."""
    if not fragments:
        return []
    positions = {record["date"]: index for index, record in enumerate(records)}
    ordered = sorted(fragments, key=lambda f: date_to_u32(f["from"]))
    merged: list[dict] = []
    current_from = ordered[0]["from"]
    current_to = ordered[0]["to"]
    close_first = ordered[0]["close_first"]
    close_last = ordered[0]["close_last"]
    max_volume = ordered[0]["max_volume"]
    prev_end_pos = positions[date_to_u32(current_to)]
    for fragment in ordered[1:]:
        start_pos = positions[date_to_u32(fragment["from"])]
        gap = start_pos - prev_end_pos - 1
        if gap > merge_gap or not _levels_compatible(close_last, fragment["close_first"], merge_level):
            merged.append({
                "from": current_from, "to": current_to,
                "sessions": prev_end_pos - positions[date_to_u32(current_from)] + 1,
                "close_first": close_first, "close_last": close_last,
                "max_volume": max_volume,
            })
            current_from = fragment["from"]
            close_first = fragment["close_first"]
        current_to = fragment["to"]
        close_last = fragment["close_last"]
        max_volume = max(max_volume, fragment["max_volume"])
        prev_end_pos = positions[date_to_u32(current_to)]
    merged.append({
        "from": current_from, "to": current_to,
        "sessions": prev_end_pos - positions[date_to_u32(current_from)] + 1,
        "close_first": close_first, "close_last": close_last,
        "max_volume": max_volume,
    })
    return merged


def validate_symbol_file(path: str, index_row: dict | None, args) -> dict:
    report: dict = {"file": os.path.relpath(path), "issues": {}}
    eod = EodFile(path)

    if eod.truncated:
        report["issues"]["unparseable"] = {"reason": "file shorter than header"}
        return report
    if eod.magic != MAGIC:
        report["issues"]["unparseable"] = {"reason": f"bad magic {eod.magic!r}"}
        return report
    if eod.record_size != RECORD_SIZE:
        report["issues"]["unparseable"] = {"reason": f"record size {eod.record_size}"}
        return report
    if eod.extra_bytes:
        report["issues"]["trailing_bytes"] = {"bytes": eod.extra_bytes}
    if len(eod.records) != eod.record_count:
        report["issues"]["record_count_mismatch"] = {
            "header": eod.record_count, "parsed": len(eod.records),
        }

    # (a) duplicate dates
    seen: dict[int, int] = {}
    duplicates = []
    for record in eod.records:
        if record["date"] in seen:
            duplicates.append(u32_to_date(record["date"]))
        seen[record["date"]] = 1
    if duplicates:
        report["issues"]["duplicate_dates"] = {
            "count": len(duplicates), "samples": duplicates[:20],
        }

    # (b) file vs eod_binary_state index divergence
    divergence = {}
    if index_row is None:
        divergence["index_row"] = "missing"
    else:
        if index_row["record_count"] != eod.record_count:
            divergence["record_count"] = {
                "index": index_row["record_count"], "file": eod.record_count,
            }
        if index_row["file_length"] != os.path.getsize(path):
            divergence["file_length"] = {
                "index": index_row["file_length"], "file": os.path.getsize(path),
            }
        if index_row["price_scale"] != eod.price_scale:
            divergence["price_scale"] = {
                "index": index_row["price_scale"], "file": eod.price_scale,
            }
        if index_row["first_date"] is not None and eod.records:
            if index_row["first_date"] != eod.records[0]["date"]:
                divergence["first_date"] = {
                    "index": u32_to_date(index_row["first_date"]),
                    "file": u32_to_date(eod.records[0]["date"]),
                }
        if index_row["last_date"] is not None and eod.records:
            if index_row["last_date"] != eod.records[-1]["date"]:
                divergence["last_date"] = {
                    "index": u32_to_date(index_row["last_date"]),
                    "file": u32_to_date(eod.records[-1]["date"]),
                }
    if divergence:
        report["issues"]["index_divergence"] = divergence
    report["index_status"] = (index_row or {}).get("state_status")

    from_date = date_to_u32(args.from_date) if args.from_date else 0
    to_date = date_to_u32(args.to_date) if args.to_date else 99999999

    # (c) prev_close = 0 (first record excluded) and (d) prev_close != prior close.
    # A bar whose stored prev_close is 0 is reported only as (c); (d) excludes it
    # so the two counts never double-count the same bar.
    scale = eod.price_scale
    report["price_scale"] = scale
    zero_prev_close = []
    prev_close_mismatches = []
    previous = None
    for position, record in enumerate(eod.records):
        if not (from_date <= record["date"] <= to_date):
            previous = record
            continue
        if record["prev_close"] == 0 and position > 0:
            zero_prev_close.append(u32_to_date(record["date"]))
        if (previous is not None and record["prev_close"] != previous["close"]
                and record["prev_close"] != 0):
            prev_close_mismatches.append({
                "date": u32_to_date(record["date"]),
                "stored_prev_close": record["prev_close"] / scale,
                "previous_close": previous["close"] / scale,
            })
        previous = record
    if zero_prev_close:
        report["issues"]["prev_close_zero"] = {
            "count": len(zero_prev_close),
            "first": zero_prev_close[0],
            "last": zero_prev_close[-1],
            "samples": zero_prev_close[:10],
        }
    if prev_close_mismatches:
        report["issues"]["prev_close_mismatch"] = {
            "count": len(prev_close_mismatches), "samples": prev_close_mismatches[:10],
        }

    # (e) + (f) leakage heuristics over the symbol's own history
    single_price, plateaus = classify_leakage(
        eod.records, args.volume_ratio, args.plateau_min_days, args.plateau_tolerance,
        from_date, to_date,
    )
    if single_price:
        report["issues"]["single_price_low_volume_bars"] = {
            "count": len(single_price),
            "median_volume": statistics.median([r["volume"] for r in eod.records if r["volume"] > 0]),
            "samples": [
                {"date": entry["date"], "close": entry["close"] / scale,
                 "volume": entry["volume"]}
                for entry in single_price[:15]
            ],
        }
    if plateaus:
        merged = _merge_plateaus(plateaus, eod.records, args.plateau_merge_gap, args.plateau_merge_level)
        report["issues"]["price_plateau_collapsed_volume_windows"] = {
            "count": len(merged),
            "windows": [
                {**window,
                 "close_first": window["close_first"] / scale,
                 "close_last": window["close_last"] / scale}
                for window in merged[:15]
            ],
            "fragments": {
                "count": len(plateaus),
                "windows": [
                    {**fragment,
                     "close_first": fragment["close_first"] / scale,
                     "close_last": fragment["close_last"] / scale}
                    for fragment in plateaus[:15]
                ],
            },
        }
    report["records"] = len(eod.records)
    report["median_volume"] = statistics.median([r["volume"] for r in eod.records if r["volume"] > 0]) if any(r["volume"] > 0 for r in eod.records) else 0
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--database", required=True, help="Database folder containing eod_data/, eod_binary_state.sqlite")
    parser.add_argument("--exchange", default=None, help="Filter to one exchange (e.g. NSE)")
    parser.add_argument("--symbol", default=None, help="Filter to one symbol (e.g. SBIN)")
    parser.add_argument("--from", dest="from_date", default=None, help="Analysis range start YYYY-MM-DD (default: whole file)")
    parser.add_argument("--to", dest="to_date", default=None, help="Analysis range end YYYY-MM-DD")
    parser.add_argument("--volume-ratio", type=float, default=0.01, help="Low-volume threshold as fraction of symbol median volume (default 0.01)")
    parser.add_argument("--plateau-min-days", type=int, default=5, help="Minimum consecutive days for a plateau window (default 5)")
    parser.add_argument("--plateau-tolerance", type=float, default=0.01, help="Max close drift inside a plateau window as a fraction (default 0.01, i.e. 1 percent)")
    parser.add_argument("--plateau-merge-gap", type=int, default=60, help="Merge plateau fragments separated by up to this many sessions (default 60, i.e. about one quarter; use 0 for raw fragments)")
    parser.add_argument("--plateau-merge-level", type=float, default=0.25, help="Merge plateau fragments only while their price levels differ by at most this fraction (default 0.25)")
    parser.add_argument("--out", default=None, help="Write JSON report under tmp\\ (refused elsewhere)")
    args = parser.parse_args()

    database_folder = os.path.abspath(args.database)
    eod_root = os.path.join(database_folder, "eod_data")
    if not os.path.isdir(eod_root):
        print(f"ERROR: eod_data folder not found under {database_folder}", file=sys.stderr)
        return 2

    if args.out:
        out_path = os.path.abspath(args.out)
        version = SCHEMA_ID.rsplit("-", 1)[-1]
        stem, extension = os.path.splitext(out_path)
        if not stem.endswith("-" + version):
            out_path = stem + "-" + version + (extension or ".json")
            print(
                "--out does not carry the report schema version; writing " + out_path,
                file=sys.stderr,
            )
        project_tmp = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tmp"))
        if os.path.commonpath([out_path, project_tmp]) != project_tmp:
            print("ERROR: --out must stay under the project tmp\\ folder (TMP-01).", file=sys.stderr)
            return 2
        os.makedirs(os.path.dirname(out_path), exist_ok=True)

    index_rows = load_index_rows(database_folder, args.exchange)
    report: dict = {
        "schema": SCHEMA_ID,
        "tool": "eod-store-integrity-validator",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "database": database_folder,
        "filters": {
            "exchange": args.exchange, "symbol": args.symbol,
            "from": args.from_date, "to": args.to_date,
            "volume_ratio": args.volume_ratio, "plateau_min_days": args.plateau_min_days,
            "plateau_tolerance": args.plateau_tolerance, "plateau_merge_gap": args.plateau_merge_gap,
            "plateau_merge_level": args.plateau_merge_level,
        },
        "symbols": {},
    }

    symbols_scanned = 0
    issue_symbols = 0
    exchanges = sorted(os.listdir(eod_root)) if not args.exchange else [args.exchange]
    for exchange in exchanges:
        exchange_folder = os.path.join(eod_root, exchange)
        if not os.path.isdir(exchange_folder):
            continue
        for file_name in sorted(os.listdir(exchange_folder)):
            if not file_name.lower().endswith(".eod"):
                continue
            symbol = file_name[:-4]
            if args.symbol and symbol != args.symbol:
                continue
            symbols_scanned += 1
            symbol_report = validate_symbol_file(
                os.path.join(exchange_folder, file_name),
                index_rows.get((exchange, symbol)),
                args,
            )
            symbol_report["exchange"] = exchange
            symbol_report["symbol"] = symbol
            report["symbols"][f"{exchange}:{symbol}"] = symbol_report
            if symbol_report["issues"]:
                issue_symbols += 1

    report["summary"] = {
        "symbols_scanned": symbols_scanned,
        "symbols_with_issues": issue_symbols,
        "index_rows_total": len(index_rows),
    }

    lines = [
        f"EOD store integrity: scanned {symbols_scanned} symbol files, "
        f"{issue_symbols} with findings.",
    ]
    for key, symbol_report in report["symbols"].items():
        if not symbol_report["issues"]:
            continue
        lines.append(f"- {key}: " + ", ".join(
            f"{name}({details.get('count', details) if isinstance(details, dict) else details})"
            for name, details in symbol_report["issues"].items()
        ))
    summary_text = "\n".join(lines)
    print(summary_text)

    if args.out:
        with open(out_path, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2)
        print(f"Full report written: {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
