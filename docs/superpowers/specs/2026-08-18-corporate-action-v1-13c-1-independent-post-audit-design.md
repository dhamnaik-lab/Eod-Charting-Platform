# Corporate Action V1.13C-1 Independent Post-Audit Design

## Purpose

V1.13C-1 is an independent, read-only proof stage for the separately authorized V1.13B-1 six-row historical-ISIN repair. It is not a writer and cannot approve, quick-resolve, or alter Corporate Action state.

## Frozen authority

- Preflight run: `corporate-action-v1-13b-1-preflight_20260818_144646_557`
- Authorized import IDs: `12841, 19888, 23036, 24025, 24224, 42274`
- Protected import IDs: `819, 19896, 19973, 19977, 22969, 41025, 41574, 42863`
- Mutation fingerprint: `60b411e1bbc564fcdd28870f0eb4dd3b273df87c13297548fe2621a7834c6fa7`
- Apply-plan fingerprint: `62faae5fb5f7dc106ec3ecb986b11250c50e82071bfff36a6d2c0e9b27f421f3`

## Audit architecture

The post-audit never opens the live SQLite database. The PowerShell wrapper hashes and copies the live DB/WAL/SHM family into a private post-Apply snapshot. It also copies the accepted preflight snapshot family into a private audit workspace. Python then opens only those private copies with SQLite `query_only` enabled.

The preflight snapshot is the semantic baseline. All user tables except `instrument_isin_history` must remain schema- and row-identical. `instrument_isin_history` may differ only by six new rows with the exact frozen exchange/symbol/ISIN/effective-date/source/source_ref/note tuples. Existing history rows may not be updated or deleted.

## Required FULL_SUCCESS proof

1. `PRAGMA quick_check = ok` on baseline and post snapshots.
2. `PRAGMA foreign_key_check` returns zero rows on both.
3. User-table set and schemas are unchanged.
4. Every table other than `instrument_isin_history` is row-identical.
5. `instrument_isin_history` has exactly +6 rows.
6. The six new rows are exactly the authorized provenance-bound mutations; no unrelated row is added.
7. All pre-existing history rows are byte-semantically unchanged at the SQL-value level.
8. The six Corporate Action imports remain `PARSED / UNRESOLVED / unapproved`.
9. The eight protected imports remain unresolved and unapproved.
10. A read-only identity recheck proves each authorized import now has singular exact-event-date historical-ISIN evidence.
11. The live DB/WAL/SHM hashes remain unchanged across the post-audit itself.

Only after all eleven conditions pass may the wrapper emit `FULL_SUCCESS`.

## Readiness versus audit result

`v1-13c-1-post-audit-ready.json` means the independent tool has been installed, tested, and bound to the accepted V1.13B-1 preflight. It does not mean the database repair has occurred. The actual post-Apply audit produces a separate FULL_SUCCESS verification report.

## Safety

- live database write: prohibited
- live SQLite open: prohibited
- Corporate Action status write: prohibited
- Quick Resolve: prohibited
- Git operation: prohibited
- automatic database restoration: prohibited
