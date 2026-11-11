#!/usr/bin/env python3
"""P4 residual review — read-only manifest of bars whose date has no admitted EQ row.

Input: the `verify` manifests produced for the repaired window (they already carry
the `residual_bars` list with symbol/date/source_series). Output: one deduplicated
manifest with the store's own instrument identity per pair, so the deletion
decision can be made per batch without touching any data.

Verdicts (same rules as `bhavcopy-source-verification.py residual-manifest`):
  delete_candidate            symbol's own `instruments.series` is a regular equity
                              series -> the stored bar has no equity source row
  keep_non_equity_instrument  the symbol itself is a debt/fund/other instrument
  keep_unknown_identity       no instruments row (fail closed)

Nothing is deleted, moved or written outside `tmp/`.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import sqlite3
import sys
from collections import Counter

EQUITY_SERIES = {"EQ", "BE", "BZ", "SM", "ST", "SZ", "SP", "SL", "SI", "SO", "SQ",
                 "BT", "BL", "BO", "IL", "IQ", "TT", "IT"}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", default="EOD DATABASE")
    parser.add_argument("--manifests", nargs="+", required=True,
                        help="verify manifests to aggregate (globs allowed)")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    paths: list[str] = []
    for pattern in args.manifests:
        paths.extend(sorted(glob.glob(pattern)))
    if not paths:
        print("ERROR: no manifests matched", file=sys.stderr)
        return 2

    pairs: dict[tuple[str, str], set] = {}
    sources = Counter()
    for path in paths:
        with open(path, "r", encoding="utf-8") as handle:
            document = json.load(handle)
        for entry in document.get("residual_bars", []):
            key = (entry["symbol"], entry["date"])
            pairs.setdefault(key, set()).update(entry.get("source_series") or [])
            sources[os.path.basename(path)] += 1

    database_file = os.path.join(os.path.abspath(args.database), "market-data.sqlite3")
    connection = sqlite3.connect(f"file:{database_file}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    verdicts = Counter()
    triage_counts = Counter()
    by_symbol: dict[str, dict] = {}
    rows_out = []
    for (symbol, date), series in sorted(pairs.items()):
        row = connection.execute(
            "SELECT series, isin, name, lifecycle_status FROM instruments WHERE exchange='NSE' AND symbol=?",
            (symbol,),
        ).fetchone()
        own = (row["series"] or "").strip() if row else ""
        if row is None:
            verdict = "keep_unknown_identity"
        elif own in EQUITY_SERIES:
            verdict = "delete_candidate"
        else:
            verdict = "keep_non_equity_instrument"
        verdicts[verdict] += 1
        # A `delete_candidate` still needs triage: an equity source row that was
        # merely blocked is a repair case, not a deletion; a government/fund/
        # depositary source row belongs to that instrument and must be kept.
        stock = set(series)
        if verdict != "delete_candidate":
            triage = "n/a"
        elif "EQ" in stock:
            triage = "repair_blocked_equity_row"
        elif stock & {"GB", "GS", "TB", "SG", "IV", "MF", "RR", "DR", "DE"}:
            triage = "keep_own_instrument_prices"
        else:
            triage = "foreign_bar_candidate"
        triage_counts[triage] += 1
        bucket = by_symbol.setdefault(symbol, {"verdict": verdict, "triage": triage, "own_series": own,
                                               "lifecycle": row["lifecycle_status"] if row else None,
                                               "pairs": 0, "dates": []})
        bucket["pairs"] += 1
        if len(bucket["dates"]) < 5:
            bucket["dates"].append(date)
        rows_out.append({"symbol": symbol, "date": date, "verdict": verdict, "triage": triage,
                         "own_series": own, "source_series": sorted(series)})
    connection.close()

    stamp = os.path.basename(paths[-1]).replace("verify-", "").replace("-v1.json", "")
    out = args.out or os.path.join(root, "tmp", "fixtures", "bhavcopy-series-repair",
                                   f"residual-review-{stamp}.json")
    manifest = {
        "schema": "eod-residual-review-v1",
        "inputs": [os.path.basename(path) for path in paths],
        "totals": {
            "pairs": sum(verdicts.values()),
            "delete_candidate": verdicts["delete_candidate"],
            "keep_non_equity_instrument": verdicts["keep_non_equity_instrument"],
            "keep_unknown_identity": verdicts["keep_unknown_identity"],
            "symbols": len(by_symbol),
            "triage": dict(triage_counts),
        },
        "symbols": [
            {"symbol": symbol, "verdict": info["verdict"], "own_series": info["own_series"],
             "lifecycle": info["lifecycle"], "triage": info["triage"], "pairs": info["pairs"], "sample_dates": info["dates"]}
            for symbol, info in sorted(by_symbol.items(), key=lambda kv: -kv[1]["pairs"])
        ],
        "pairs": rows_out,
        "action": "REVIEW ONLY — nothing deleted; delete_candidate pairs need explicit per-batch approval",
    }
    with open(out, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=1)

    print(f"manifests read: {len(paths)}")
    print(f"unique residual pairs: {manifest['totals']['pairs']} across {manifest['totals']['symbols']} symbols")
    print(f"  delete_candidate           : {verdicts['delete_candidate']}")
    print(f"  keep_non_equity_instrument : {verdicts['keep_non_equity_instrument']}")
    print(f"  keep_unknown_identity      : {verdicts['keep_unknown_identity']}")
    print("delete_candidate triage:")
    for name, count in triage_counts.most_common():
        if name != "n/a":
            print(f"  {name:30s}: {count}")
    print("\ntop symbols:")
    for item in manifest["symbols"][:15]:
        print(f"  {item['symbol']:14s} {item['verdict']:26s} pairs={item['pairs']:5d} own_series={item['own_series']!r}")
    print(f"\nmanifest: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
