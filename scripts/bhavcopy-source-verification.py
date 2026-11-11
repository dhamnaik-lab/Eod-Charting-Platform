#!/usr/bin/env python3
"""Source-anchored bhavcopy repair verification (P5) and residual non-equity
dry-run manifest generator (P4-prep).

Modes:
  verify             Compare every stored bar in a date range against the
                     source anchor (admission evidence JSONs and/or raw source
                     bhavcopy CSVs) and emit a mismatch manifest. No writes.
  residual-manifest  List (symbol, date) pairs where the store holds a bar but
                     the source anchor proves there was NO regular/equity row
                     (no-EQ-row proof), with the stored OHLCV, the source rows
                     and an own-identity verdict read from instruments:
                       delete_candidate             the symbol's own identity is a regular equity series
                       keep_non_equity_instrument   the symbol itself is a debt/fund/other instrument
                       keep_unknown_identity        no instruments row (fail closed)
                     Only delete_candidate pairs may ever be proposed for the
                     P4 deletion decision; the tool deletes nothing.

Manifest schema: "bhavcopy-source-verification-v1". Prices are emitted as
scaled decimal values (raw / scale); volume and open interest are unscaled
counts in the store and are emitted as integers; "scale" is explicit.

Source anchors:
  --evidence-dir  One or more bhavcopy_admission folders (e.g.
                  "EOD DATABASE/bhavcopy_admission", "New Database/bhavcopy_admission").
                  Evidence files with schema nse-security-admission-v2 hold
                  EVERY input row of affected files with the admission gate's
                  own decision (admitted/reason), which is the authoritative
                  "source row" record the pipeline saw.
  --csv-dir       Optional folder(s) of raw source bhavcopy CSVs for dates
                  without evidence. Supported layouts (as in the app's parser
                  tests):
                    SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,PREVCLOSE,TOTTRDQTY,TIMESTAMP,ISIN
                    TradDt,TckrSymb,SctySrs,OpnPric,HghPric,LwPric,ClsPric,PrvsClsgPric,TtlTradgVol,ISIN[,OI...]

Safety contract: opens the store and sidecar read-only (URI mode=ro, 'rb');
writes only to the project tmp\\ tree (paths outside tmp\\ are refused) or stdout.

Usage (from the project root):
  python scripts/bhavcopy-source-verification.py verify \
      --database "EOD DATABASE" --exchange NSE \
      --from 2017-01-01 --to 2017-09-30 \
      --evidence-dir "EOD DATABASE/bhavcopy_admission" \
      --out tmp/fixtures/bhavcopy-series-repair/verify-canary.json

  python scripts/bhavcopy-source-verification.py residual-manifest \
      --database "EOD DATABASE" --exchange NSE \
      --from 2005-01-01 --to 2017-09-30 \
      --evidence-dir "EOD DATABASE/bhavcopy_admission" \
      --out tmp/fixtures/bhavcopy-series-repair/residual-dry-run.json
"""

from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone

_SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location(
    "eod_store_integrity_validator",
    os.path.join(_SCRIPTS_DIR, "eod-store-integrity-validator.py"),
)
_validator = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_validator)
EodFile = _validator.EodFile
u32_to_date = _validator.u32_to_date
date_to_u32 = _validator.date_to_u32
EQUITY_SERIES = _validator.EQUITY_SERIES
AUXILIARY_MARKET_SERIES = _validator.AUXILIARY_MARKET_SERIES

