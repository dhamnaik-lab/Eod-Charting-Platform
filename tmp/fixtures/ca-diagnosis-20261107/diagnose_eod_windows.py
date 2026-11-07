"""Read hash-pinned fixture EOD1 files; never open source/live price files."""
import bisect
import datetime as dt
import hashlib
import json
import sqlite3
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATABASE = ROOT / "market-data.sqlite3"
DATABASE_HASH = "774555A7FE16A67963F1034974B66D8AE90394CE0ECE0D9AA1ED5594157FCDE7"
# Source and destination hashes matched in the user-supplied Copy-Item block.
HASHES = {
    "SBIN": "F92CB064AA28CB33909B0244210941E776FB34C41527FF62D5D5C1BFFB94F4ED",
    "JSWSTEEL": "F3082DA9B4B098C2F538DD742BFE037301A67176CF5B5E84B00925A02F63242C",
    "BRITANNIA": "BCE3FEADCD0E939C865798EAABB6F23075E103B0E51486368D6F5B2424E01270",
    "JMFINANCIL": "13F9B23F5B7557E00C502E153AF33791FA12196E1D97DF0F248283B5FE70BFB1",
    "AJANTPHARM": "A317CE38F4246BEC6E66DF4D181F7D174FAB0A2C41C9F930DC07F1BDEDFB02D3",
    "NAVKARURB": "7A05F4EEB08C4199E153038379E1427A63688E671B71B8488361EA99B4052114",
    "PCBL": "25ABDDE13718D19B898252C5A96760D694A6684E50EEB3850852560EDCBF2B1D",
}
EVENTS = [
    ("SBIN", "2014-11-20", 10.0), ("JSWSTEEL", "2017-01-04", 10.0),
    ("BRITANNIA", "2010-09-08", 5.0), ("BRITANNIA", "2010-03-08", 2.0),
    ("JMFINANCIL", "2008-09-08", 25.0), ("AJANTPHARM", "2013-09-17", 1.5),
    ("NAVKARURB", "2025-05-09", 2.0), ("PCBL", "2018-04-19", 5.0),
]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def iso(date):
    return dt.datetime.strptime(str(date), "%Y%m%d").date().isoformat()


def write_json(name, data):
    with (ROOT / name).open("w", encoding="utf-8", newline="\r\n") as output:
        json.dump(data, output, indent=2)
        output.write("\n")


assert sha(DATABASE) == DATABASE_HASH, "Wrong SQLite snapshot"
db = sqlite3.connect(DATABASE.as_uri() + "?mode=ro&immutable=1", uri=True)
db.row_factory = sqlite3.Row
db.execute("PRAGMA query_only=ON")
series, inventory = {}, {}
for symbol, expected_hash in HASHES.items():
    path = ROOT / "eod_data" / "NSE" / (symbol + ".eod")
    assert sha(path) == expected_hash, f"Wrong copied file: {symbol}"
    data = path.read_bytes()
    version, record_size, count, scale = struct.unpack_from("<HHII", data, 4)
    header_symbol = data[16:48].rstrip(b"\0").decode("ascii")
    exchange = data[48:64].rstrip(b"\0").decode("ascii")
    assert data[:4] == b"EOD1" and version == 1 and record_size == 64
    assert header_symbol == symbol and exchange == "NSE" and scale > 0
    assert len(data) == 128 + count * 64, f"Truncated/trailing data: {symbol}"
    bars = []
    for i in range(count):
        date, flags, o, h, low, close, prev, volume, oi = struct.unpack_from("<IIqqqqqQQ", data, 128 + i * 64)
        bars.append(dict(date=iso(date), flags=flags, open=o/scale, high=h/scale,
                         low=low/scale, close=close/scale, prev_close_field=prev/scale,
                         volume=volume, open_interest=oi))
    assert all(a["date"] < b["date"] for a, b in zip(bars, bars[1:])), symbol
    series[symbol] = bars
    inventory[symbol] = dict(relative_path=f"eod_data/NSE/{symbol}.eod", sha256=expected_hash,
                             bytes=len(data), records=count, scale=scale,
                             first_date=bars[0]["date"], last_date=bars[-1]["date"])

