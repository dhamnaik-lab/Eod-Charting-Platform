"""Read-only source/SQLite census. Does not invoke application preview or Apply."""
import collections
import csv
import datetime
import hashlib
import json
import re
import sqlite3
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from historical_model import reconstruct

PROJECT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
registry_path = Path('C:/Users/dharm/OneDrive/Documents/EOD Chart Profile/database-registry.json')
registry = json.loads(registry_path.read_text(encoding='utf-8-sig'))
root = Path(registry['lastActivePath'])
assert root.resolve() == (PROJECT / 'EOD DATABASE').resolve()
manifest = json.loads((root / 'database.json').read_text(encoding='utf-8-sig'))
db = root / manifest['dbFile']
source_root = root / 'reference-data/NSE/Identity'
allowed = {'EQ', 'BE', 'BZ', 'SM', 'ST', 'SZ'}
inputs = {}

def capture(path):
    data = path.read_bytes()
    inputs[str(path)] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                         'modified_utc': datetime.datetime.fromtimestamp(path.stat().st_mtime, datetime.timezone.utc).isoformat()}
    return data

def norm(value):
    return re.sub('[^a-z0-9]', '', value.lower())

def rows(path):
    capture(path)
    with path.open(encoding='utf-8-sig', newline='') as handle:
        return [{norm(k): (v or '').strip() for k, v in row.items() if k is not None}
                for row in csv.DictReader(handle)]

master = {}
master_raw = []
for name in ['nse_identity_securities_available_equity.csv', 'nse_identity_securities_available_sme.csv']:
    for row in rows(source_root / 'SecuritiesAvailable' / name):
        if row.get('series') in allowed:
            master_raw.append(row)
            master.setdefault(row['symbol'].upper(), row)
symbols = rows(source_root / 'SymbolChanges/nse_identity_symbol_changes.csv')
names = rows(source_root / 'CompanyNameChanges/nse_identity_company_name_changes.csv')
date = lambda value: datetime.datetime.strptime(value, '%d-%b-%Y').date().isoformat()