DEFAULT_SCALE = 10000
EVIDENCE_SCHEMA = "nse-security-admission-v2"
SCHEMA_ID = "bhavcopy-source-verification-v1"
# Own-identity rule for the residual dry-run (plan P4, revised 2026-11-08):
# a residual bar may only be proposed for deletion when the symbol's own
# instruments.series is a regular equity series. Debt/fund/other instruments
# that legitimately carry their own series under the same symbol must never
# be proposed. Mirrors the equity legend in security_admission.rs::classify().
REGULAR_EQUITY_SERIES = {
    "EQ", "BE", "BZ", "SM", "ST", "SZ", "SP", "SL", "SI", "SO", "SQ",
    "BT", "BL", "BO", "IL", "IQ", "TT", "IT",
}
MONTHS = {"JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
          "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12}


def is_regular_series(series: str) -> bool:
    """Regular (non-auxiliary-market) equity rows, mirroring the admission gate:
    the equity legend minus the auxiliary-market set, plus the EX family."""
    series = series.strip().upper()
    if series in AUXILIARY_MARKET_SERIES:
        return False
    if series in EQUITY_SERIES:
        return True
    if len(series) == 2 and series[0] in "EX" and (series[1].isalpha() or (series[1].isdigit() and series[1] != "0")):
        return True
    return False


def parse_csv_date(raw: str) -> int:
    """Accepts '20-NOV-2014' (legacy) and '2014-11-20' (udiff) as YYYYMMDD."""
    raw = raw.strip()
    parts = raw.split("-")
    if len(parts) == 3 and len(parts[0]) == 2 and parts[1].upper() in MONTHS:
        return int(f"{parts[2]}{MONTHS[parts[1].upper()]:02d}{parts[0]}")
    return int(raw.replace("-", ""))


def _num(raw) -> float:
    return float(str(raw).replace(",", "").strip() or 0)


def _int(raw) -> int:
    return int(round(_num(raw)))


def load_source_csvs(csv_dirs: list[str]) -> dict[int, dict[str, list[dict]]]:
    """Returns {date_u32: {symbol: [source rows]}} from raw source CSVs."""
    anchored: dict[int, dict[str, list[dict]]] = {}
    for folder in csv_dirs:
        if not os.path.isdir(folder):
            continue
        for name in sorted(os.listdir(folder)):
            if not name.lower().endswith(".csv"):
                continue
            path = os.path.join(folder, name)
            with open(path, "r", encoding="utf-8-sig", newline="") as handle:
                reader = csv.DictReader(handle)
                headers = [(h or "").strip() for h in (reader.fieldnames or [])]
                lowered = [h.lower() for h in headers]
                if "symbol" in lowered and "series" in lowered:
                    layout = "legacy"
                elif "tckrsymb" in lowered and "sctysrs" in lowered:
                    layout = "udiff"
                else:
                    print(f"WARNING: unsupported CSV header in {path}; skipped", file=sys.stderr)
                    continue
                for row in reader:
                    row = {k.strip(): v for k, v in row.items() if k is not None}
                    if layout == "legacy":
                        symbol = row.get("SYMBOL", "").strip()
                        series = row.get("SERIES", "").strip()
                        date = parse_csv_date(row.get("TIMESTAMP", ""))
                        entry = {
                            "symbol": symbol, "series": series,
                            "open": _num(row.get("OPEN")), "high": _num(row.get("HIGH")),
                            "low": _num(row.get("LOW")), "close": _num(row.get("CLOSE")),
                            "prev_close": _num(row.get("PREVCLOSE")),
                            "volume": _int(row.get("TOTTRDQTY")), "oi": _int(row.get("OI", 0)),
                            "isin": (row.get("ISIN") or "").strip(),
                        }
                    else:
                        symbol = row.get("TckrSymb", "").strip()
                        series = row.get("SctySrs", "").strip()
                        date = parse_csv_date(row.get("TradDt", ""))
                        oi = 0
                        for key, value in row.items():
                            if key.lower() in ("opnintrst", "openinterest", "oi", "opnintrstamt"):
                                oi = _int(value)
                                break
                        entry = {
                            "symbol": symbol, "series": series,
                            "open": _num(row.get("OpnPric")), "high": _num(row.get("HghPric")),
                            "low": _num(row.get("LwPric")), "close": _num(row.get("ClsPric")),
                            "prev_close": _num(row.get("PrvsClsgPric")),
                            "volume": _int(row.get("TtlTradgVol")), "oi": oi,
                            "isin": (row.get("ISIN") or "").strip(),
                        }
                    if not symbol or not date:
                        continue
                    anchored.setdefault(date, {}).setdefault(symbol, []).append(entry)
    return anchored


def load_evidence(evidence_dirs: list[str]) -> dict[int, dict[str, dict]]:
    """Returns {date_u32: {symbol: evidence}} where evidence holds the admitted
    source rows and every raw row of the affected file."""
    anchored: dict[int, dict[str, dict]] = {}
    for folder in evidence_dirs:
        if not os.path.isdir(folder):
            continue
        for name in sorted(os.listdir(folder)):
            if not (name.startswith("security-") and name.endswith(".json")):
                continue
            path = os.path.join(folder, name)
            try:
                with open(path, "r", encoding="utf-8") as handle:
                    document = json.load(handle)
            except (OSError, json.JSONDecodeError) as error:
                print(f"WARNING: unreadable evidence {path}: {error}", file=sys.stderr)
                continue
            if document.get("schema") != EVIDENCE_SCHEMA:
                continue
            for row in document.get("rows", []):
                symbol = row.get("symbol")
                date_raw = row.get("rowTradeDate") or row.get("tradeDate") or ""
                date = date_to_u32(date_raw)
                if not symbol or not date:
                    continue
                entry = {
                    "series": row.get("series", ""),
                    "isin": row.get("isin", ""),
                    "open": row.get("open", 0.0), "high": row.get("high", 0.0),
                    "low": row.get("low", 0.0), "close": row.get("close", 0.0),
                    "prev_close": row.get("prevClose", 0.0),
                    "volume": int(row.get("volume", 0) or 0),
                    "oi": int(row.get("oi", 0) or 0),
                    "admitted": bool(row.get("admitted")),
                    "reason": row.get("reason", ""),
                }
                per_symbol = anchored.setdefault(date, {}).setdefault(symbol, None)
                if per_symbol is None:
                    anchored[date][symbol] = {"rows": [], "evidence_files": set()}
                anchored[date][symbol]["rows"].append(entry)
                anchored[date][symbol]["evidence_files"].add(name)
    for date_map in anchored.values():
        for symbol, payload in date_map.items():
            payload["evidence_files"] = sorted(payload["evidence_files"])
    return anchored


def expected_stored_values(row: dict, scale: int) -> dict:
    return {
        "open": round(row["open"] * scale),
        "high": round(row["high"] * scale),
        "low": round(row["low"] * scale),
        "close": round(row["close"] * scale),
        "prev_close": round(row["prev_close"] * scale),
        "volume": int(row["volume"]),
        "oi": int(row["oi"]),
    }


def scaled_decimal(raw: int, scale: int) -> float:
    """Raw scaled integer -> decimal price for manifest output."""
    return raw / scale


def compare_record(record: dict, expected: dict, scale: int) -> dict:
    """Field diffs with prices as decimal values (raw / scale); volume and
    open interest are unscaled counts and stay integers."""
    field_mismatches = {}
    for field in ("open", "high", "low", "close", "prev_close", "volume", "oi"):
        if record[field] != expected[field]:
            if field in ("volume", "oi"):
                field_mismatches[field] = {
                    "stored": record[field], "source": expected[field],
                }
            else:
                field_mismatches[field] = {
                    "stored": scaled_decimal(record[field], scale),
                    "source": scaled_decimal(expected[field], scale),
                }
    return field_mismatches


def collect_stored_records(database_folder: str, exchange: str, symbols: set[str],
                           from_date: int, to_date: int) -> dict[str, dict[int, dict]]:
    eod_folder = os.path.join(database_folder, "eod_data", exchange)
    stored: dict[str, dict[int, dict]] = {}
    if not os.path.isdir(eod_folder):
        return stored
    for name in sorted(os.listdir(eod_folder)):
        if not name.lower().endswith(".eod"):
            continue
        symbol = name[:-4]
        if symbols and symbol not in symbols:
            continue
        eod = EodFile(os.path.join(eod_folder, name))
        if not eod.parseable:
            continue
        for record in eod.records:
            if from_date <= record["date"] <= to_date:
                stored.setdefault(symbol, {})[record["date"]] = record
    return stored


def versioned_out_path(out_path: str) -> str:
    """Force the manifest schema version into the file name.

    Manifests are read by humans or agents before deletion or sign-off
    decisions, so a name must never imply a schema it does not carry (see
    docs/BHAVCOPY_INTEGRITY_AND_VERIFICATION_TOOLS.md section 3). The
    version suffix is the trailing segment of SCHEMA_ID.
    """
    version = SCHEMA_ID.rsplit('-', 1)[-1]
    stem, extension = os.path.splitext(out_path)
    if stem.endswith("-" + version):
        return out_path
    out_path = stem + "-" + version + (extension or ".json")
    print(
        "--out does not carry the manifest schema version; writing " + out_path,
        file=sys.stderr,
    )
    return out_path


def resolve_out_path(raw: str) -> str:
    out_path = versioned_out_path(os.path.abspath(raw))
    project_tmp = os.path.abspath(os.path.join(os.path.dirname(_SCRIPTS_DIR), "tmp"))
    if os.path.commonpath([out_path, project_tmp]) != project_tmp:
        raise SystemExit("ERROR: --out must stay under the project tmp\\ folder (TMP-01).")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    return out_path


def load_instrument_identities(database_folder: str, exchange: str) -> dict[str, dict | None]:
    """Read-only instruments lookup: {symbol: {series, isin, name} or None}.
    A missing row stays None so the verdict can fail closed."""
    identities: dict[str, dict | None] = {}
    database_file = os.path.join(database_folder, "market-data.sqlite3")
    if not os.path.isfile(database_file):
        return identities
    uri = f"file:{database_file.replace(os.sep, '/')}?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    try:
        rows = connection.execute(
            "SELECT symbol, series, isin, name FROM instruments WHERE exchange = ?",
            (exchange,),
        ).fetchall()
    finally:
        connection.close()
    for symbol, series, isin, name in rows:
        identities[symbol] = {
            "series": (series or "").strip().upper(),
            "isin": isin or "",
            "name": name or "",
        }
    return identities


def own_identity_verdict(identity: dict | None) -> str:
    if identity is None:
        return "keep_unknown_identity"  # fail closed: no instruments row
    if identity["series"] in REGULAR_EQUITY_SERIES:
        return "delete_candidate"
    return "keep_non_equity_instrument"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="mode", required=True)

    def add_common(target) -> None:
        target.add_argument("--database", required=True, help="Database folder (contains eod_data/, eod_binary_state.sqlite)")
        target.add_argument("--exchange", default="NSE")
        target.add_argument("--from", dest="from_date", required=True, help="YYYY-MM-DD")
        target.add_argument("--to", dest="to_date", required=True, help="YYYY-MM-DD inclusive")
        target.add_argument("--symbol", default=None, help="Restrict to one symbol")
        target.add_argument("--evidence-dir", action="append", default=[], help="bhavcopy_admission folder (repeatable)")
        target.add_argument("--csv-dir", action="append", default=[], help="Raw source CSV folder (repeatable)")
        target.add_argument("--out", required=True, help="Manifest path under tmp\\")

    verify = sub.add_parser("verify", help="Compare stored bars against the source anchor")
    add_common(verify)
    residual = sub.add_parser("residual-manifest", help="Stored bars with a no-EQ-row source proof")
    add_common(residual)

    args = parser.parse_args()
    database_folder = os.path.abspath(args.database)
    from_date = date_to_u32(args.from_date)
    to_date = date_to_u32(args.to_date)

    evidence = load_evidence(args.evidence_dir)
    csv_source = load_source_csvs(args.csv_dir)
    symbols: set[str] = {args.symbol} if args.symbol else set()
    for source in (evidence, csv_source):
        for date, date_map in source.items():
            if from_date <= date <= to_date:
                symbols.update(date_map.keys())
    stored = collect_stored_records(database_folder, args.exchange, symbols, from_date, to_date)

    manifest: dict = {
        "schema": SCHEMA_ID,
        "tool": "bhavcopy-source-verification",
        "mode": args.mode,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "database": database_folder,
        "exchange": args.exchange,
        "range": {"from": args.from_date, "to": args.to_date},
        "anchors": {"evidence_dirs": args.evidence_dir, "csv_dirs": args.csv_dir},
        "scale": DEFAULT_SCALE,
    }

    if args.mode == "verify":
        field_mismatch_findings = []
        residual_findings = []
        unverifiable = []
        verified = 0
        dates_with_anchor = {date for date in evidence if from_date <= date <= to_date} | \
                            {date for date in csv_source if from_date <= date <= to_date}
        for symbol, records in sorted(stored.items()):
            for date, record in sorted(records.items()):
                source_rows = (evidence.get(date, {}).get(symbol, {}).get("rows")
                               or csv_source.get(date, {}).get(symbol))
                if not source_rows:
                    unverifiable.append({"symbol": symbol, "date": u32_to_date(date)})
                    continue
                if symbol in evidence.get(date, {}):
                    # Evidence anchor: the admission gate's own decision is
                    # authoritative. The repair-acceptance anchor is an ADMITTED
                    # REGULAR (equity) row; a stored bar whose source has none
                    # is a residual finding (the same set the residual-manifest
                    # lists), even when the bar matches the admitted quote of a
                    # fund/depositary instrument under the same symbol.
                    anchor_rows_ = [row for row in source_rows
                                    if row.get("admitted") and is_regular_series(row.get("series", ""))]
                    if not anchor_rows_:
                        residual_findings.append({
                            "symbol": symbol, "date": u32_to_date(date),
                            "kind": "stored_bar_without_admitted_source_row",
                            "source_series": sorted({row["series"] for row in source_rows}),
                        })
                        continue
                else:
                    # CSV anchor: no admission decision exists; the regular-
                    # series rows are the anchor, and no regular row means a
                    # residual finding.
                    anchor_rows_ = [row for row in source_rows if is_regular_series(row.get("series", ""))]
                    if not anchor_rows_:
                        residual_findings.append({
                            "symbol": symbol, "date": u32_to_date(date),
                            "kind": "stored_bar_without_admitted_source_row",
                            "source_series": sorted({row["series"] for row in source_rows}),
                        })
                        continue
                primary = anchor_rows_[0]
                expected = expected_stored_values(primary, DEFAULT_SCALE)
                field_diffs = compare_record(record, expected, DEFAULT_SCALE)
                if field_diffs:
                    field_mismatch_findings.append({
                        "symbol": symbol, "date": u32_to_date(date),
                        "kind": "field_mismatch",
                        "fields": field_diffs,
                        "source_series": sorted({row["series"] for row in anchor_rows_}),
                        "source_isin": primary.get("isin", ""),
                    })
                else:
                    verified += 1
        stored_dates = len({record["date"] for rows in stored.values() for record in rows.values()})             if stored else 0
        anchor_ratio = (len(dates_with_anchor) / stored_dates) if stored_dates else 0.0
        manifest["summary"] = {
            "stored_symbol_dates": sum(len(r) for r in stored.values()),
            "verified": verified,
            "field_mismatches": len(field_mismatch_findings),
            "residual_bars": len(residual_findings),
            "unverifiable_no_source_anchor": len(unverifiable),
            "dates_with_source_anchor": len(dates_with_anchor),
            "stored_dates_in_range": stored_dates,
            "anchor_coverage_ratio": round(anchor_ratio, 4),
            "verification_vacuous": bool(stored_dates) and anchor_ratio < 0.9,
            "total_findings": len(field_mismatch_findings) + len(residual_findings),
        }
        if manifest["summary"]["verification_vacuous"]:
            print(
                "WARNING: verification is VACUOUS for this range: only "
                f"{len(dates_with_anchor)} of {stored_dates} stored sessions have a source anchor "
                f"({anchor_ratio:.0%}). field_mismatches == 0 does NOT prove the chunk is correct; "
                "supply the chunk's own admission evidence (or raw source CSVs via --csv-dir) first.",
                file=sys.stderr,
            )
        manifest["field_mismatches"] = field_mismatch_findings
        manifest["residual_bars"] = residual_findings
        manifest["unverifiable"] = unverifiable
    else:
        identities = load_instrument_identities(database_folder, args.exchange)
        residuals = []
        for symbol, records in sorted(stored.items()):
            for date, record in sorted(records.items()):
                source_rows = (evidence.get(date, {}).get(symbol, {}).get("rows")
                               or csv_source.get(date, {}).get(symbol))
                if source_rows is None:
                    continue  # no anchor: not provable either way here
                regular = [row for row in source_rows if is_regular_series(row.get("series", ""))]
                if regular:
                    continue  # an equity row exists; not a residual
                identity = identities.get(symbol)
                residuals.append({
                    "symbol": symbol,
                    "date": u32_to_date(date),
                    "verdict": own_identity_verdict(identity),
                    "own_series": (identity or {}).get("series"),
                    "own_isin": (identity or {}).get("isin"),
                    "own_name": (identity or {}).get("name"),
                    "stored": {
                        "open": scaled_decimal(record["open"], DEFAULT_SCALE),
                        "high": scaled_decimal(record["high"], DEFAULT_SCALE),
                        "low": scaled_decimal(record["low"], DEFAULT_SCALE),
                        "close": scaled_decimal(record["close"], DEFAULT_SCALE),
                        "prev_close": scaled_decimal(record["prev_close"], DEFAULT_SCALE),
                        "volume": record["volume"], "oi": record["oi"],
                    },
                    "source_rows": [
                        {"series": row["series"], "isin": row["isin"],
                         "close": row["close"], "volume": row["volume"]}
                        for row in source_rows
                    ],
                    "no_eq_row_proof": {
                        "regular_rows": 0,
                        "series_present": sorted({row["series"] for row in source_rows}),
                        "anchor": "admission-evidence" if symbol in evidence.get(date, {}) else "source-csv",
                    },
                })
        verdict_counts = {
            "delete_candidate": 0,
            "keep_non_equity_instrument": 0,
            "keep_unknown_identity": 0,
        }
        for entry in residuals:
            verdict_counts[entry["verdict"]] += 1
        manifest["summary"] = {
            "residual_non_equity_pairs": len(residuals),
            "symbols": len({entry["symbol"] for entry in residuals}),
            "delete_candidate": verdict_counts["delete_candidate"],
            "keep_non_equity_instrument": verdict_counts["keep_non_equity_instrument"],
            "keep_unknown_identity": verdict_counts["keep_unknown_identity"],
        }
        manifest["residuals"] = residuals

    out_path = resolve_out_path(args.out)
    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)
    print(json.dumps(manifest["summary"], indent=2))
    print(f"Manifest written: {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