evidence = dict(sqlite_sha256=DATABASE_HASH, eod_files=inventory, events=[])
for symbol, date, expected in EVENTS:
    bars = series[symbol]
    index = bisect.bisect_left([bar["date"] for bar in bars], date)
    previous = bars[index-1] if index else None
    ex = bars[index] if index < len(bars) else None
    neighborhood = bars[max(0, index-20):index+21]
    item = dict(symbol=symbol, official_ex_date=date, expected_combined_factor=expected,
                previous=previous, selected_ex=ex,
                exact_ex_date_present=ex is not None and ex["date"] == date,
                context=bars[max(0, index-4):index+5],
                nearby_range=[neighborhood[0]["date"], neighborhood[-1]["date"]],
                nearby_close_range=[min(b["close"] for b in neighborhood), max(b["close"] for b in neighborhood)],
                nearby_large_jumps=[], nearby_expected_factor_matches=[])
    if previous and ex:
        actual_open = previous["close"] / ex["open"] if ex["open"] > 0 else None
        actual_close = previous["close"] / ex["close"] if ex["close"] > 0 else None
        item.update(actual_open_factor=actual_open, actual_close_factor=actual_close,
                    open_jump_pct=100*(ex["open"]/previous["close"]-1),
                    close_jump_pct=100*(ex["close"]/previous["close"]-1),
                    selected_ex_calendar_days_after=(dt.date.fromisoformat(ex["date"])-dt.date.fromisoformat(date)).days,
                    stored_pair_calendar_gap=(dt.date.fromisoformat(ex["date"])-dt.date.fromisoformat(previous["date"])).days,
                    existing_scanner_confidence=max(1-min(abs(actual-expected)/expected, 1)
                                                    for actual in [actual_open, actual_close] if actual is not None))
    for i in range(max(1, index-20), min(len(bars), index+21)):
        p, b = bars[i-1], bars[i]
        if p["close"] <= 0 or b["open"] <= 0 or b["close"] <= 0:
            continue
        opening, closing = p["close"]/b["open"], p["close"]/b["close"]
        pair = dict(previous_date=p["date"], date=b["date"], previous_close=p["close"],
                    open=b["open"], close=b["close"], prev_close_field=b["prev_close_field"],
                    actual_open_factor=opening, actual_close_factor=closing,
                    offset_in_stored_records=i-index)
        if opening > 1.3 or opening < 0.7:
            item["nearby_large_jumps"].append(pair)
        if min(abs(opening-expected), abs(closing-expected))/expected <= 0.15:
            item["nearby_expected_factor_matches"].append(pair)
    imports = [dict(r) for r in db.execute("SELECT id,action_type,factor,purpose_raw FROM corporate_action_imports "
                                          "WHERE symbol=? AND exchange='NSE' AND ex_date=? "
                                          "AND action_type IN ('SPLIT','BONUS') ORDER BY id", (symbol, date))]
    for row in imports:
        scan = db.execute("SELECT * FROM corporate_action_scan_results WHERE corporate_action_import_id=? ORDER BY id DESC LIMIT 1", (row["id"],)).fetchone()
        row["latest_scan"] = dict(scan) if scan else None
        row["saved_window_matches_copy"] = bool(scan and previous and ex
            and scan["prev_trade_date"] == previous["date"] and scan["ex_trade_date"] == ex["date"]
            and scan["prev_close"] == previous["close"] and scan["ex_open"] == ex["open"] and scan["ex_close"] == ex["close"])
    item["imports"] = imports
    item["stored_actions_on_date"] = [dict(r) for r in db.execute("SELECT * FROM corporate_actions WHERE symbol=? AND exchange='NSE' AND effective_date=?", (symbol, date))]
    evidence["events"].append(item)

evidence["shared_missing_ranges"] = {
    symbol: {"2013-09-04_through_2013-10-04": sum("2013-09-04" <= b["date"] <= "2013-10-04" for b in bars),
             "2025-05": sum(b["date"].startswith("2025-05-") for b in bars)}
    for symbol, bars in series.items()
}
db.close()
assert sha(DATABASE) == DATABASE_HASH
assert all(sha(ROOT / "eod_data" / "NSE" / (symbol + ".eod")) == expected for symbol, expected in HASHES.items())
write_json("EOD_COPY_SHA256.json", dict(copy_verified_date_ist="2026-11-07",
                                      method="User-provided closed-app Copy-Item block; source/destination SHA-256 match",
                                      files=inventory))
write_json("remaining-eod-evidence.json", evidence)
print("PASS: seven pinned EOD1 fixtures decoded; SQLite and EOD hashes unchanged")
for item in evidence["events"]:
    print(item["symbol"], item["official_ex_date"], "exact date:", item["exact_ex_date_present"],
          "factors:", item.get("actual_open_factor"), item.get("actual_close_factor"),
          "nearby expected-factor matches:", len(item["nearby_expected_factor_matches"]))
