"""Safety regressions for the offline metadata repair, using only in-memory data."""
import importlib.util
from pathlib import Path
import sqlite3
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("repair", Path(__file__).with_name("repair-bse-history.py"))
repair = importlib.util.module_from_spec(spec)
spec.loader.exec_module(repair)
proof_spec = importlib.util.spec_from_file_location("proof", Path(__file__).with_name("prepare-bse-history-proof.py"))
proof = importlib.util.module_from_spec(proof_spec)
proof_spec.loader.exec_module(proof)


class RepairSafetyTests(unittest.TestCase):
    def test_copy_guard_tolerates_only_empty_wal_creation(self):
        before = {"main": {"bytes": 100, "sha256": "same"}}
        self.assertTrue(proof.same_committed_state(before, dict(before, **{"-wal": {"bytes": 0, "sha256": "empty"}})))
        self.assertFalse(proof.same_committed_state(before, dict(before, **{"-wal": {"bytes": 32, "sha256": "header"}})))
        self.assertFalse(proof.same_committed_state(before, {"main": {"bytes": 100, "sha256": "changed"}}))
        self.assertFalse(proof.same_committed_state(before, dict(before, **{"-journal": {"bytes": 0, "sha256": "empty"}})))

    def db(self):
        c = sqlite3.connect(":memory:")
        self.addCleanup(c.close)
        c.executescript("""CREATE TABLE instruments(symbol TEXT, exchange TEXT, isin TEXT,
          bse_security_code TEXT, is_active INTEGER, lifecycle_status TEXT, series TEXT,
          PRIMARY KEY(symbol,exchange));
          CREATE UNIQUE INDEX code_owner ON instruments(bse_security_code) WHERE exchange='BSE'
          AND bse_security_code IS NOT NULL;
          CREATE TABLE settings(key TEXT, value TEXT);
          INSERT INTO settings VALUES('preserve','yes');
          INSERT INTO instruments VALUES('AAA','BSE','INE000000001',NULL,1,'CURRENT','A'),
          ('AAA#','BSE','INE000000001',NULL,1,'CURRENT','A'),
          ('500001','BSE',NULL,NULL,1,'CURRENT','A'),
          ('AAA','NSE','INE000000001',NULL,1,'CURRENT','EQ'),
          ('BBB','BSE','INE000000002',NULL,1,'CURRENT','A');""")
        return c

    def candidate(self, symbol="AAA"):
        return dict(symbol=symbol, isin="INE000000001", code="500001", before=None)

    def apply(self, c, changes, guard=lambda: None):
        rows = repair.inspect(c)
        hashes = repair.table_hashes(c)
        repair.update_transaction(c, changes, hashes, rows, guard)

    def test_only_one_field_and_settlement_nse_preserved(self):
        c = self.db()
        self.apply(c, [self.candidate()])
        self.assertEqual(c.execute("SELECT symbol,exchange,bse_security_code FROM instruments WHERE bse_security_code IS NOT NULL").fetchall()[0][:], ("AAA", "BSE", "500001"))
        self.assertEqual(c.execute("SELECT value FROM settings").fetchone()[0], "yes")
        with self.assertRaisesRegex(RuntimeError, "row count"):
            self.apply(c, [self.candidate()])

    def test_second_bad_row_rolls_back_first(self):
        c = self.db()
        before = repair.table_hashes(c)
        with self.assertRaisesRegex(RuntimeError, "row count"):
            self.apply(c, [self.candidate(), self.candidate("MISSING")])
        self.assertEqual(repair.table_hashes(c), before)

    def test_precommit_file_failure_rolls_back(self):
        c = self.db()
        before = repair.table_hashes(c)
        with self.assertRaisesRegex(RuntimeError, "changed"):
            self.apply(c, [self.candidate()], lambda: repair.require(False, "file changed"))
        self.assertEqual(repair.table_hashes(c), before)

    def test_extra_normal_owner_numeric_conflict_and_claimed_code_block(self):
        for mutation in (
            "UPDATE instruments SET isin='INE000000001' WHERE symbol='BBB'",
            "UPDATE instruments SET isin='INE999999999' WHERE symbol='500001'",
            "UPDATE instruments SET bse_security_code='500001' WHERE symbol='BBB'",
        ):
            with self.subTest(mutation=mutation):
                c = self.db()
                c.execute(mutation)
                c.commit()
                before = repair.table_hashes(c)
                with self.assertRaisesRegex(RuntimeError, "row count"):
                    self.apply(c, [self.candidate()])
                self.assertEqual(repair.table_hashes(c), before)

    def test_authorizer_blocks_trigger_side_effects(self):
        c = self.db()
        c.executescript("CREATE TRIGGER unexpected AFTER UPDATE ON instruments BEGIN UPDATE settings SET value='bad'; END;")
        before = repair.table_hashes(c)
        with self.assertRaises(sqlite3.DatabaseError):
            self.apply(c, [self.candidate()])
        self.assertEqual(repair.table_hashes(c), before)

    def test_settlement_and_excluded_ticker_cannot_apply(self):
        c = self.db()
        with self.assertRaisesRegex(RuntimeError, "row count"):
            self.apply(c, [self.candidate("AAA#")])
        with self.assertRaisesRegex(RuntimeError, "Excluded"):
            self.apply(c, [self.candidate("TCS")])

    def test_classifier_rejects_non_equity_nonoverlap_conflict_and_ambiguity(self):
        c = self.db()
        rows = repair.inspect(c)
        m = {"Security Id": "AAA", "Security Code": "500001", "ISIN No": "INE000000001",
             "Instrument": "EQUITY", "Lifecycle Status": "CURRENT"}
        state = {"BSE/AAA.eod": {"count": 1}, "BSE/500001.eod": {"count": 2}}
        result = {"overlap_dates": 1, "overlap_conflicts": 0, "union_bars": 2,
                  "union_first": 20000103, "union_last": 20240101, "pre2024_union_bars": 1, "additional_dates": 1}
        with patch.object(repair, "pair", return_value=result):
            _, safe = repair.classify(rows, [m], state)
            self.assertEqual(len(safe), 1)
            _, unsafe = repair.classify(rows, [dict(m, Instrument="PREFERENCE SHARES")], state)
            self.assertEqual(unsafe, [])
            _, ambiguous = repair.classify(rows, [m, m], state)
            self.assertEqual(ambiguous, [])
        for bad in (dict(result, overlap_dates=0), dict(result, overlap_conflicts=1)):
            with patch.object(repair, "pair", return_value=bad):
                _, unsafe = repair.classify(rows, [m], state)
                self.assertEqual(unsafe, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
