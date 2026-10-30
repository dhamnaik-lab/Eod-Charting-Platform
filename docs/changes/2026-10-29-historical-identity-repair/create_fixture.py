"""Create a retained, guarded DB/source fixture. Source database is read-only."""
import hashlib
import json
from pathlib import Path
import shutil
import sqlite3
import uuid

project = Path(__file__).resolve().parents[3]
registry = Path('C:/Users/dharm/OneDrive/Documents/EOD Chart Profile/database-registry.json')
source = Path(json.loads(registry.read_text(encoding='utf-8-sig'))['lastActivePath'])
manifest = json.loads((source / 'database.json').read_text(encoding='utf-8-sig'))
target = project / 'tmp' / ('nse-historical-repair-' + uuid.uuid4().hex[:12])
target.mkdir(parents=True, exist_ok=False)
db = target / 'fixture.sqlite3'
read = sqlite3.connect((source / manifest['dbFile']).resolve().as_uri() + '?mode=ro', uri=True)
read.execute('PRAGMA query_only=ON')
read.execute('BEGIN')
write = sqlite3.connect(db)
read.backup(write)
write.close()
assert read.total_changes == 0
read.rollback()
read.close()
files = {}
for sub, pattern in [('SecuritiesAvailable', '*.csv'), ('SymbolChanges', '*.csv'), ('CompanyNameChanges', '*.csv'), ('Delisted', '*.xlsx')]:
    for path in (source / 'reference-data/NSE/Identity' / sub).glob(pattern):
        relative = path.relative_to(source / 'reference-data')
        destination = target / 'sources' / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, destination)
        files[str(relative)] = hashlib.sha256(path.read_bytes()).hexdigest()
(target / 'HISTORICAL_REPAIR_FIXTURE_ONLY.txt').write_text('Retained SQLite/source fixture; native preview/apply tests allowed here only. No raw prices copied. Do not auto-delete.\n', encoding='utf-8')
receipt = {'fixture': str(target), 'sourceRoot': str(source), 'sourceTotalChanges': 0, 'snapshotSha256': hashlib.sha256(db.read_bytes()).hexdigest(), 'sourceFilesSha256': files}
(target / 'snapshot-receipt.json').write_text(json.dumps(receipt, indent=2), encoding='utf-8')
print(json.dumps(receipt))
