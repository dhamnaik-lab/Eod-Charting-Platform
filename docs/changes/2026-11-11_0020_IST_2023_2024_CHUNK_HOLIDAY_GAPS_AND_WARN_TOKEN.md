# DATA-02 — 2023–2024 chunk verified; four missing closures; warning text token

- Timestamp (IST): 2026-11-11 00:20:00 +05:30
- Active workstream/root: EOD Charting Platform — E:\TA Projects\EOD Charting Platform
- Objective: close the 2023–2024 repair chunk on evidence, and fix the light-theme warning colour that made `SKIP`/`INCOMPLETE` log lines unreadable.

## Part 1 — 2023-01-01 → 2024-12-31 repair re-run (user-run, NSE only, workers 2)

Predicted before the run from live `market_holidays` (39 rows in window, all `BUILTIN`) plus the two special-session tables in `src-tauri-shell/src/bhavcopy/calendar.rs`. The planner model was itself validated against the older saved log `bhavcopy logs 010323 to 23 end.txt`, whose `Found 218 trading days` equals the weekday count for 2023-03-01 → 2023-12-31.

| Check | Predicted | Observed | Verdict |
| --- | --- | --- | --- |
| Download jobs | 498 | `Completed download jobs: 498; non-trading calendar days: 233; imported rows: 1212645` | PASS |
| Non-trading calendar days | 233 (205 weekend + 28 holiday weekday) | `233` | PASS |
| Result buckets reconcile to calendar days | 731 | 0 success + 237 skipped + 494 incomplete = **731** | PASS |
| Failures | 0 | `Download complete: 0 success, 237 skipped, 494 incomplete, 0 failed` | PASS |
| Binary write errors | 0 | `Bhavcopy binary write stats: … errors 0` | PASS |
| Holiday weekdays labelled `Exchange holiday (…)` | 28 + 9 weekend-combined = 37; none on a seeded holiday as `No data available` | 37 `Exchange holiday`, 205 `Weekend (`, 4 `No data available` (none on a seeded holiday) | PASS |
| Special sessions treated as trading days | 5 | 5 × `Special trading day override (…)`; `2024-11-01` reached despite its `BUILTIN` Diwali row | PASS |
| Durability contract | journal retained, background checkpoint | 73 deferred `APPEND_NEWEST` files; `Background checkpoint complete … 73 files; 11395 ms` | PASS |

Two log features are by design, not defects:

- `0 success` / `494 incomplete` is expected for an NSE-equity-only run. `isPartialCoverageResult` (`src/store/bhavcopyStore.ts:77-80`) requires `!result.success` plus a `Security subset:` message, and every NSE equity session separates non-equity rows. `0 failed` is the meaningful gate.
- The special-session override deliberately wins over a holiday row, which is why `2024-11-01` (Muhurat) is a job rather than a skip.

Known label defects observed in the same window and **not** changed here: the footer reads `Imported 0` beside `Rows 1212645` because it is bound to `successCount` (`BhavcopyDownloadWindow.tsx:1186`), and the header shows `0 SUCCESS / 237 SKIP / 0 FAIL` with the 494 incomplete results hidden.

## Part 2 — F-1: four real market closures were missing from `market_holidays`

The only four `No data available` dates in the window were `2023-01-26`, `2024-01-22`, `2024-05-20`, `2024-11-20`. Evidence that these are closures and not lost data — full scan of the live binary store (all 8,919 NSE `.eod` files, 128-byte header + 64-byte records, 0 corrupt headers), reading the little-endian `u32` date at each record offset:

| Date | Bars in store | Meaning |
| --- | --- | --- |
| 2024-01-23 (control, normal session) | 2,542 | scan is sound |
| 2023-12-25 (control, seeded holiday) | 0 | matches the `Exchange holiday` skip |
| 2023-01-26 | 0 | absent from `market_holidays` |
| 2024-01-22 | 0 | absent from `market_holidays` |
| 2024-05-20 | 0 | absent from `market_holidays` |
| 2024-11-20 | 0 | absent from `market_holidays` |

Root cause: the 94 `BUILTIN` rows were a **one-time seed on 2026-08-09** (identical `created_at` for all 94) and `src-tauri-shell/src/database/bootstrap.rs:1085` records `HOL-04: No yearly BUILTIN holiday seeding`. The 2023 block starts at `2023-02-19`, omitting Republic Day, and the 2024 block lacks all three one-off Maharashtra closures.

