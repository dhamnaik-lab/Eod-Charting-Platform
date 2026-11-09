"""Synthetic regression tests; no network or market database access."""
import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

spec = importlib.util.spec_from_file_location("certify", Path(__file__).with_name("certify-nifty-history.py"))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class CertificationTests(unittest.TestCase):
    def test_dates_and_nonfinite(self):
        self.assertEqual(audit.parse_date("03 Jul 1990"), "1990-07-03")
        with self.assertRaises(ValueError): audit.parse_date("31 Feb 2024")
        with self.assertRaises(ValueError): audit.number("NaN")

    def test_complete_csv_profile_and_duplicates(self):
        with TemporaryDirectory() as root:
            p = Path(root)/"fixture.csv"
            p.write_text("Index Name,Date,Open,High,Low,Close\nNIFTY 50,03 Jul 1990,-,-,-,100\nNIFTY 50,2024-01-02,100,99,90,105\nNIFTY 50,2024-01-02,100,110,90,106\n",encoding="utf-8")
            rows, result = audit.load_csv(p,"2026-11-02")
            self.assertEqual(result["rows"],3)
            self.assertEqual(result["conflicting_duplicates"],["2024-01-02"])
            self.assertEqual(result["errors"][0]["error"],"invalid OHLC")
            self.assertEqual(rows["1990-07-03"][:3],(None,None,None))

    def test_all_overlap_conflicts_and_missing_dates(self):
        d = audit.Decimal
        left = {"2024-01-02":(d(100),d(110),d(90),d(105)), "2024-01-04":(None,None,None,d(106))}
        right = {"2024-01-02":(d(100),d(110),d(90),d(104)), "2024-01-03":(d(100),d(110),d(90),d(105)), "2024-01-04":(d(100),d(110),d(90),d(106))}
        result=audit.compare(left,right)
        self.assertEqual(result["overlapping_dates"],2)
        self.assertEqual(len(result["conflicts"]),1)
        self.assertEqual(len(result["field_availability_differences"]),3)
        self.assertEqual(result["missing_in_candidate_within_overlap"],["2024-01-03"])

    def test_verified_calendar_keeps_special_saturday_and_missing_sessions(self):
        calendar={"source":"synthetic authoritative fixture", "from":"2024-01-19","to":"2024-01-23","sessions":["2024-01-19","2024-01-20","2024-01-23"]}
        result=audit.check_calendar({"2024-01-19":(),"2024-01-23":()},calendar)
        self.assertEqual(result["missing_sessions"],["2024-01-20"])
        self.assertEqual(result["unexpected_sessions"],[])
        with self.assertRaises(ValueError): audit.check_calendar({}, {**calendar,"source":""})


if __name__ == "__main__": unittest.main()