workbook = source_root / 'Delisted/nse_identity_delisted_companies.xlsx'
capture(workbook)
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(workbook) as z:
    shared = [''.join(node.itertext()) for node in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si', ns)] if 'xl/sharedStrings.xml' in z.namelist() else []
    sheet = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    sheet_rows = []
    for row in sheet.findall('.//s:row', ns):
        cells = {}
        for cell in row.findall('s:c', ns):
            column = re.match('[A-Z]+', cell.attrib['r'])[0]
            value = cell.find('s:v', ns)
            text = value.text if value is not None else ''.join(cell.find('s:is', ns).itertext()) if cell.find('s:is', ns) is not None else ''
            cells[column] = shared[int(text)] if cell.attrib.get('t') == 's' and text else text
        sheet_rows.append(cells)
    symbol_column = next(column for row in sheet_rows[:20] for column, value in row.items() if norm(value) in {'symbol', 'securitysymbol', 'symbolofcompany'})
    delisted = {row.get(symbol_column, '').strip().upper() for row in sheet_rows
                if norm(row.get(symbol_column, '')) not in {'symbol', 'securitysymbol', 'symbolofcompany'}
                and re.search('[a-zA-Z]', row.get(symbol_column, ''))}

queries = []
c = sqlite3.connect(db.resolve().as_uri() + '?mode=ro', uri=True)
c.row_factory = sqlite3.Row
c.execute('PRAGMA query_only=ON')
c.execute('BEGIN')
def query(sql):
    queries.append(sql)
    return [dict(row) for row in c.execute(sql)]

try:
    instruments = query("SELECT symbol,exchange,isin,name,series,is_active,lifecycle_status,updated_at FROM instruments WHERE exchange='NSE'")
    history = query("SELECT * FROM instrument_identity_history WHERE exchange='NSE'")
    by_symbol = {row['symbol']: row for row in instruments}
    mapping, conflicts = {}, set()
    for row in history:
        target = row['current_symbol'] if row['current_symbol'] is not None else row['new_symbol']
        for field in ['current_symbol', 'old_symbol', 'new_symbol']:
            key = row[field]
            if not key or not target or key in conflicts:
                continue
            if key in mapping and mapping[key] != target:
                mapping.pop(key)
                conflicts.add(key)
            else:
                mapping[key] = target
    proposals = []
    for row in instruments:
        if row['is_active'] and row['symbol'] not in master:
            symbol = row['symbol']
            proposed = 'OLD_SYMBOL' if symbol in mapping else 'DELISTED' if symbol in delisted else 'UNKNOWN_INACTIVE'
            same_isin = [s for s, current in master.items() if row['isin'] and current.get('isinnumber') == row['isin']]
            proposals.append({**row, 'proposed': proposed, 'in_supported_series': row['series'] in allowed,
                              'history_target': mapping.get(symbol), 'history_target_is_self': mapping.get(symbol) == symbol,
                              'in_delisted_workbook': symbol in delisted, 'current_same_full_isin_symbols': same_isin,
                              'rights_suffix_heuristic': bool(re.search(r'-RE\d*$', symbol))})
    existing_matches = [(row, by_symbol[symbol]) for symbol, row in master.items() if symbol in by_symbol]
    updates = sum(bool(old['is_active']) and any(row.get(k) and row[k] != old[field]
                  for k, field in [('nameofcompany', 'name'), ('isinnumber', 'isin'), ('series', 'series')])
                  for row, old in existing_matches)
    insert = [symbol for symbol in master if symbol not in by_symbol]
    reactivate = sum(not old['is_active'] for _, old in existing_matches)
    # Historical admission seeds only EQ rows, then extends with every persisted NSE symbol.
    included = {symbol for symbol, row in master.items() if row['series'] == 'EQ'} | set(by_symbol)
    while True:
        old_count = len(included)
        for row in symbols:
            if row['oldsymbol'] in included or row['newsymbol'] in included:
                included.update([row['oldsymbol'], row['newsymbol']])
        if len(included) == old_count:
            break
    name_keys = {(row['symbol'], date(row['effectivedate'])): row for row in names if row['symbol'] in included}
    errors = []
    for line, row in enumerate(symbols, 2):
        if row['oldsymbol'] == row['newsymbol']:
            name = name_keys.get((row['newsymbol'], date(row['effectivedate'])))
            errors.append({'source_record': line, **row, 'included': row['newsymbol'] in included,
                           'payload_type': 'BOTH' if name else 'SYMBOL_CHANGE', 'paired_name_row': name,
                           'reason': 'Symbol changes require different old and new symbols.'})
    sgb_history = [row for row in history if row['old_symbol'] in {'GBNOV23', 'SBNOV23', 'SGBNOV23'} or row['new_symbol'] in {'GBNOV23', 'SBNOV23', 'SGBNOV23'}]
    sgb_source = [row for row in symbols if row['oldsymbol'] in {'GBNOV23', 'SBNOV23', 'SGBNOV23'} or row['newsymbol'] in {'GBNOV23', 'SBNOV23', 'SGBNOV23'}]
    same_names = [{'source_record': line, **row, 'included': row['symbol'] in included}
                  for line, row in enumerate(names, 2) if row['oldnameofthecompany'] == row['newnameofthecompany']]
    for row in proposals:
        row['source_symbol_change_edges'] = [edge for edge in symbols if edge['oldsymbol'] == row['symbol']]
    historical = reconstruct(instruments, history, symbols, names, {s for s, r in master.items() if r['series'] == 'EQ'})
    summary = {'database_path': str(db), 'captured_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'read_only': True, 'query_only': c.execute('PRAGMA query_only').fetchone()[0],
               'total_changes': c.total_changes, 'source_inputs': inputs,
               'current_master': {'supported_raw_rows': len(master_raw), 'unique_symbols': len(master), 'exact_matches': len(existing_matches),
                                  'insert': len(insert), 'reactivate_existing': reactivate, 'activate_total': reactivate + len(insert),
                                  'update': updates, 'unchanged': len(existing_matches) - reactivate - updates,
                                  'insert_symbols': insert, 'delisted_workbook_symbols': len(delisted)},
               'deactivations': {'total': len(proposals), 'outside_supported_series': sum(not r['in_supported_series'] for r in proposals),
                                 'within_supported_series': sum(r['in_supported_series'] for r in proposals),
                                 'by_proposed': dict(collections.Counter(r['proposed'] for r in proposals)),
                                 'supported_by_proposed': dict(collections.Counter(r['proposed'] for r in proposals if r['in_supported_series'])),
                                 'supported_series': dict(collections.Counter(r['series'] for r in proposals if r['in_supported_series'])),
                                 'rights_suffix_heuristic_supported': sum(r['rights_suffix_heuristic'] for r in proposals if r['in_supported_series']),
                                 'supported_inf_prefix': sum((r['isin'] or '').startswith('INF') for r in proposals if r['in_supported_series']),
                                 'supported_same_isin_current_match': sum(bool(r['current_same_full_isin_symbols']) for r in proposals if r['in_supported_series']),
                                 'self_history_targets': sum(r['history_target_is_self'] for r in proposals)},
               'same_symbol_source_errors': errors, 'sgb_persisted_history': sgb_history, 'sgb_source_rows': sgb_source,
               'same_name_source_rows': same_names,
               'historical_logical_reconstruction': historical,
               'limits': 'Read-only reconstruction; no native preview, write transaction, repair, test or approval run.'}
    assert c.total_changes == 0
    (OUT / 'evidence.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    (OUT / 'deactivation-records.json').write_text(json.dumps(sorted(proposals, key=lambda r: r['symbol']), indent=2), encoding='utf-8')
    (OUT / 'queries.json').write_text(json.dumps(queries, indent=2), encoding='utf-8')
    print(json.dumps({k: summary[k] for k in ['current_master', 'deactivations', 'total_changes']}, indent=2))
finally:
    c.rollback()
    c.close()