- Fix (data only, no code change): 4 rows inserted with `source='USER'`, matching the 2019–2022 backfill pattern. `USER` rows are preserved by `get_exchange_holiday_name` even when an official snapshot later exists.
- Names are descriptive labels only (the planner uses the date): `Republic Day`, `Special holiday (Ram Mandir consecration)`, `Lok Sabha election (Mumbai polling)`, `Maharashtra assembly election`. **Provenance is not yet official** — archived NSE circulars are still needed to replace these labels with sourced snapshots.
- Behaviour preserved: no existing row updated or deleted; `duplicate dates: []`; `special-day collisions: []`; 2019–2022 rows still 54; window rows 39 → 43; totals `BUILTIN 94 / USER 58` = 152.
- Expected effect on the next 2023–2024 run: `non-trading calendar days` **237**, download jobs **494**, `No data available` **0**, buckets still 731. Re-derived after the insert and confirmed.
- Rollback: `DELETE FROM market_holidays WHERE source='USER' AND date IN ('2023-01-26','2024-01-22','2024-05-20','2024-11-20');`

## Part 3 — warning text token for light themes

`var(--yellow, #f59e0b)` was used at four sites, but `--yellow` is defined in **no** theme: `themePalettes.json` carried only `--green-text` / `--red-text`. All four sites therefore hardcoded `#f59e0b` in every palette. Measured contrast against the light surfaces:

| Colour | on `#ffffff` | on `#f7f8fa` |
| --- | --- | --- |
| `#f59e0b` (previous) | 2.15 | 2.02 |
| `#b45309` (new light) | 5.02 | 4.73 |

Dark themes were already fine (`#f59e0b` = 7.17–9.49 on their backgrounds) and are unchanged in value; the three-mid-tone light themes failed AA and sat outside their own red/green family (`#b91c1c` 6.47, `#047857` 5.48).

- `src/features/app/themePalettes.json`: added `--yellow-text` to all 7 themes — `#f59e0b` for `midnight-slate-pro`, `amoled-black`, `refinitiv-dark`, `tos-charcoal`; `#b45309` for `classic-light`, `classic-light-refined`, `deep-light`.
- `src/styles/theme-tokens.generated.css`: regenerated with `npm run themes:generate` (generated file, never hand-edited); `--yellow-text` now present in all 7 blocks.
- Call sites repointed to `var(--yellow-text)`: `src/components/BhavcopyDownloadWindow.styles.ts:564` (`statSkippedValueStyle`), `:582` (`logEntryWarningStyle`), `src/components/BinaryEodParityDialog.tsx:255`, `src/components/ToastContainer.tsx:27`.
- No Rust change, so no Cargo run and no release build; the change is visible only after the user's next manual portable rebuild.

## Verification

| Command | Result |
| --- | --- |
| `scripts/validate-change.ps1 -Profile renderer` | PASS — Renderer typecheck PASS, Whitespace check PASS |
| `npx vitest run --exclude "tmp/**" src/features/app/__tests__/themeContrast.test.ts src/features/app/__tests__/themeSystemAudit.test.ts` | PASS — 2 files, 65 tests |
| Palette read-back + binary store date scan (Python, read-only) | PASS — 7/7 tokens, 8,919 files |

`npx vitest` without `--exclude "tmp/**"` reports 54 failures: they are stale duplicate test copies under `tmp/UX13_PR23_20261106_001316_IST/candidate/`, not the live tree. The project's own `npm test` already excludes `tmp/**`.

## Backups

- Files: `backups/pre_opencode_changes_20261111_001708_warn-token-and-4-holidays/` — 6 files (`themePalettes.json`, `theme-tokens.generated.css`, `BhavcopyDownloadWindow.styles.ts`, `BinaryEodParityDialog.tsx`, `ToastContainer.tsx`, `HANDOFF.md`).
- Database: `backups/eod-holidays-20261111_0016/market-data.sqlite3` — SQLite online backup, 261,201,920 bytes, SHA-256 `1FF8CCFAC75F7AA91019D0866753AFA857A0AE30DB7190DDE34E0268A310B86B`.
- Note: the first backup attempt used bash-comma `-Paths` with `-File` and copied 0 files, exactly the trap already recorded in `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`. The empty folder was removed and the run repeated via `powershell -Command "& './scripts/create-project-backup.ps1' … -Paths 'a','b'"`.

## Risks / open items

- The four closure dates are evidenced by an empty binary store, not by an archived circular. A wrong date would suppress a real session, so if any of the four is ever shown to have traded, delete that row and let it re-download.
- `IndicatorPickerDialog.tsx:262` still uses `var(--amber, #f59e0b)` for the `★ Favorites` label — `--amber` is also undefined, so it has the same light-theme defect. Left unchanged: outside the approved scope.
- `themeContrast.test.ts` does not assert `--yellow-text`, so the new token's contrast is currently unguarded by tests.
- Footer `Imported 0` vs `Rows 1212645` and the header hiding `incomplete` results remain unfixed label defects.
- `eod_prices` holds 0 rows for every date in 2023–2024, so it is not the live bar store; integrity checks must read the binary `.eod` files.
