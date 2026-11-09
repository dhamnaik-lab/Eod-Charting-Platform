"""Create retained trial/postcommit copies for the ignored Rust raw-reader test."""
import argparse
import csv
import importlib.util
import json
from pathlib import Path
import sqlite3

spec = importlib.util.spec_from_file_location("repair", Path(__file__).with_name("repair-bse-history.py"))
repair = importlib.util.module_from_spec(spec)
spec.loader.exec_module(repair)


def same_committed_state(before, after):
    """A SQLite read-only WAL connection may create an empty WAL sidecar.

    Main bytes and any WAL carrying even a header/frames must remain identical.
    Do not ignore a nonempty WAL, a rollback journal, or a main-file change.
    """
    def normalized(value):
        return {k: v for k, v in value.items() if not (k == "-wal" and v["bytes"] == 0)}
    return normalized(before) == normalized(after)


def run(mode, out):
    repair.require(out.parent.resolve() == repair.DOWNLOADS.resolve() and out.name.startswith("EOD_BSE_Repair_"), "Wrong evidence path")
    preview = json.loads((out / "preview.json").read_text(encoding="utf-8"))
    repair.require(repair.authority() == preview["authority"], "Authority changed since preview")
    repair.require(repair.sha(Path(preview["backup"])) == preview["backup_sha256"], "Backup fingerprint mismatch")
    target = out / ("market-data.trial.sqlite3" if mode == "trial" else "market-data.committed-proof-v2.sqlite3")
    repair.require(not target.exists(), "Proof copy already exists")
    source = Path(preview["backup"]) if mode == "trial" else repair.DB
    repair.closed_app()
    before_state = repair.db_state()
    c = repair.ro(source)
    dest = sqlite3.connect(target)
    try:
        c.backup(dest)
        if mode == "trial":
            rows = repair.inspect(dest)
            repair.update_transaction(dest, preview["candidates"], preview["table_hashes"], rows, lambda: None)
        repair.require(repair.table_hashes(dest, preview["candidates"], reverse=True) == preview["table_hashes"], "Proof copy does not match exact expected metadata change")
        repair.require(dest.execute("PRAGMA integrity_check").fetchone()[0] == "ok", "Proof copy integrity failed")
    finally:
        c.close()
        dest.close()
    repair.require(same_committed_state(before_state, repair.db_state()), "Production committed database state changed while making proof copy")
    with (out / "coverage.before.csv").open(encoding="utf-8-sig", newline="") as f:
        classified = {r["symbol"]: r for r in csv.DictReader(f)}
    manifest = {
        "mode": mode, "data_folder": str(repair.DB.parent), "before": preview["backup"], "after": str(target),
        "copy_sha256": repair.sha(target),
        "cases": [dict(r, expected_pair_bars=int(classified[r["symbol"]]["union_bars"]),
                       expected_pair_pre2024=int(classified[r["symbol"]]["pre2024_union_bars"])) for r in preview["candidates"]],
    }
    path = out / (mode + "-reader-proof.json")
    repair.write_json(path, manifest)
    print(path)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("mode", choices=("trial", "committed"))
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    run(args.mode, args.output)
