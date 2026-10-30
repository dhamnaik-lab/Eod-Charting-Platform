"""Read-only AMIRCHAND identity investigation. Writes evidence only beside this script."""
import csv
import hashlib
import json
from pathlib import Path
import sqlite3
import struct

HERE = Path(__file__).resolve().parent
registry = Path("C:/Users/dharm/OneDrive/Documents/EOD Chart Profile/database-registry.json")
root = Path(json.loads(registry.read_text(encoding="utf-8-sig"))["lastActivePath"])
manifest = json.loads((root / "database.json").read_text(encoding="utf-8-sig"))
connection = sqlite3.connect((root / manifest["dbFile"]).resolve().as_uri() + "?mode=ro", uri=True)
connection.row_factory = sqlite3.Row
connection.execute("PRAGMA query_only=ON")
connection.execute("BEGIN")

def query(sql):
    return [dict(row) for row in connection.execute(sql)]

def csv_rows(path):
    data = path.read_bytes()
    with path.open(encoding="utf-8-sig", newline="") as file:
        records = [{key.strip(): value.strip() for key, value in row.items()} for row in csv.DictReader(file)]
    return records, {"path": str(path), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}

try:
    evidence = {"databaseRoot": str(root), "readOnly": True, "queryOnly": connection.execute("PRAGMA query_only").fetchone()[0]}
    evidence["instruments"] = query("SELECT * FROM instruments WHERE exchange='NSE' AND (symbol IN ('AMIRCHAND','AEROPLANE') OR isin='INE05TO01019')")
    evidence["persistedHistory"] = query("SELECT * FROM instrument_identity_history WHERE exchange='NSE' AND (old_symbol IN ('AMIRCHAND','AEROPLANE') OR new_symbol IN ('AMIRCHAND','AEROPLANE') OR current_symbol IN ('AMIRCHAND','AEROPLANE') OR isin='INE05TO01019')")
    evidence["sqlitePriceCounts"] = query("SELECT symbol,COUNT(*) bars,MIN(date) first_date,MAX(date) last_date FROM eod_prices WHERE exchange='NSE' AND symbol IN ('AMIRCHAND','AEROPLANE') GROUP BY symbol")
    identity = root / "reference-data/NSE/Identity"
    current = {}
    sources = []
    for name in ["nse_identity_securities_available_equity.csv", "nse_identity_securities_available_sme.csv"]:
        records, source = csv_rows(identity / "SecuritiesAvailable" / name)
        current.update({row["SYMBOL"]: row for row in records})
        source["matchedRows"] = [row for row in records if row["SYMBOL"] in ("AMIRCHAND", "AEROPLANE") or row.get("ISIN NUMBER") == "INE05TO01019"]
        sources.append(source)
    changes, source = csv_rows(identity / "SymbolChanges/nse_identity_symbol_changes.csv")
    source["matchedRows"] = [row for row in changes if row["OLD SYMBOL"] == "AMIRCHAND" or row["NEW SYMBOL"] == "AEROPLANE"]
    sources.append(source)
    evidence["savedSources"] = sources
    active = query("SELECT symbol,isin,series FROM instruments WHERE exchange='NSE' AND is_active=1")
    absent = [row for row in active if row["series"] in ("EQ", "BE", "BZ", "SM", "ST", "SZ") and row["symbol"] not in current]
    candidates = []
    for row in absent:
        for edge in changes:
            if edge["OLD SYMBOL"] == row["symbol"] and edge["NEW SYMBOL"] in current:
                target = current[edge["NEW SYMBOL"]]
                candidates.append({"oldSymbol": row["symbol"], "newSymbol": edge["NEW SYMBOL"], "effectiveDate": edge["EFFECTIVE DATE"], "oldIsin": row["isin"], "currentMasterIsin": target.get("ISIN NUMBER"), "sameFullIsin": row["isin"] == target.get("ISIN NUMBER")})
    evidence["coveredAbsentActiveCount"] = len(absent)
    evidence["directCurrentSuccessorCandidates"] = candidates
    evidence["binaryFiles"] = []
    all_dates = set()
    for symbol in ("AMIRCHAND", "AEROPLANE"):
        path = root / "eod_data/NSE" / (symbol + ".eod")
        data = path.read_bytes()
        assert data[:4] == b"EOD1", path
        version, size, count, scale = struct.unpack_from("<HHII", data, 4)
        assert size == 64 and len(data) == 128 + count * size
        records = [struct.unpack_from("<IIqqqqqQQ", data, 128 + i * size) for i in range(count)]
        dates = [record[0] for record in records]
        all_dates.update(dates)
        evidence["binaryFiles"].append({"path": str(path), "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "version": version, "records": count, "firstDate": min(dates), "lastDate": max(dates), "beforeRename": sum(date < 20260720 for date in dates), "onOrAfterRename": sum(date >= 20260720 for date in dates), "lastClose": records[-1][5] / scale})
    evidence["combinedDistinctRawDates"] = len(all_dates)
    evidence["officialCircular"] = {"url": "https://nsearchives.nseindia.com/content/circulars/CML75196.pdf", "reference": "NSE/CML/75196", "issued": "2026-07-14", "effective": "2026-07-20", "oldSymbol": "AMIRCHAND", "newSymbol": "AEROPLANE", "verification": "Official PDF opened and parsed through web tool in this investigation"}
    evidence["totalChanges"] = connection.total_changes
    assert connection.total_changes == 0
finally:
    connection.rollback()
    connection.close()

(HERE / "evidence.json").write_text(json.dumps(evidence, indent=2), encoding="utf-8")
print(json.dumps({"persistedHistoryRows": len(evidence["persistedHistory"]), "coveredAbsentActive": len(absent), "directSuccessorCandidates": len(candidates), "combinedDistinctRawDates": len(all_dates), "totalChanges": evidence["totalChanges"]}))
