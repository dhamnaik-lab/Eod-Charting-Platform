"""Read-only investigation of the user's already-completed historical Apply."""
import hashlib
import json
from pathlib import Path
import sqlite3

project = Path(__file__).resolve().parents[3]
registry = Path('C:/Users/dharm/OneDrive/Documents/EOD Chart Profile/database-registry.json')
root = Path(json.loads(registry.read_text(encoding='utf-8-sig'))['lastActivePath'])
manifest = json.loads((root / 'database.json').read_text(encoding='utf-8-sig'))

def read(path):
    c = sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA query_only=ON')
    c.execute('BEGIN')
    return c

live = read(root / manifest['dbFile'])
baseline = read(project / 'tmp/nse-historical-repair-fde3f3e95dc4/fixture.sqlite3')
tables = ('corporate_actions','corporate_action_import_decisions','corporate_action_event_identity_resolutions')
def digest(c, table):
    rows = [tuple(r) for r in c.execute('SELECT * FROM ' + table)]
    encoded = sorted(json.dumps(r, default=str, ensure_ascii=True) for r in rows)
    return hashlib.sha256('\n'.join(encoded).encode()).hexdigest()

raw = json.loads((project / 'tmp/nse-historical-repair-fde3f3e95dc4/raw-copy-receipt.json').read_text())
decision_table = 'corporate_action_import_decisions'
decision_columns = [row[1] for row in live.execute('PRAGMA table_info(' + decision_table + ')')]
before_decisions = {tuple(row) for row in baseline.execute('SELECT * FROM ' + decision_table)}
after_decisions = {tuple(row) for row in live.execute('SELECT * FROM ' + decision_table)}
result = {
    'database': str(root),
    'symbols': [dict(r) for r in live.execute("SELECT symbol,is_active,lifecycle_status FROM instruments WHERE exchange='NSE' AND symbol IN ('AMIRCHAND','AEROPLANE') ORDER BY symbol")],
    'transition': [dict(r) for r in live.execute("SELECT old_symbol,new_symbol,effective_date,change_type,created_at,source FROM instrument_identity_history WHERE exchange='NSE' AND old_symbol='AMIRCHAND' AND new_symbol='AEROPLANE'")],
    'recentHistoryGroups': [dict(r) for r in live.execute("SELECT created_at,change_type,COUNT(*) AS count FROM instrument_identity_history WHERE exchange='NSE' AND source='NSE_IDENTITY' GROUP BY created_at,change_type ORDER BY created_at DESC LIMIT 3")],
    'financialTablesMatchPreApplySnapshot': {table: digest(live,table) == digest(baseline,table) for table in tables},
    'rawFilesMatchPreApplySnapshot': {symbol: hashlib.sha256(Path(item['source']).read_bytes()).hexdigest() == item['sha256'] for symbol,item in raw.items()},
    'hasHistoricalRunReceipts': live.execute("SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name='historical_identity_apply_runs')").fetchone()[0] == 1,
    'laterAddedImportDecisions': [dict(zip(decision_columns, row)) for row in sorted(after_decisions - before_decisions)],
    'removedImportDecisions': len(before_decisions - after_decisions),
    'totalChanges': live.total_changes,
    'limitation': 'Persisted-row evidence only; the old application did not save a complete historical Apply receipt.',
}
assert live.total_changes == 0 and baseline.total_changes == 0
for c in (live, baseline):
    c.rollback()
    c.close()
Path(__file__).with_name('completed-apply-audit.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result))
