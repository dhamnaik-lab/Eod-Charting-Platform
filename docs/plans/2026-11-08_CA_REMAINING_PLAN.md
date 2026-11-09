# Corporate Actions — remaining work plan (8 November 2026, IST)

Owner: user + Codex. Project root: `E:\TA Projects\EOD Charting Platform`.
State at writing: `main` = `42c83e3` (PR #72 merged). Runtime after the last rebuild:
Ready 1 (CGCL 2016), Issues 115 (NSE 53, BSE 62), Deferred ~14,970, Load & Validate ~8.5 min.
Baselines: vitest 567 passed; Rust (7 filters) 827 passed, 0 failed, 26 ignored.

## Rules for every phase (Codex must follow)

1. Read `AGENTS.md` first. Read only the top "Corporate Actions" sections of `HANDOFF.md`.
2. Start from updated `main` on a new branch `feat/ca-<topic>-<yyyymmdd>`. Never push `main`.
3. About 60 uncommitted files from other agents (Nifty history, scanner, chart engine,
   BSE T+0 mapping, NSE index notes in `HANDOFF.md`) stay untouched and unstaged.
   In shared files, stage only your own hunks.
4. Never `git add -f` under `tmp/`. Check: `git ls-tree -r --name-only HEAD -- tmp` prints nothing.
5. Back up first: `scripts/create-project-backup.ps1 -ShortName <name> -Paths @('a','b')`
   (separate array items; check "Files copied" is not 0).
6. Never enable automatic approval. Approve stays a deliberate user click with backend rechecks.
   Raw `.eod` files are never rewritten. `purpose_raw` is never rewritten.
7. Diagnosis uses a database COPY under `tmp/fixtures/<task>/`, opened read-only. Never open
   `EOD DATABASE`. Prices live in `.eod` files, not SQLite; ask the user to copy the needed
   `EOD DATABASE\eod_data\NSE\<SYMBOL>.eod` files (hash-checked) when a price check is needed.
8. CRLF line endings, as in each file.
9. Validation, serially:
   - `npm.cmd run typecheck:renderer`
   - `npx.cmd vitest run --dir src src/features/corporateActions` (fail if " tmp/" appears)
   - `scripts/Invoke-EOD-SharedCargo.ps1 -Mode Preview` then `-Mode Run -CargoAction test
     -CargoArguments @('--jobs','2','--','corporate_action','instrument_mutations','eod_data',
     'bse_identity','nse_identity','identity_evidence_resolver','price_store_operation_lock')`
   Report PASS/FAIL with counts. No portable/release builds (the user rebuilds).
10. Update `HANDOFF.md` (new top CA section), `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`,
    `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md` (and `FILE_INVENTORY.md` for new files).
11. Commit only your files, push the branch, open a PR. Wait for the Codex PR review; after a
    fix push, comment `@codex review` to re-run it. Merge only with no open findings.
12. The user runs `npm run tauri:portable:win`, then Load & Validate, and reports screenshots.
13. Test blocks given to the user run as a file (`pwsh -NoProfile -File <script>.ps1`), because a
    pasted block keeps going after `throw`.

## Phase 0 — housekeeping (user, 10 min)

- `git branch -f main origin/main; git switch main; git branch --show-current` (prints `main`).
- Delete merged remote branches: `feat/ca-nse-cleanup-20261107`, `feat/ca-nse-later-group-20261107`,
  `feat/ca-later-reason-20261107`, `feat/ca-nse-remaining-20261107`, `feat/ca-nse-final-20261108`.
- Rebuild, approve CGCL 2016 if still Ready, run Identity Import (NSE symbol-change history),
  then Load & Validate. Record the new baseline counts in `HANDOFF.md`.

## Phase A — finish NSE (Codex, 2–3 PRs)

Goal: NSE Issues shows only rows with real conflicts, each with one clear reason.

A1. Identity data gaps (no rule loosening):
- AVANTIFEED 2018-06-26 (Bonus + Split, scan MATCHED factor 3): blocked because no recorded
  AVANTI -> AVANTIFEED transition exists. Check whether the NSE symbol-change import (official
  file) contains it. If yes, make the import record it; if no, report and leave blocked.
- GUJGASLTD 2019-01-15 Split: database records GUJGASLTD -> GUJENERGY on 2026-07-01, so the old
  symbol is inactive. The split belongs to the current symbol's history through the dated
  identity chain (`dated_symbol_chain.rs`). Verify the chain applies it to GUJENERGY with the
  same proofs; add a test. Verify the 2026-07-01 rename against official NSE evidence first.
- PCBL 2018-04-19 Split: local history starts in 2022. Report; stays "Needs you: no price data".

A2. Price mismatch rows (stay "Needs you"; diagnosis only, no rule change without user OK):
- SBIN 2014-11-20, JSWSTEEL 2017-01-04: no split-sized jump near the ex-date. Check whether the
  stored history is already adjusted (compare with the official Bhavcopy for those days).
  If proven, propose a "history already adjusted" disposition for user approval.
- AJANTPHARM 2013-09-17, NAVKARURB 2025-05-09: missing sessions around the ex-date. List the
  missing dates; the user fills them with Bhavcopy Date Range, then re-validate.
- BRITANNIA 2010-09-08 (jump 12.1 vs 5), JMFINANCIL 2008-09-08 (score 0.8498 vs limit 0.85):
  report evidence; do not lower thresholds.

A3. Remaining NSE wording (keep the backend/renderer parity fixture in sync):
- Review every remaining NSE "Other" Issue row; close informational wording, map financial
  wording to the right type, defer types with no rules yet. Whole-purpose matches only.
- EDELWEISS 2010-08-10: two identical Split rows (true duplicate). Merge/link them safely so only
  one can be approved.

A4. Load & Validate speed (~8.5 min):
- Profile the run. Skip identity rechecks and scans for Deferred and Closed rows where no
  safety test depends on them. Keep Approve-time rechecks unchanged. Target under 3 min.

Exit: NSE Issues contains only Needs-you rows with evidence; user-confirmed screenshots.

## Phase B — Corporate Actions window redesign (Codex, design first, 2–3 PRs)

Goal: one CA window. The user's job is Fetch -> Load & Validate -> Approve.

B1. Design doc first (in `docs/plans/`), shown to the user before code:
- One toolbar: Fetch (dates apply to Fetch only), Load & Validate, Approve.
- Status groups: Ready, Needs you, Waiting for data, Deferred types, Closed, Approved.
- Identity Import moves inside this window as a tab or step, not a separate screen.
- Old screens (Review Issues, legacy Issues tab, duplicate lists) move under one Advanced
  section; nothing is deleted (AGENTS: keep the advanced maintenance UI).
B2. Closed list with a Reopen button (backend `reopen_corporate_action_informational_closure`
  already exists; renderer API is wired). Show the closure log.
B3. One source of truth for informational wording (today: Rust + renderer copy with a parity
  fixture). Prefer the backend deciding and the renderer displaying.
B4. Tests for each group, filter and button; no change to approval safety.

## Phase C — BSE (Phase 2c, Codex, design first)

Goal: BSE stocks have one chart and their Split/Bonus rows become Ready when proven.

- Problem: 12,816 BSE numeric security-code symbols (for example `500143`) hold old history;
  4,237 have a ticker twin (for example `PHCAP`) with the new history. 41 BSE Split/Bonus rows
  are blocked by this. AGENTS forbids synthesizing BSE symbols from names: link only through
  official BSE identifiers (security code <-> ticker <-> ISIN) from official files.
- C1 design doc: how code and ticker histories join (read-time join vs audited identity mapping),
  how charts read them, how the CA matcher uses the link, rollback.
- C2 implement with tests; C3 re-validate BSE rows.
- Also: BSE "Consolidation of Shares" wording, "Resolution Plan -Suspension" (defer with reason),
  and BSE "Waiting for EOD Data" rows (check BSE Bhavcopy coverage for those dates).

## Phase D — Deferred types (needs user rules first)

Order agreed with the user: after Split/Bonus/Demerger/identity are done.
- Dividend: R1 covers NSE plain cash only. Add rules for BSE dividends and harder types (M3).
- Rights, Demerger (cost split), Capital reduction, InvIT/REIT distributions, share
  distributions (e.g. Chennai Super Kings shares).
For each: the user states the adjustment rule; Codex writes a short design, then code and tests.

## Phase E — audit leftovers

- H1: revoke an approval (undo a wrong adjustment) — design first, large, run alone.
- M2: approval lock (project tests currently forbid it; needs a design decision).
- Remaining Low items from the 6 November audit (see `HANDOFF.md`).

## Starter prompt for Codex (copy for each phase)

```text
Project root: E:\TA Projects\EOD Charting Platform. Read AGENTS.md and
docs/plans/2026-11-08_CA_REMAINING_PLAN.md. Follow the "Rules for every phase" exactly.
Do Phase <X>, step <Xn> only. Start from updated main on branch feat/ca-<topic>-<yyyymmdd>.
For design steps, write the design doc and stop for user approval before code.
Report: files changed, validation PASS/FAIL with counts, PR link, and what the user must
rebuild or check in the app.
```
