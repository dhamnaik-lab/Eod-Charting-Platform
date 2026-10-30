"""Logical reconstruction on Python objects only; never writes SQLite or runs app code."""
import copy
import collections
import datetime

def reconstruct(instruments, history, symbol_rows, name_rows, current_eq):
    instruments = {r['symbol']: copy.deepcopy(r) for r in instruments}
    history = copy.deepcopy(history)
    persisted_ids = {r['id'] for r in history}
    counts = collections.Counter()
    errors = []
    included = set(instruments) | set(current_eq)
    while True:
        before = len(included)
        for r in symbol_rows:
            if r['oldsymbol'] in included or r['newsymbol'] in included:
                included.update([r['oldsymbol'], r['newsymbol']])
        if before == len(included):
            break
    day = lambda value: datetime.datetime.strptime(value, '%d-%b-%Y').date().isoformat()
    paired = {}
    for r in sorted(name_rows, key=lambda r: (day(r['effectivedate']), r['symbol'])):
        if r['symbol'] in included:
            paired[(r['symbol'], day(r['effectivedate']))] = r
        else:
            counts['skipped'] += 1

    def context(seed):
        aliases = [r for r in history if seed in [r['old_symbol'], r['new_symbol'], r['current_symbol']]]
        alias = max(aliases, key=lambda r: (r['effective_date'], r['id'])) if aliases else {}
        symbol = alias.get('current_symbol') or alias.get('new_symbol') or seed
        inst = instruments.get(symbol) or instruments.get(seed) or {}
        if not alias and not inst:
            return None
        name = inst.get('name') or alias.get('current_name') or alias.get('new_name') or alias.get('old_name')
        isin = inst.get('isin') or alias.get('isin') or (instruments.get(seed) or {}).get('isin')
        at, later, seen, depth = symbol, None, {symbol}, 0
        while True:
            # Match the chart query's distinct predecessor grouping; names are not group keys.
            edges = {}
            for r in history:
                if r['new_symbol'] == at and r['change_type'] in ['SYMBOL_CHANGE', 'BOTH']:
                    key = tuple(r[k] for k in ['exchange', 'isin', 'current_symbol', 'old_symbol', 'new_symbol', 'effective_date', 'change_type'])
                    if key not in edges or r['id'] < edges[key]['id']:
                        edges[key] = r
            if not edges:
                break
            if len(edges) != 1:
                error = ValueError('Ambiguous chart predecessor history for NSE:' + at + '.')
                error.edges = [{k: r[k] for k in ['id', 'isin', 'current_symbol', 'old_symbol', 'new_symbol', 'effective_date', 'change_type']}
                               | {'origin': 'persisted' if r['id'] in persisted_ids else 'logical_new'} for r in edges.values()]
                raise error
            edge = next(iter(edges.values()))
            if depth == 32:
                raise ValueError('Chart predecessor history exceeds 32 transitions.')
            if edge['old_symbol'] in seen:
                raise ValueError('Chart predecessor history contains a cycle.')
            if later and edge['effective_date'] >= later:
                raise ValueError('Chart predecessor dates must increase along the rename chain.')
            seen.add(edge['old_symbol']); at = edge['old_symbol']; later = edge['effective_date']; depth += 1
        return {'current_symbol': symbol, 'name': name, 'isin': isin}

    def record(kind, seed, old, old_name, new_name, current_name, effective):
        try:
            ctx = context(seed) or {}
            new = seed
            old = old or (ctx.get('current_symbol') if kind == 'NAME_CHANGE' else seed)
            old_inst = instruments.get(old) or {}
            new_inst = instruments.get(new) or {}
            old_name = old_name or old_inst.get('name') or ctx.get('name') or new_inst.get('name')
            new_name = new_name or current_name or new_inst.get('name') or ctx.get('name') or old_name
            current_name = current_name or new_name or old_name
            if kind in ['SYMBOL_CHANGE', 'BOTH'] and (not old or not new or old == new):
                raise ValueError('Symbol changes require different old and new symbols.')
            if kind in ['NAME_CHANGE', 'BOTH'] and (not old_name or not new_name or old_name == new_name):
                raise ValueError('Name changes require different old and new names.')
            if any(r['effective_date'] == effective and r['change_type'] == kind and
                   tuple(r[k] or '' for k in ['old_symbol', 'new_symbol', 'old_name', 'new_name']) ==
                   tuple(v or '' for v in [old, new, old_name, new_name]) for r in history):
                counts['duplicate'] += 1
                return
            isin = ctx.get('isin')
            history.append({'id': max((r['id'] for r in history), default=0) + 1, 'exchange': 'NSE', 'isin': isin,
                            'current_symbol': new, 'current_name': current_name, 'old_symbol': old, 'new_symbol': new,
                            'old_name': old_name, 'new_name': new_name, 'effective_date': effective, 'change_type': kind})
            inst = instruments.setdefault(new, {'symbol': new, 'isin': None, 'name': None})
            inst.update({'isin': isin or inst.get('isin'), 'name': current_name or inst.get('name'), 'is_active': 1})
            if old != new and old in instruments:
                instruments[old]['is_active'] = 0
            for r in history:
                if r['current_symbol'] == new or (old is not None and r['old_symbol'] == old) or r['new_symbol'] == new or (isin and r['isin'] == isin):
                    r['current_symbol'] = new; r['current_name'] = current_name; r['isin'] = isin or r['isin']
            counts[kind] += 1
        except ValueError as error:
            counts['error'] += 1
            errors.append({'type': kind, 'symbol': seed, 'old_symbol': old, 'date': effective, 'reason': str(error)})
            if hasattr(error, 'edges'):
                errors[-1]['predecessor_edges'] = error.edges

    for r in sorted(symbol_rows, key=lambda r: (day(r['effectivedate']), r['newsymbol'], r['oldsymbol'])):
        if r['oldsymbol'] not in included and r['newsymbol'] not in included:
            counts['skipped'] += 1
            continue
        effective = day(r['effectivedate'])
        name = paired.pop((r['newsymbol'], effective), None)
        record('BOTH' if name else 'SYMBOL_CHANGE', r['newsymbol'], r['oldsymbol'],
               name['oldnameofthecompany'] if name else None,
               name['newnameofthecompany'] if name else None,
               name['newnameofthecompany'] if name else r.get('nameofthecompany'), effective)
    for r in sorted(paired.values(), key=lambda r: (day(r['effectivedate']), r['symbol'])):
        record('NAME_CHANGE', r['symbol'], None, r['oldnameofthecompany'], r['newnameofthecompany'], r['newnameofthecompany'], day(r['effectivedate']))
    return {'counts': dict(counts), 'errors': errors,
            'method': 'Python logical reconstruction, not native application execution; no persistent changes.'}
