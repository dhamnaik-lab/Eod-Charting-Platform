"""Pinned, read-only production snapshot and one bounded official daily request.

Run once from the project root. Evidence is retained; existing fixtures are refused.
"""
import hashlib
import json
from pathlib import Path
import shutil
import sqlite3
import urllib.error
import urllib.request

ROOT = Path(r"E:\TA Projects\EOD Charting Platform")
SOURCE = ROOT / "EOD DATABASE"
EVIDENCE = ROOT / "tmp/fixtures/2026-11-04-nse-index-daily"
COPY = EVIDENCE / "production-copy"
DATE = "2026-11-03"
URL = "https://nsearchives.nseindia.com/content/indices/ind_close_all_03112026.csv"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_manifest():
    paths = sorted((SOURCE / "eod_data/NSE_INDEX").glob("*.eod"))
    paths += [p for p in sorted(SOURCE.glob("market-data.sqlite3*")) if not p.name.endswith("-shm")]
    return {str(p.relative_to(SOURCE)): digest(p) for p in paths}


def main():
    assert Path.cwd().resolve() == ROOT
    COPY.mkdir(parents=True, exist_ok=False)
    before = source_manifest()
    with sqlite3.connect((SOURCE / "market-data.sqlite3").as_uri() + "?mode=ro", uri=True) as src:
        src.execute("BEGIN")
        owners = list(src.execute("SELECT symbol,exchange FROM instruments WHERE exchange='NSE_INDEX' ORDER BY symbol"))
        with sqlite3.connect(COPY / "market-data.sqlite3") as dest:
            src.backup(dest)
        out = COPY / "eod_data/NSE_INDEX"
        out.mkdir(parents=True)
        for path in sorted((SOURCE / "eod_data/NSE_INDEX").glob("*.eod")):
            shutil.copy2(path, out / path.name)
        src.rollback()
    after = source_manifest()
    assert before == after, "Source changed during snapshot; fixture NOT qualified"
    with sqlite3.connect((COPY / "market-data.sqlite3").as_uri() + "?mode=ro", uri=True) as dest:
        assert owners == list(dest.execute("SELECT symbol,exchange FROM instruments WHERE exchange='NSE_INDEX' ORDER BY symbol"))
    for relative, sha in before.items():
        if relative.endswith(".eod"):
            assert digest(COPY / relative) == sha
    receipt = {"source": str(SOURCE), "copy": str(COPY), "date": DATE, "url": URL,
               "source_unchanged": True, "source_sha256": before,
               "owners": len(owners), "scope": "SQLite online backup plus all NSE_INDEX files; no other exchange data copied"}
    request = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.nseindia.com/"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            data = response.read(8 * 1024 * 1024 + 1)
            assert len(data) <= 8 * 1024 * 1024
            (EVIDENCE / "daily-response.csv").write_bytes(data)
            receipt["acquisition"] = {"status": response.status, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    except (urllib.error.URLError, TimeoutError) as error:
        receipt["acquisition"] = {"error": str(error), "attempts": 1, "retried": False}
    (EVIDENCE / "snapshot-and-acquisition.json").write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in receipt.items() if k != "source_sha256"}, indent=2))


if __name__ == "__main__":
    main()
