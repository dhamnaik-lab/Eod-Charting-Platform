# CA A1 identity findings — 8 November 2026, IST

Scope: A1 only, based on updated `origin/main` at `bc47208` on
`feat/ca-identity-gaps-20261108`. This is a diagnosis and safety regression,
not completed acceptance of a GUJGASLTD split route. No production logic changed.

## Evidence and dispositions

The official [NSE symbol-change CSV](https://nsearchives.nseindia.com/content/equities/symbolchange.csv)
was downloaded on 8 November 2026: 70,027 bytes, 1,080 data rows, SHA-256
`6937337dd726222cd6bb5c8af9964073d215a84f28e7edecf1861f25fd3fd66f`.
Retained capture and query output are ignored evidence under the original root's
`tmp/fixtures/ca-a1-20261108/`; no tmp files belong in the commit.

| Event | Verified evidence | Disposition |
|---|---|---|
| AVANTIFEED, 2018-06-26, Bonus + Split | No old/new symbol in the complete current CSV contains AVANTI. Supplied SQLite copy has no AVANTIFEED identity transition. | Leave blocked. Do not manufacture AVANTI → AVANTIFEED, infer it from names/shared ISIN, or change the importer to admit absent evidence. Absence from this current file does not prove a historical rename never occurred. |
| GUJGASLTD, 2019-01-15, Split | Official CSV row 306 records GUJGASLTD → GUJENERGY effective 01-JUL-2026, matching the supplied copy's identity history. | Rename verified; historical Split routing remains unsupported by the existing dated-chain identity proof. Keep blocked pending an explicitly reviewed extension and fresh price evidence. |
| PCBL, 2018-04-19, Split | Hash-checked supplied PCBL EOD1 copy starts 2022-01-13. | Needs you: no price data for the 2018 event. No identity exception or threshold change. |

SQLite input: the existing user-supplied copy at
`tmp/fixtures/ca-diagnosis-20261107/market-data.sqlite3`, SHA-256
`774555a7fe16a67963f1034974b66d8ae90394ce0ece0d9aa1ed5594157fcde7`.
Opened with `mode=ro&immutable=1` and `PRAGMA query_only=ON`; hash unchanged
after inspection. This older copy cannot certify the current live database.
No live database or original price file was opened. The copied AVANTI,
AVANTIFEED, GUJGASLTD and GUJENERGY price files are absent.

## Why the existing proof does not route GUJGASLTD

`dated_symbol_chain::evaluate` admits DIVIDEND only, requires the suggestion
symbol to equal the import symbol and requires one active exact-symbol target.
Its `path` helper also requires at least two edges. This is not a generic
old-symbol Split/Bonus resolver. GUJGASLTD is the old symbol, the action is
SPLIT, and the official connected component has one edge.

`split_isin_price_proof::evaluate` likewise requires the same active symbol;
shared issuer identity does not authorize cross-symbol retargeting.
`event_price_route` supports dated price lookup for Split/Bonus, but takes the
import symbol as its target and is not financial or cross-symbol identity authority.
The regression exercises the real parser and evaluator using the official GUJ
edge and confirms no proof, source-field change or financial approval results.
It documents the unmet prerequisite rather than claiming the requested route works.

## Review decision needed before extending behavior

A future implementation must explicitly support a single official rename edge,
resolve the event-date symbol to a unique current security, and distinguish the
2019 split ISIN change from the 2026 rename. Preserve import symbol/ISIN,
`purpose_raw`, raw EOD bytes, approval-time source/identity/price rechecks,
transactional adjustment records and deliberate user Approve. Define which symbol
owns the adjustment and how charts and caches consume it; do not simply mark the
old symbol active or replace source identifiers. This extension is not implemented.

For price verification, the user must supply hash-checked copies of
`AVANTI.eod`, `AVANTIFEED.eod`, `GUJGASLTD.eod` and `GUJENERGY.eod` under
`tmp/fixtures/ca-a1-20261108/eod_data/NSE/` with the app closed. Only the user
copies from `EOD DATABASE/eod_data/NSE/`; diagnosis opens the copies read-only.

## Validation and app acceptance

Focused Rust regression: PASS (1 passed, 0 failed; compile/link 1m14s).
Renderer typecheck: PASS. Required Vitest: PASS (567 tests in 73 files; no tmp
collection). Required seven-filter Rust check: PASS (828 passed, 0 failed,
26 ignored). Both shared-Cargo previews passed; root target, `--jobs 2`.
Scoped whitespace and UTF-8/CRLF checks passed (6/6 files). The docs profile
failed on 3 inherited HANDOFF references to ignored historical reports absent
from the clean worktree; those reports exist in the original checkout.
The worktree uses updated main; its Rust test patch is mirrored into the original
checkout for the mandated root-pinned shared Cargo wrapper. Tests there include
unrelated local source changes and cannot certify the exact PR tree.
No release/portable build or live approval is performed. No rebuild is needed
for this tests/docs-only change. The app should continue to block these cases;
do not approve them on the strength of this report.
