"""Pinned, offline BSE stock metadata repair. Preview first; never writes price files.

Evidence and recoverable SQLite backups live in the explicitly supplied new
Downloads directory. Apply rechecks the preview and rolls back any unexpected
database change. No application startup, migrations, network or dependencies.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import csv
from datetime import date, datetime, timedelta, timezone
import hashlib
import io
import json
from pathlib import Path
import re
import sqlite3
import struct
import subprocess
import zipfile

ROOT = Path(r"E:\TA Projects\EOD Charting Platform")
DOWNLOADS = Path.home() / "Downloads"
DB = ROOT / "EOD DATABASE/market-data.sqlite3"
MASTER = ROOT / "EOD DATABASE/reference-data/bse/bse-lifecycle-master-20261030_055353_771040200.csv"
MASTER_SHA = "6a141651f483f3148f11332bbbcf64661d12a2b0dd7b0cda2820287e805ff250"
ARCHIVES = {
    "EOD_BSE_ALL01_Inventory_20261103_192139_IST.zip": "1f702dc0e7e4849b82e27be8cf991f91484c52ef72273f780c36e3c7e7a1e861",
    "EOD_BSE_ALL02_OfficialPreview_20261103_232304_IST.zip": "edcce87927375bfad260cc79199b70098497e1a208ffc1a4d5b07b352a088025",
    "EOD_BSE_ALL02_R13_ClassificationPreview_20261103_234355_IST.zip": "b28d7e25617f713053aa7e413a0129cad151a16c4f51d05ff402ae1d9103c784",
}
OLDER_MASTERS = {
    "bse-lifecycle-master-20260703_083245.csv": "4fb08b297047370c62d316d7162f8565b6efd3f12b84453c59409858f26fa1d3",
    "bse-lifecycle-master-20260703_205235.csv": "979722a831baf7a0aa07041501c45f1d5f50483c643f721fbedb9b4d7476c46a",
}
IST = timezone(timedelta(hours=5, minutes=30))
EXCLUDED = {"TCS", "RELIANCE", "HYUNDAI"}
SQL = """UPDATE instruments SET bse_security_code=:code
 WHERE exchange='BSE' AND symbol=:symbol AND isin=:isin
 AND (bse_security_code IS NULL OR trim(bse_security_code)='')
 AND symbol NOT LIKE '%#' AND NOT(length(symbol)=6 AND symbol NOT GLOB '*[^0-9]*')
 AND (SELECT count(*) FROM instruments WHERE exchange='BSE' AND isin=:isin AND symbol NOT LIKE '%#')=1
 AND NOT EXISTS(SELECT 1 FROM instruments WHERE exchange='BSE' AND bse_security_code=:code)
 AND NOT EXISTS(SELECT 1 FROM instruments WHERE exchange='BSE' AND symbol=:code
   AND isin IS NOT NULL AND trim(isin)<>'' AND isin<>:isin)"""


def require(condition, reason):
    if not condition:
        raise RuntimeError(reason)


def sha(path):
    with path.open("rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()


def write_json(path, value):
    with path.open("x", encoding="utf-8") as f:
        json.dump(value, f, indent=2, ensure_ascii=False)


def write_csv(path, rows):
    with path.open("x", newline="", encoding="utf-8-sig") as f:
        fields = list(dict.fromkeys(k for row in rows for k in row))
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)


def closed_app():
    listing = subprocess.check_output(
        ["tasklist", "/FO", "CSV", "/NH"], text=True, encoding="utf-8", errors="replace"
    )
    require(not any(r and r[0].lower() == "eod chart.exe" for r in csv.reader(io.StringIO(listing))),
            "Close EOD Chart before preview/apply; no force termination is performed")


def ro(path):
    c = sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True, timeout=15)
    c.execute("PRAGMA query_only=ON")
    return c


def db_state():
    return {suffix or "main": {"bytes": p.stat().st_size, "sha256": sha(p)}
            for suffix in ("", "-wal", "-journal") if (p := Path(str(DB) + suffix)).exists()}


def authority():
    result = {"master": str(MASTER), "master_sha256": sha(MASTER), "archives": {}, "source_pins": {}}
    require(result["master_sha256"] == MASTER_SHA, "Official master authority changed")
    for name, expected in ARCHIVES.items():
        actual = sha(DOWNLOADS / name)
        require(actual == expected, "Archive authority changed: " + name)
        result["archives"][name] = actual
    with zipfile.ZipFile(DOWNLOADS / next(iter(ARCHIVES))) as z:
        names = [n for n in z.namelist() if n.endswith("/summary.json")]
        require(len(names) == 1, "ALL01 summary ambiguous")
        pins = json.loads(z.read(names[0]))["source_pins"]
    for name, expected in pins.items():
        p = ROOT / name
        require(p.is_file() and not p.is_symlink() and sha(p) == expected, "Source authority changed: " + name)
        result["source_pins"][name] = expected
    result["runner_sha256"] = sha(Path(__file__))
    result["test_only_source_pins"] = {p: sha(ROOT / p) for p in (
        "src-tauri-shell/src/database.rs", "src-tauri-shell/src/database/bse_history_repair_acceptance.rs")}
    result["supplemental_source_pins"] = {}
    for name, expected in OLDER_MASTERS.items():
        p = MASTER.parent / name
        require(sha(p) == expected, "Retained July source changed: " + name)
        result["supplemental_source_pins"][str(p)] = expected
    return result


def master_rows():
    with MASTER.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    require(len(rows) == 10970, "Unexpected official master row count")
    require(all(None not in r and all(v is not None for v in r.values()) for r in rows), "Malformed master")
    return [{k: v.strip().upper() for k, v in r.items()} for r in rows]


def files_state():
    result = {}
    for exchange in ("BSE", "BSE_INDEX"):
        for p in sorted((ROOT / "EOD DATABASE/eod_data" / exchange).glob("*.eod")):
            require(not p.is_symlink(), "Symlink price file: " + str(p))
            st = p.stat()
            with p.open("rb") as f:
                h = f.read(128)
                first = f.read(4)
                last = b""
                if st.st_size >= 192:
                    f.seek(-64, 2)
                    last = f.read(4)
            entry = {"bytes": st.st_size, "sha256": sha(p), "valid": False}
            if len(h) == 128:
                magic, ver, size, count, scale = struct.unpack_from("<4sHHII", h)
                try:
                    symbol = h[16:48].split(b"\0")[0].decode("utf-8")
                    ex = h[48:64].split(b"\0")[0].decode("utf-8")
                    entry.update(count=count, scale=scale, first=struct.unpack("<I", first)[0] if len(first) == 4 else None,
                                 last=struct.unpack("<I", last)[0] if last else None)
                    entry["valid"] = (magic == b"EOD1" and ver == 1 and size == 64 and scale > 0
                                      and st.st_size == 128 + count * 64 and symbol == p.stem and ex == exchange)
                except UnicodeError:
                    pass
            require(st.st_size == p.stat().st_size and st.st_mtime_ns == p.stat().st_mtime_ns, "Price changed during scan")
            result[exchange + "/" + p.name] = entry
    return result


def read_bars(symbol, state):
    require(symbol and not any(x in symbol for x in ("/", "\\", ":")), "Unsafe symbol")
    key = "BSE/" + symbol + ".eod"
    info = state.get(key)
    require(info is not None and info["valid"] and info["count"] > 0, "Missing/bad/empty price file: " + symbol)
    p = ROOT / "EOD DATABASE/eod_data" / key
    blob = p.read_bytes()
    require(hashlib.sha256(blob).hexdigest() == info["sha256"], "Price fingerprint changed: " + symbol)
    bars = {}
    last = 0
    for d, flags, o, h, l, close, prev, vol, oi in struct.iter_unpack("<IIqqqqqQQ", blob[128:]):
        date(d // 10000, d // 100 % 100, d % 100)
        require(d > last, "Unsorted/duplicate price date: " + symbol)
        # Match Rust eod_record_to_price_row normalization, excluding recomputed prev_close.
        bars[d] = (o / info["scale"], h / info["scale"], l / info["scale"], close / info["scale"], vol, oi)
        last = d
    require(len(bars) == info["count"], "Record count changed")
    return bars


def pair(symbol, code, state):
    direct, numeric = read_bars(symbol, state), read_bars(code, state)
    common = direct.keys() & numeric.keys()
    union = direct.keys() | numeric.keys()
    return {"overlap_dates": len(common), "overlap_conflicts": sum(direct[d] != numeric[d] for d in common),
            "union_bars": len(union), "union_first": min(union), "union_last": max(union),
            "pre2024_union_bars": sum(d < 20240101 for d in union),
            "additional_dates": len(numeric.keys() - direct.keys())}


def inspect(c):
    c.row_factory = sqlite3.Row
    rows = [dict(r) for r in c.execute("SELECT * FROM instruments ORDER BY exchange,symbol")]
    require({"symbol", "exchange", "isin", "bse_security_code", "is_active", "lifecycle_status"} <= set(rows[0]), "Schema mismatch")
    return rows


def classify(rows, official, state, only=None):
    bse = [r for r in rows if r["exchange"] == "BSE"]
    by_symbol = {r["symbol"]: r for r in bse}
    owners, claims = defaultdict(list), defaultdict(list)
    for r in bse:
        if not r["symbol"].endswith("#"):
            owners[r["isin"]].append(r["symbol"])
        if r["bse_security_code"] and r["bse_security_code"].strip():
            claims[r["bse_security_code"]].append(r["symbol"])
    by_id, by_isin, by_code = defaultdict(list), defaultdict(list), defaultdict(list)
    for m in official:
        by_id[m["Security Id"]].append(m)
        by_isin[m["ISIN No"]].append(m)
        by_code[m["Security Code"]].append(m)
    out, candidates = [], []
    for r in bse:
        s = r["symbol"]
        if only is not None and s not in only:
            continue
        direct = state.get("BSE/" + s + ".eod", {})
        a = {"symbol": s, "isin": r["isin"], "code_before": r["bse_security_code"], "proposed_code": "",
             "local_active": r["is_active"], "local_lifecycle": r["lifecycle_status"], "series": r.get("series"),
             "official_lifecycle": "", "instrument_class": "UNKNOWN", "classification": "", "reason": "",
             "direct_bars": direct.get("count", 0), "direct_first": direct.get("first"), "direct_last": direct.get("last"),
             "numeric_bars": 0, "overlap_dates": "", "overlap_conflicts": "", "union_bars": "",
             "union_first": "", "union_last": "", "pre2024_union_bars": "", "additional_dates": "",
             "coverage_basis": "DIRECT_FILE_HEADER_ONLY__NOT_NATIVE_CHART"}
        def hold(category, reason):
            a.update(classification=category, reason=reason)
        if s.endswith("#"):
            hold("SETTLEMENT_VARIANT", "Separate settlement identity; never mapped")
        elif re.fullmatch(r"[0-9]{6}", s):
            hold("NUMERIC_IDENTITY", "Legacy numeric identity; preserved")
        else:
            matches = by_id.get(s, [])
            if len(matches) == 1:
                m = matches[0]
                a.update(official_lifecycle=m["Lifecycle Status"], instrument_class=m["Instrument"] or "UNKNOWN")
            saved = r["bse_security_code"]
            code = saved.strip() if saved and saved.strip() else ""
            if not code:
                if s in EXCLUDED:
                    hold("EXPLICIT_EXCLUSION", "Explicitly excluded from apply; independent qualification required")
                elif not matches:
                    hold("NO_OFFICIAL_MAPPING", "No exact Security Id in retained master; no name/price inference")
                elif len(matches) != 1:
                    hold("AMBIGUOUS_OFFICIAL_ID", "Multiple official Security Id observations")
                else:
                    m = matches[0]
                    code = m["Security Code"]
                    a["proposed_code"] = code
                    if not re.fullmatch(r"[0-9]{6}", code) or not re.fullmatch(r"IN[A-Z0-9]{10}", m["ISIN No"]):
                        hold("MALFORMED_OFFICIAL_ID", "Invalid official code/ISIN")
                    elif not r["isin"] or r["isin"] != m["ISIN No"]:
                        hold("IDENTITY_CONFLICT", "Official/local exact ISIN mismatch or local ISIN missing")
                    elif len(by_isin[m["ISIN No"]]) != 1 or len(by_code[code]) != 1:
                        hold("AMBIGUOUS_OFFICIAL_ISIN_CODE", "Nonunique official ISIN/code")
                    elif m["Instrument"] != "EQUITY":
                        hold("UNSUPPORTED_SECURITY_TYPE", "Not explicitly EQUITY in retained master")
                    elif m["Lifecycle Status"] not in {"CURRENT", "SUSPENDED", "DELISTED"}:
                        hold("UNKNOWN_OFFICIAL_LIFECYCLE", "Unrecognized official lifecycle")
            if code and not a["classification"]:
                a["numeric_bars"] = state.get("BSE/" + code + ".eod", {}).get("count", 0)
                numeric = by_symbol.get(code)
                if not re.fullmatch(r"[0-9]{6}", code) or code == s:
                    hold("INVALID_SAVED_CODE", "Saved code invalid")
                elif owners[r["isin"]] != [s] and not saved:
                    hold("AMBIGUOUS_LOCAL_ISIN", "Extra normal local ISIN owner")
                elif (claims[code] != [s] if saved else bool(claims[code])):
                    hold("CODE_OWNER_CONFLICT", "Saved code not uniquely owned by this ticker or already claimed")
                elif numeric and numeric["isin"] and numeric["isin"].strip() and numeric["isin"] != r["isin"]:
                    hold("NUMERIC_ISIN_CONFLICT", "Numeric instrument/local ticker ISIN mismatch")
                elif "BSE/" + code + ".eod" not in state:
                    hold("MISSING_NUMERIC_FILE", "No legacy numeric price file")
                elif "BSE/" + s + ".eod" not in state and not saved:
                    hold("MISSING_DIRECT_FILE", "No price overlap; dated identity proof required")
                else:
                    try:
                        if "BSE/" + s + ".eod" not in state:
                            bars = read_bars(code, state)
                            a.update(union_bars=len(bars), union_first=min(bars), union_last=max(bars),
                                     pre2024_union_bars=sum(d < 20240101 for d in bars), additional_dates=len(bars))
                        else:
                            a.update(pair(s, code, state))
                        a["coverage_basis"] = "FULL_DIRECT_NUMERIC_PAIR_DECODE__NOT_NATIVE_CHART"
                        if a["overlap_conflicts"]:
                            hold("PRICE_CONFLICT", "OHLCV/OI differs on shared dates; reader fails closed")
                        elif not saved and not a["overlap_dates"]:
                            hold("NO_OVERLAP_HISTORICAL_PROOF_REQUIRED", "Current master alone cannot qualify nonoverlapping history")
                        elif saved:
                            hold("ALREADY_MAPPED_PAIR_VERIFIED", "Saved unique code and full available direct/numeric prices checked")
                        else:
                            hold("SAFE_TO_MAP", "Unique exact official equity tuple, local ownership and positive conflict-free overlap")
                            candidates.append({"symbol": s, "isin": r["isin"], "code": code})
                    except (RuntimeError, ValueError, struct.error) as e:
                        hold("BAD_PRICE_FILE", str(e))
            if not a["classification"]:
                hold("DIRECT_ONLY", "No qualified numeric link")
        a["history_before_2024_available"] = bool(a["union_first"] and a["union_first"] < 20240101) if a["union_first"] else bool(direct.get("valid") and direct.get("first") and direct["first"] < 20240101)
        out.append(a)
    return out, sorted(candidates, key=lambda x: x["symbol"])


def classify_all(rows, state):
    """Use July identity observations only for tickers absent from October.

    Require agreement of both retained captures, a fully checked older serialized
    layout, and October corroboration of the exact code/ISIN/equity tuple. This
    does not assert an effective rename date or authorize nonoverlapping prices.
    """
    official = master_rows()
    coverage, candidates = classify(rows, official, state)
    observations = []
    for name in OLDER_MASTERS:
        with (MASTER.parent / name).open(encoding="utf-8-sig", newline="") as f:
            reader = csv.reader(f)
            headers = next(reader)
            data = list(reader)
        require(headers == list(official[0]), "Older master header mismatch")
        require(len(data) == 10751, "Older master row count mismatch")
        require(all(len(r) == 15 and all(not v.strip() for v in r[9:14])
                    and r[14] in {"CURRENT", "SUSPENDED", "DELISTED"} for r in data), "Older master layout mismatch")
        observations.append([{k: v.strip().upper() for k, v in zip(headers, r[:9] + [r[14]])} for r in data])
    def tuple_key(r):
        return tuple(r[k] for k in ("Security Code", "Security Id", "ISIN No", "Instrument", "Lifecycle Status"))
    agreed = set(map(tuple_key, observations[0])) & set(map(tuple_key, observations[1]))
    current_code = defaultdict(list)
    for r in official:
        current_code[r["Security Code"]].append(r)
    october_ids = {r["Security Id"] for r in official}
    missing = {r["symbol"] for r in coverage if r["symbol"] not in october_ids
               and r["classification"] not in {"NUMERIC_IDENTITY", "SETTLEMENT_VARIANT"}}
    old_coverage, old_candidates = classify(rows, observations[1], state, only=missing)
    old_by_id = defaultdict(list)
    for r in observations[1]:
        old_by_id[r["Security Id"]].append(r)
    replacements, qualified = {}, set()
    for a in old_coverage:
        source = old_by_id.get(a["symbol"], [])
        if len(source) != 1 or tuple_key(source[0]) not in agreed:
            continue
        m = source[0]
        latest = current_code.get(m["Security Code"], [])
        if len(latest) != 1 or latest[0]["ISIN No"] != m["ISIN No"] or latest[0]["Instrument"] != "EQUITY":
            continue
        a["reason"] += "; July captures agree; October corroborates same code/ISIN/EQUITY under " + latest[0]["Security Id"]
        a["identity_source"] = "RETAINED_JULY_20260703_BOTH_CAPTURES_WITH_OCTOBER_CODE_ISIN_CORROBORATION"
        a["official_lifecycle"] = latest[0]["Lifecycle Status"]
        replacements[a["symbol"]] = a
        if a["classification"] == "SAFE_TO_MAP":
            qualified.add(a["symbol"])
    coverage = [replacements.get(a["symbol"], a) for a in coverage]
    candidates += [a for a in old_candidates if a["symbol"] in qualified]
    return coverage, sorted(candidates, key=lambda x: x["symbol"])


def table_hashes(c, candidates=(), reverse=False):
    """Canonical logical digest; optionally normalize candidate codes back to before state."""
    changes = {r["symbol"]: r for r in candidates}
    result = {}
    for (name,) in c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"):
        q = '"' + name.replace('"', '""') + '"'
        cols = [r[1] for r in c.execute("PRAGMA table_info(" + q + ")")]
        h = hashlib.sha256()
        count = 0
        for row in c.execute("SELECT * FROM " + q + " ORDER BY " + ",".join(str(i + 1) for i in range(len(cols)))):
            values = list(row)
            if name == "instruments" and reverse:
                d = dict(zip(cols, row))
                if d["exchange"] == "BSE" and d["symbol"] in changes:
                    item = changes[d["symbol"]]
                    require(d["bse_security_code"] == item["code"], "Unexpected post-change code")
                    values[cols.index("bse_security_code")] = item["before"]
            h.update(repr(tuple(values)).encode("utf-8"))
            h.update(b"\n")
            count += 1
        result[name] = {"rows": count, "sha256": h.hexdigest()}
    return result


def update_transaction(c, candidates, baseline_hashes, before_rows, verify_files):
    require(not c.in_transaction, "Unexpected active transaction")
    def authorizer(action, table, column, database, trigger):
        if action in (sqlite3.SQLITE_INSERT, sqlite3.SQLITE_DELETE):
            return sqlite3.SQLITE_DENY
        if action == sqlite3.SQLITE_UPDATE and (table != "instruments" or column != "bse_security_code"):
            return sqlite3.SQLITE_DENY
        return sqlite3.SQLITE_OK
    c.set_authorizer(authorizer)
    try:
        c.execute("BEGIN IMMEDIATE")
        require(table_hashes(c) == baseline_hashes, "Database changed since preview")
        for r in candidates:
            require(r["symbol"] not in EXCLUDED, "Excluded symbol in apply")
            require(c.execute(SQL, r).rowcount == 1, "Guarded update row count mismatch: " + r["symbol"])
        require(table_hashes(c, candidates, reverse=True) == baseline_hashes, "Unrelated database change")
        after_rows = inspect(c)
        expected = {(r["exchange"], r["symbol"]): dict(r) for r in before_rows}
        for r in candidates:
            expected[("BSE", r["symbol"])]["bse_security_code"] = r["code"]
        require(after_rows == list(expected.values()), "Exact changed-row set mismatch")
        require(c.execute("PRAGMA quick_check").fetchall()[0][0] == "ok", "Precommit integrity failed")
        verify_files()
        c.commit()
    except BaseException:
        c.rollback()
        raise
    finally:
        c.set_authorizer(None)


def summary(rows, candidates):
    normal = [r for r in rows if r["classification"] not in {"NUMERIC_IDENTITY", "SETTLEMENT_VARIANT"}]
    return {"total_bse_rows": len(rows), "normal_tickers": len(normal),
            "categories": dict(Counter(r["classification"] for r in rows)),
            "candidate_count": len(candidates), "candidate_official_lifecycle": dict(Counter(r["official_lifecycle"] for r in rows if r["classification"] == "SAFE_TO_MAP")),
            "normal_local_active": dict(Counter(str(r["local_active"]) for r in normal)),
            "normal_official_instrument_class": dict(Counter(r["instrument_class"] for r in normal)),
            "normal_official_lifecycle": dict(Counter(r["official_lifecycle"] or "UNMATCHED" for r in normal)),
            "normal_pre2024_available_header_or_pair": sum(r["history_before_2024_available"] for r in normal),
            "native_chart_validation": "PENDING; pair dates do not include separate dated predecessor-symbol history"}


def run(mode, out):
    require(Path.cwd().resolve() == ROOT.resolve(), "Wrong project root")
    require(DB.resolve() == ROOT / "EOD DATABASE/market-data.sqlite3", "Wrong database")
    require(out.parent.resolve() == DOWNLOADS.resolve() and out.name.startswith("EOD_BSE_Repair_"), "Evidence must be an exact new Downloads/EOD_BSE_Repair_* folder")
    closed_app()
    pins = authority()
    if mode == "preview":
        require(not out.exists(), "Preview output already exists")
        out.mkdir()
        before = db_state()
        c = ro(DB)
        try:
            require(c.execute("PRAGMA integrity_check").fetchone()[0] == "ok", "Live database integrity failed")
            backup = out / "market-data.before.sqlite3"
            dest = sqlite3.connect(backup)
            try:
                c.backup(dest)
            finally:
                dest.close()
            rows = inspect(c)
            hashes = table_hashes(c)
            schema = [list(r) for r in c.execute("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name")]
        finally:
            c.close()
        require(db_state() == before, "DB changed while creating online backup")
        b = ro(backup)
        try:
            require(b.execute("PRAGMA integrity_check").fetchone()[0] == "ok" and table_hashes(b) == hashes, "Backup logical/integrity mismatch")
        finally:
            b.close()
        print("BACKUP VERIFIED", backup, flush=True)
        state = files_state()
        print("FINGERPRINTED", len(state), "BSE/BSE_INDEX files", flush=True)
        coverage, candidates = classify_all(rows, state)
        by_symbol = {r["symbol"]: r for r in rows if r["exchange"] == "BSE"}
        for r in candidates:
            r["before"] = by_symbol[r["symbol"]]["bse_security_code"]
        require(authority() == pins and db_state() == before, "Authority/DB changed during preview")
        report = {"generated_ist": datetime.now(IST).isoformat(), "database": str(DB), "authority": pins,
                  "db_before": before, "backup": str(backup), "backup_sha256": sha(backup),
                  "schema": schema, "table_hashes": hashes, "summary": summary(coverage, candidates),
                  "candidates": candidates, "status": "PREVIEW_ONLY__NO_PRODUCTION_WRITES"}
        write_json(out / "preview.json", report)
        write_json(out / "price_fingerprints.before.json", state)
        write_csv(out / "coverage.before.csv", coverage)
        write_csv(out / "candidates.csv", candidates)
        print(json.dumps(report["summary"], indent=2), flush=True)
        return
    require(mode == "apply", "Unsupported mode")
    preview = json.loads((out / "preview.json").read_text(encoding="utf-8"))
    require(not (out / "apply.json").exists(), "Apply already recorded; refusing repeat")
    require(preview["authority"] == pins, "Authority changed since preview")
    require(preview["db_before"] == db_state(), "Database changed since preview")
    require(sha(Path(preview["backup"])) == preview["backup_sha256"], "Backup fingerprint mismatch")
    state = json.loads((out / "price_fingerprints.before.json").read_text(encoding="utf-8"))
    require(files_state() == state, "Price files changed since preview")
    candidates = preview["candidates"]
    require(candidates, "Nothing to apply")
    c = sqlite3.connect(DB, timeout=15)
    c.execute("PRAGMA foreign_keys=ON")
    try:
        rows = inspect(c)
        coverage, fresh = classify_all(rows, state)
        require([{k: v for k, v in x.items() if k != "before"} for x in candidates] == fresh, "Fresh candidate classification changed")
        def commit_guard():
            closed_app()
            require(authority() == pins, "Source changed before commit")
            require(files_state() == state, "Price changed before commit")
        update_transaction(c, candidates, preview["table_hashes"], rows, commit_guard)
        # Record actual commit immediately, before further potentially failing checks.
        write_json(out / "commit_receipt.json", {"committed": True, "rows": len(candidates), "at_ist": datetime.now(IST).isoformat(), "changes": candidates})
        require(table_hashes(c, candidates, reverse=True) == preview["table_hashes"], "Postcommit unrelated database change")
        require(c.execute("PRAGMA integrity_check").fetchone()[0] == "ok", "Postcommit integrity failure")
        after_rows = inspect(c)
        post_tables = table_hashes(c)
    finally:
        c.close()
    post, pending = classify_all(after_rows, state)
    post_files = files_state()
    require(post_files == state, "Postcommit price preservation failed")
    write_csv(out / "coverage.after.csv", post)
    unresolved = [r for r in post if r["classification"] not in {"ALREADY_MAPPED_PAIR_VERIFIED", "NUMERIC_IDENTITY", "SETTLEMENT_VARIANT"}]
    write_csv(out / "unresolved.csv", unresolved)
    changed = [r for r in post if r["symbol"] in {x["symbol"] for x in candidates}]
    write_csv(out / "changed.csv", changed)
    write_json(out / "table_hashes.after.json", post_tables)
    result = {"status": "COMMITTED_METADATA__AUTOMATED_CHECKS_PASS__NATIVE_UI_PENDING", "generated_ist": datetime.now(IST).isoformat(),
              "database": str(DB), "committed_mappings": len(candidates), "exact_changed_rows_verified": True,
              "all_other_tables_and_instrument_fields_unchanged": True, "integrity_check": "ok", "sql": SQL,
              "backup": preview["backup"], "backup_sha256": preview["backup_sha256"], "db_before": preview["db_before"], "db_after": db_state(),
              "unchanged_price_files": len(post_files), "price_manifest_sha256": sha(out / "price_fingerprints.before.json"),
              "newly_linked_additional_price_dates": sum(int(r["additional_dates"]) for r in changed),
              "newly_linked_with_pre2024": sum(r["history_before_2024_available"] for r in changed),
              "newly_linked_official_lifecycle": dict(Counter(r["official_lifecycle"] for r in changed)),
              "before_summary": preview["summary"], "after_summary": summary(post, pending), "unresolved_normal_tickers": len(unresolved),
              "limitations": ["Native UI/chart acceptance pending", "Full direct/numeric binary pairs checked; historical ownership outside overlap is not independently certified",
                              "No corporate-action research or adjustment apply", "No claim of all BSE history completeness", "New Database untouched"]}
    write_json(out / "apply.json", result)
    print(json.dumps(result, indent=2), flush=True)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("mode", choices=("preview", "apply"))
    p.add_argument("--output", type=Path, required=True)
    a = p.parse_args()
    run(a.mode, a.output)
