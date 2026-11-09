"""Read-only NIFTY source audit. No market writes, downloads or inferred candles.

Inputs remain local; the report contains derived diagnostics, not a dataset copy.
An optional calendar JSON must supply source, from, to, sessions (ISO dates).
Without an authoritative calendar, weekdays are candidates, never proven gaps.
"""
import argparse
import csv
import datetime as dt
from decimal import Decimal, InvalidOperation
import hashlib
import io
import json
from pathlib import Path
import statistics

FIELDS = ("Open", "High", "Low", "Close")
MISSING = {"", "-", "NA", "N/A", "NULL"}


def parse_date(value):
    for fmt in ("%Y-%m-%d", "%d %b %Y", "%d-%b-%Y", "%d-%m-%Y", "%Y%m%d"):
        try:
            return dt.datetime.strptime(value.strip(), fmt).date().isoformat()
        except ValueError:
            pass
    raise ValueError(f"Invalid date: {value}")


def number(value):
    if value.strip().upper() in MISSING:
        return None
    result = Decimal(value.replace(",", ""))
    if not result.is_finite():
        raise ValueError("non-finite number")
    return result


def load_csv(path, as_of):
    raw = path.read_bytes()
    reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))
    headers = reader.fieldnames
    if not headers or not set(("Date", *FIELDS)).issubset(headers):
        raise ValueError(f"Unsupported schema: {headers}")
    rows, errors, duplicates, conflicting, missing, previous, inversions = {}, [], [], [], dict.fromkeys(FIELDS, 0), None, []
    names, volume, count = set(), {"absent_column": "Volume" not in headers, "missing": 0, "zero": 0, "invalid": 0}, 0
    for line, row in enumerate(reader, 2):
        count += 1
        try:
            date = parse_date(row["Date"])
            if date > as_of or date < "1990-07-03":
                errors.append({"line": line, "date": date, "error": "outside supported date bounds"})
            prices = tuple(number(row[f]) for f in FIELDS)
            for f, value in zip(FIELDS, prices):
                missing[f] += value is None
            if any(p is not None and p <= 0 for p in prices):
                errors.append({"line": line, "date": date, "error": "nonpositive price"})
            if prices[3] is None:
                errors.append({"line": line, "date": date, "error": "missing close"})
            if all(p is not None for p in prices):
                o, h, l, c = prices
                if h < max(o, l, c) or l > min(o, h, c):
                    errors.append({"line": line, "date": date, "error": "invalid OHLC"})
            elif any(p is not None for p in prices[:3]):
                errors.append({"line": line, "date": date, "error": "partially missing OHLC"})
            if previous and date < previous:
                inversions.append({"line": line, "date": date})
            previous = date
            if date in rows:
                duplicates.append(date)
                if rows[date] != prices:
                    conflicting.append(date)
            else:
                rows[date] = prices
            names.add(row.get("Index Name", "NIFTY 50 (file identity)"))
            v = number(row.get("Volume", ""))
            volume["missing"] += v is None
            volume["zero"] += v == 0
            volume["invalid"] += v is not None and (v < 0 or v != v.to_integral_value())
        except (ValueError, InvalidOperation, TypeError, KeyError) as error:
            errors.append({"line": line, "error": str(error)})
    ordered = sorted(rows)
    returns = [(b, float(rows[b][3] / rows[a][3] - 1)) for a, b in zip(ordered, ordered[1:]) if rows[a][3] and rows[b][3]]
    median = statistics.median([v for _, v in returns]) if returns else 0
    mad = statistics.median([abs(v - median) for _, v in returns]) if returns else 0
    threshold = max(.10, 10 * mad)
    outliers = [{"date": d, "return": r} for d, r in returns if abs(r - median) > threshold]
    return rows, {"path": str(path.resolve()), "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw), "encoding": "UTF-8", "headers": headers,
                  "rows": count, "unique_dates": len(rows), "from": min(rows) if rows else None, "to": max(rows) if rows else None,
                  "duplicates": duplicates, "conflicting_duplicates": conflicting, "order_inversions": inversions, "missing_fields": missing,
                  "errors": errors, "index_names": sorted(names), "volume": volume,
                  "outliers": {"method": "absolute return deviation > max(10%, 10*MAD); review signals, not proven errors", "threshold": threshold, "observations": outliers}}


def compare(left, right):
    overlap = sorted(left.keys() & right.keys())
    conflicts, equal_fields, compared_fields, missing_fields = [], 0, 0, []
    for date in overlap:
        for field, a, b in zip(FIELDS, left[date], right[date]):
            if a is None or b is None:
                if a != b:
                    missing_fields.append({"date": date, "field": field, "candidate_missing": a is None, "comparison_missing": b is None})
                continue
            compared_fields += 1
            equal_fields += a == b
            if a != b:
                conflicts.append({"date": date, "field": field, "candidate": str(a), "comparison": str(b), "difference": str(a-b)})
    start, end = max(min(left), min(right)), min(max(left), max(right))
    return {"overlapping_dates": len(overlap), "compared_fields": compared_fields, "equal_fields": equal_fields, "field_availability_differences": missing_fields,
            "conflicts": conflicts, "missing_in_candidate_within_overlap": sorted(d for d in right.keys()-left.keys() if start <= d <= end),
            "missing_in_comparison_within_overlap": sorted(d for d in left.keys()-right.keys() if start <= d <= end)}


