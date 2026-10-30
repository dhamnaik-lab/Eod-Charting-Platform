"""Summarize retained native proof; query fixture and live DBs read-only."""
import csv
import hashlib
import json
from pathlib import Path
import sqlite3

project = Path(__file__).resolve().parents[3]
fixture = project / 'tmp/nse-historical-repair-fde3f3e95dc4'
assert (fixture / 'HISTORICAL_REPAIR_FIXTURE_ONLY.txt').is_file()
receipt = json.loads((fixture / 'snapshot-receipt.json').read_text())
proof_path = sorted(fixture.glob('apply-proof-*.json'))[-1]
proof = json.loads(proof_path.read_text())
assert proof['oldLifecycle'] == 'OLD_SYMBOL' and proof['oldActive'] == 0
assert proof['financialDigestUnchanged'] and proof['rawHashesUnchanged']
assert proof['sameDayGuardStillRejects']

def read_only(path):
    connection = sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)
    connection.row_factory = sqlite3.Row
    connection.execute('PRAGMA query_only=ON')
    connection.execute('BEGIN')
    return connection

current = set()
for path in (fixture / 'sources/NSE/Identity/SecuritiesAvailable').glob('*.csv'):
    with path.open(encoding='utf-8-sig', newline='') as stream:
        current.update(row['SYMBOL'].strip() for row in csv.DictReader(stream))

before = read_only(fixture / 'fixture.sqlite3')
after = read_only(Path(proof['appliedDatabase']))
inactive = {r[0] for r in before.execute("SELECT symbol FROM instruments WHERE exchange='NSE' AND is_active=0")}
active = {r[0] for r in after.execute("SELECT symbol FROM instruments WHERE exchange='NSE' AND is_active=1")}
unsupported = sorted(inactive.intersection(active).difference(current))
assert not unsupported, unsupported

def covered_absences(connection):
    return [dict(row) for row in connection.execute("SELECT symbol,series FROM instruments WHERE exchange='NSE' AND is_active=1 AND series IN ('EQ','BE','BZ','SM','ST','SZ') ORDER BY symbol") if row['symbol'] not in current]

old_symbols = ('AMIRCHAND','ASHIKA','HEG','ICICIPRULI','KEL','LYPSAGEMS','MANBRO','SANGINITA','SILLYMONKS')
flags = [dict(after.execute("SELECT symbol,is_active,lifecycle_status FROM instruments WHERE exchange='NSE' AND symbol=?", (symbol,)).fetchone()) for symbol in old_symbols]
assert all(row['is_active'] == 0 and row['lifecycle_status'] == 'OLD_SYMBOL' for row in flags)
source = Path(receipt['sourceRoot'])
manifest = json.loads((source / 'database.json').read_text(encoding='utf-8-sig'))
live = read_only(source / manifest['dbFile'])
live_rows = [dict(row) for row in live.execute("SELECT symbol,is_active,lifecycle_status FROM instruments WHERE exchange='NSE' AND symbol IN ('AMIRCHAND','AEROPLANE') ORDER BY symbol")]
live_history = live.execute("SELECT COUNT(*) FROM instrument_identity_history WHERE exchange='NSE' AND old_symbol='AMIRCHAND' AND new_symbol='AEROPLANE'").fetchone()[0]
raw = json.loads((fixture / 'raw-copy-receipt.json').read_text())
raw_match = all(hashlib.sha256(Path(entry['source']).read_bytes()).hexdigest() == entry['sha256'] for entry in raw.values())
assert raw_match
assert hashlib.sha256((fixture / 'fixture.sqlite3').read_bytes()).hexdigest() == receipt['snapshotSha256']
summary = {
    'fixture': str(fixture), 'nativeProof': str(proof_path),
    'appliedDatabase': proof['appliedDatabase'],
    'previewSnapshotSha256Unchanged': True,
    'appliedCounts': {key: proof['applied'][key] for key in ('newSymbolChanges','newNameChanges','newCombinedChanges','duplicateRows','skippedRows','errorRows')},
    'repeatCounts': {key: proof['repeat'][key] for key in ('newSymbolChanges','newNameChanges','newCombinedChanges','errorRows')},
    'coveredActiveAbsencesBefore': len(covered_absences(before)),
    'coveredActiveAbsencesAfter': len(covered_absences(after)),
    'remainingCoveredAbsences': covered_absences(after),
    'unsupportedReactivations': unsupported, 'oldSymbolFlags': flags,
    **{key: proof[key] for key in ('chartCurrentSymbol','chartBars','latestClose','financialDigestUnchanged','rawHashesUnchanged','sameDayGuardStillRejects')},
    'liveProtectionCheck': {'rows': live_rows, 'historyRows': live_history, 'totalChanges': live.total_changes, 'originalRawHashesMatch': raw_match},
}
for connection in (before, after, live):
    assert connection.total_changes == 0
    connection.rollback()
    connection.close()
Path(__file__).with_name('final-evidence.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
print(json.dumps({key: summary[key] for key in ('appliedCounts','repeatCounts','coveredActiveAbsencesBefore','coveredActiveAbsencesAfter','unsupportedReactivations','chartCurrentSymbol','chartBars','liveProtectionCheck')}))
