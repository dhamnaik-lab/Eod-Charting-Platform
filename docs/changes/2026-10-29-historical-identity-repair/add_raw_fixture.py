"""Add two unchanged raw-price copies to the retained test fixture, never production."""
import hashlib
import json
from pathlib import Path
import shutil

project = Path(__file__).resolve().parents[3]
fixture = project / 'tmp/nse-historical-repair-fde3f3e95dc4'
assert fixture.resolve().is_relative_to((project / 'tmp').resolve())
assert (fixture / 'HISTORICAL_REPAIR_FIXTURE_ONLY.txt').is_file()
source = Path(json.loads((fixture / 'snapshot-receipt.json').read_text())['sourceRoot'])
evidence = {}
for symbol in ('AMIRCHAND', 'AEROPLANE'):
    original = source / 'eod_data/NSE' / (symbol + '.eod')
    target = fixture / 'eod_data/NSE' / original.name
    assert not target.exists(), 'refuse overwrite'
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(original, target)
    digest = hashlib.sha256(original.read_bytes()).hexdigest()
    assert hashlib.sha256(target.read_bytes()).hexdigest() == digest
    evidence[symbol] = {'source': str(original), 'copy': str(target), 'sha256': digest}
(fixture / 'raw-copy-receipt.json').write_text(json.dumps(evidence, indent=2), encoding='utf-8')
print(json.dumps(evidence))