def check_calendar(candidate, supplied):
    if not supplied.get("source"):
        raise ValueError("Calendar must identify its authoritative source")
    start, end = (dt.date.fromisoformat(supplied[k]).isoformat() for k in ("from", "to"))
    if start > end:
        raise ValueError("Invalid calendar bounds")
    sessions = {dt.date.fromisoformat(d).isoformat() for d in supplied["sessions"]}
    if len(sessions) != len(supplied["sessions"]) or any(d < start or d > end for d in sessions):
        raise ValueError("Duplicate or out-of-range calendar sessions")
    return {"status": "CHECKED_SUPPLIED_CALENDAR", "source": supplied["source"], "from": start, "to": end,
            "expected_sessions": len(sessions), "missing_sessions": sorted(sessions-candidate.keys()),
            "unexpected_sessions": sorted(d for d in candidate if start <= d <= end and d not in sessions),
            "outside_calendar_coverage": "HOLD; no missing-session conclusion outside this interval"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--comparison", type=Path, required=True)
    parser.add_argument("--official", type=Path, nargs="*", default=[])
    parser.add_argument("--calendar", type=Path)
    parser.add_argument("--as-of", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    as_of = dt.date.fromisoformat(args.as_of).isoformat()
    candidate, profile = load_csv(args.candidate, as_of)
    comparison, comparison_profile = load_csv(args.comparison, as_of)
    official, official_sources, official_windows = {}, [], []
    official_conflicts = []
    for path in args.official:
        raw = path.read_bytes()
        data = json.loads(raw)
        if data.get("error") or not isinstance(data.get("data"), list):
            raise ValueError(f"Not an official data response: {path}")
        for row in data["data"]:
            date = parse_date(row["EOD_TIMESTAMP"])
            prices = tuple(number(str(row.get(f"EOD_{f.upper()}_INDEX_VAL", ""))) for f in FIELDS)
            # Observed zero OHL (including 1996-10-30) is unavailable, not a price.
            prices = tuple(None if i < 3 and p == 0 else p for i, p in enumerate(prices))
            if date in official and official[date] != prices:
                official_conflicts.append(date)
            official[date] = prices
        dates = [parse_date(row["EOD_TIMESTAMP"]) for row in data["data"]]
        if dates:
            official_windows.append((min(dates), max(dates)))
        official_sources.append({"path": str(path.resolve()), "sha256": hashlib.sha256(raw).hexdigest(), "rows": len(data["data"])})
    calendar = {"status": "HOLD", "reason": "No verified complete trading-session calendar supplied; weekdays are not proof of trading."}
    if args.calendar:
        supplied = json.loads(args.calendar.read_text(encoding="utf-8"))
        calendar = check_calendar(candidate, supplied)
        calendar["official_missing_sessions_within_observed_windows"] = sorted(d for d in supplied["sessions"] if d not in official and any(a <= d <= b for a,b in official_windows))
    periods = []
    for name, start, end, fields in [
        ("A_retrospective_close_only", "1990-07-03", "1995-11-02", ["Close"]),
        ("B_pre_launch_reconstructed_OHLC", "1995-11-03", "1996-04-21", list(FIELDS)),
        ("C_post_launch_before_EOD2", "1996-04-22", "2012-02-20", list(FIELDS)),
        ("D_modern_EOD2_overlap", "2012-02-21", max(candidate), list(FIELDS))]:
        selected = {d: p for d,p in candidate.items() if start <= d <= end}
        checked = {d: p for d,p in official.items() if d in selected}
        conflicts = compare(selected, checked)["conflicts"] if checked else []
        field_counts = {field: sum(prices[i] is not None for prices in selected.values()) for i,field in enumerate(FIELDS)}
        per_field = {field: {"observed": field_counts[field], "status": "HOLD" if any(c["field"] == field for c in conflicts) or not any(p[i] is not None for p in checked.values()) else "PARTIALLY_CERTIFIED",
                              "authoritative_values_compared": sum(selected[d][i] is not None and p[i] is not None for d,p in checked.items())} for i,field in enumerate(FIELDS)}
        periods.append({"period": name, "from": start, "to": end, "fields": fields, "field_certification": per_field, "rows": len(selected),
                        "authoritative_dates_compared": len(checked), "authoritative_field_conflicts": len(conflicts),
                        "status": "PARTIALLY_CERTIFIED" if checked and not conflicts else "HOLD",
                        "chart_integration": "HOLD", "reason": "Bounded official observations only; complete authoritative values, calendar, provenance and rights not established. Close-only/pre-launch records excluded from candles/analytics."})
    bounded_candidate = {d:p for d,p in candidate.items() if any(a <= d <= b for a,b in official_windows)}
    result = {"schema_version": 1, "as_of": as_of, "overall_status": "HOLD", "analytics_admission": False,
              "provenance": {"candidate": "Third-party Gist; license and original acquisition chain not established", "eod2": "Repository says NSE daily reports; independence from candidate is unproven; no dataset redistribution license found", "redistribution": "Raw sources excluded from delivery ZIP"},
              "candidate": profile, "comparison": comparison_profile, "all_EOD2_overlap": compare(candidate, comparison),
              "official_sources": official_sources, "official_internal_conflicts": official_conflicts,
              "bounded_authoritative_comparison": compare(bounded_candidate, official) if official else None,
              "official_observed_windows": official_windows,
              "calendar": calendar, "periods": periods,
              "volume_semantics": "Candidate has no volume field. API zeros or absent volume mean unknown/unavailable, never evidence of no trading.",
              "continuity": "No rebasing inferred. Outliers require event evidence; no gaps filled or conflicting observations overwritten."}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({"candidate_rows": profile["rows"], "errors": len(profile["errors"]), "overlap": result["all_EOD2_overlap"]["overlapping_dates"], "EOD2_conflicts": len(result["all_EOD2_overlap"]["conflicts"]), "official_conflicts": len(result["bounded_authoritative_comparison"]["conflicts"]) if official else None, "periods": periods}, indent=2))


if __name__ == "__main__":
    main()
