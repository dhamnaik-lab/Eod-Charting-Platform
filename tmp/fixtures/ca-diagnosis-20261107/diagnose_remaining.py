"""Inspect only the hash-pinned SQLite main file; never discover/open a live DB."""
import hashlib
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATABASE = ROOT / "market-data.sqlite3"
EXPECTED = "774555A7FE16A67963F1034974B66D8AE90394CE0ECE0D9AA1ED5594157FCDE7"
EVENTS = [
    ("SBIN", "2014-11-20"), ("BRITANNIA", "2010-09-08"),
    ("BRITANNIA", "2010-03-08"), ("JMFINANCIL", "2008-09-08"),
    ("AJANTPHARM", "2013-09-17"), ("NAVKARURB", "2025-05-09"),
    ("JSWSTEEL", "2017-01-04"), ("PCBL", "2018-04-19"),
    ("CGCL", "2016-11-23"), ("AVANTIFEED", "2018-06-26"),
]


def hashes():
    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest().upper()
            for p in [DATABASE, Path(str(DATABASE) + "-wal"), Path(str(DATABASE) + "-shm")]
            if p.exists()}


before = hashes()
assert before[DATABASE.name] == EXPECTED, "Wrong fixture; stop"
# immutable=1 deliberately excludes unpinned WAL/SHM from the supplied main-file
# snapshot. It also prevents SQLite from writing locks or shared-memory metadata.
connection = sqlite3.connect(DATABASE.as_uri() + "?mode=ro&immutable=1", uri=True)
connection.row_factory = sqlite3.Row
connection.execute("PRAGMA query_only=ON")


def rows(sql, params=()):
    return [dict(row) for row in connection.execute(sql, params)]


evidence = {"snapshot": "Pinned main file only; sidecars excluded", "hashes": before, "events": []}
for symbol, date in EVENTS:
    imports = rows("SELECT * FROM corporate_action_imports WHERE exchange='NSE' AND symbol=? "
                   "AND ex_date=? AND action_type IN ('SPLIT','BONUS') ORDER BY id", (symbol, date))
    event = {"symbol": symbol, "date": date, "imports": imports,
             "instrument": rows("SELECT * FROM instruments WHERE exchange='NSE' AND symbol=?", (symbol,)),
             "history": rows("SELECT * FROM instrument_isin_history WHERE exchange='NSE' AND symbol=?", (symbol,)),
             "sql_bar_count": connection.execute("SELECT count(*) FROM eod_prices WHERE exchange='NSE' AND symbol=?", (symbol,)).fetchone()[0],
             "nearby_sql_bars": rows("SELECT date,open,close FROM eod_prices WHERE exchange='NSE' AND symbol=? "
                                     "AND date BETWEEN date(?,'-45 days') AND date(?,'+45 days') ORDER BY date", (symbol, date, date)),
             "identity_links": rows("SELECT * FROM instrument_identity_history WHERE exchange='NSE' AND "
                                    "(old_symbol=? OR new_symbol=? OR current_symbol=?)", (symbol, symbol, symbol))}
    for row in imports:
        row["latest_scan"] = rows("SELECT * FROM corporate_action_scan_results WHERE corporate_action_import_id=? ORDER BY id DESC LIMIT 1", (row["id"],))
        row["current_raw_isin_owners"] = rows("SELECT symbol,exchange,isin,is_active FROM instruments WHERE upper(isin)=?", (row["isin"],))
        row["historical_raw_isin_owners"] = rows("SELECT symbol,exchange,isin,effective_date,source FROM instrument_isin_history WHERE upper(isin)=?", (row["isin"],))
    evidence["events"].append(event)
connection.close()
assert before == hashes(), "Fixture or sidecars changed during inspection"
with (ROOT / "remaining-evidence.json").open("w", encoding="utf-8", newline="\r\n") as output:
    json.dump(evidence, output, indent=2, ensure_ascii=False)
    output.write("\n")
print("PASS: pinned main-file hash and all existing sidecar hashes unchanged")
for event in evidence["events"]:
    print(event["symbol"], event["date"], "SQL bars:", event["sql_bar_count"])
