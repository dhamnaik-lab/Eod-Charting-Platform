#!/usr/bin/env python3
"""Extract NSE annual equity holiday calendars from the official PDF circulars.

Why a script and not a Rust parser: the circulars are Flate-compressed PDFs, so a
Rust implementation needs `flate2` as a *direct* dependency, which changes
Cargo.lock and breaks the project's `--offline --locked` build policy. This script
produces a CSV in exactly the format the app's "Import official CSV" action
accepts, so the data still enters through the validated import path.

The PDFs position glyphs individually, so extracted text arrives space-separated
("Dec em ber"). Removing all whitespace recovers a clean token stream:

    Sr.No.DateDayDescription1January26,2023ThursdayRepublicDay2March07,2023TuesdayHoli...

Usage (from the project root):
    python scripts/nse-holiday-pdf-extract.py                 # 2019-2026
    python scripts/nse-holiday-pdf-extract.py --years 2023 2024
    python scripts/nse-holiday-pdf-extract.py --out docs/data/nse-holidays-official.csv
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import os
import re
import ssl
import sys
import urllib.request
import zlib
from datetime import date

BACKSLASH = chr(92)
MONTHS = "January February March April May June July August September October November December".split()
WEEKDAYS = "Monday Tuesday Wednesday Thursday Friday Saturday Sunday".split()

# Annual NSE Capital Market holiday circulars (from the researched source package).
CIRCULARS = {
    2019: "CMTR39612",
    2020: "CMTR42877",
    2021: "CMTR46623",
    2022: "CMTR50560",
    2023: "CMTR54757",
    2024: "CMTR59722",
    2025: "CMTR65587",
    2026: "CMTR71775",
}

ROW = re.compile(
    "(" + "|".join(MONTHS) + r")(\d{1,2}),(\d{4})(" + "|".join(WEEKDAYS) + ")"
)


def fetch(url: str) -> bytes:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "*/*"})
    with urllib.request.urlopen(request, timeout=30, context=ctx) as response:
        return response.read()


def pdf_text(raw: bytes) -> str:
    """Inflate every Flate stream and collect the PDF text strings."""
    chunks = []
    index = 0
    while True:
        index = raw.find(b"stream", index)
        if index < 0:
            break
        start = index + 6
        if raw[start:start + 2] == b"\r\n":
            start += 2
        elif raw[start:start + 1] in (b"\n", b"\r"):
            start += 1
        end = raw.find(b"endstream", start)
        if end < 0:
            break
        try:
            chunks.append(zlib.decompress(raw[start:end]))
        except Exception:
            pass
        index = end + 9

    blob = b"".join(chunks)
    out, current, depth, position = [], [], 0, 0
    while position < len(blob):
        char = blob[position:position + 1].decode("latin-1")
        if char == BACKSLASH:
            position += 2
            continue
        if char == "(":
            depth += 1
            if depth == 1:
                current = []
            else:
                current.append("(")
        elif char == ")":
            depth -= 1
            if depth == 0:
                out.append("".join(current))
            else:
                current.append(")")
        elif depth > 0:
            current.append(char)
        position += 1
    return " ".join(" ".join(out).split())


def split_name(raw: str) -> str:
    """'RepublicDay' -> 'Republic Day'; keeps existing spaces and dots."""
    text = raw.strip()
    text = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", text)
    return " ".join(text.split())


def parse_year(text: str, year: int) -> list[tuple[str, str]]:
    # The 2019-2022 circulars interleave language runs ("en-IN", "en-US") between
    # every field, e.g. "1en-INMarch04,2019en-INMondayen-INMahashivratri". Strip
    # them so one parser covers every year.
    tight = re.sub(r"en-[A-Za-z]{2}", "", "".join(text.split()))
    matches = list(ROW.finditer(tight))
    # Several circulars carry a second table of holidays that fall on a weekend.
    # Only the primary equity closure table belongs in the calendar, and the
    # planner already skips weekends. Truncate only when the marker appears
    # AFTER the first dated row: some circulars mention it in the preamble, and
    # cutting there would drop the real table.
    # NOTE: do NOT truncate at the "holidays falling on Saturday/Sunday" block.
    # Those are real exchange holidays that belong in the list; the planner skips
    # weekends anyway, but the Market Holiday tab must show them.
    rows: list[tuple[str, str]] = []
    for position, match in enumerate(matches):
        month, day, found_year, weekday = match.group(1), int(match.group(2)), int(match.group(3)), match.group(4)
        if found_year != year:
            continue
        try:
            parsed = date(found_year, MONTHS.index(month) + 1, day)
        except ValueError:
            continue
        if WEEKDAYS[parsed.weekday()] != weekday:
            raise SystemExit(f"{year}: weekday mismatch for {parsed} (circular says {weekday})")
        end = matches[position + 1].start() if position + 1 < len(matches) else len(tight)
        description = tight[match.end():end]
        # The row number of the next entry runs into the end of this description
        # ("...RepublicDay2March10,2020"), so drop trailing digits as well as a
        # leading one.
        description = re.sub(r"\d+$", "", description)
        # Drop a trailing preamble fragment such as "Theholidaysfallingon..." or a
        # footnote about Muhurat trading that follows the last row.
        for marker in (
            "Theholidaysfalling",
            "holidaysfallingon",
            "Theholidays",
            "MuhuratTrading",
            "willbeconducted",
            "Timingsof",
            "shallbenotified",
        ):
            cut = description.find(marker)
            if cut > 0:
                description = description[:cut]
        # A row number followed by a month name means the next row's date leaked
        # into this description ("Diwali-Balipratipada13November08,2022").
        leak = re.search(r"\d+(?:" + "|".join(MONTHS) + ")", description)
        if leak and leak.start() > 0:
            description = description[:leak.start()]
        name = split_name(description)
        if not name:
            raise SystemExit(f"{year}: empty description for {parsed}")
        rows.append((parsed.isoformat(), name))
    if not 12 <= len(rows) <= 35:
        raise SystemExit(f"{year}: parsed {len(rows)} rows, outside the plausible 12-35 range")
    if len({row[0] for row in rows}) != len(rows):
        raise SystemExit(f"{year}: duplicate dates parsed")
    return sorted(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--years", nargs="+", type=int, default=sorted(CIRCULARS))
    parser.add_argument("--out", default="docs/data/nse-holidays-official.csv")
    args = parser.parse_args()

    records = []
    for year in args.years:
        reference = CIRCULARS.get(year)
        if not reference:
            print(f"{year}: no circular reference known - skipped", file=sys.stderr)
            continue
        url = f"https://archives.nseindia.com/content/circulars/{reference}.pdf"
        try:
            raw = fetch(url)
        except Exception as error:
            print(f"{year}: fetch failed ({error}) - skipped", file=sys.stderr)
            continue
        rows = parse_year(pdf_text(raw), year)
        digest = hashlib.sha256(raw).hexdigest().upper()
        print(f"{year} {reference}: {len(rows)} holidays, sha256 {digest[:16]}...")
        for iso, name in rows:
            records.append(
                {
                    "exchange": "NSE",
                    "year": year,
                    "date": iso,
                    "name": name,
                    "source_urls": url,
                    "source_sha256": digest,
                }
            )

    if not records:
        print("No rows extracted.", file=sys.stderr)
        return 1

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["exchange", "year", "date", "name", "source_urls", "source_sha256"],
        )
        writer.writeheader()
        writer.writerows(records)
    print(f"Wrote {len(records)} rows to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
