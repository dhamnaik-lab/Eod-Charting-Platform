# NS-R5 — Native short-history diagnostic parity

- **IST timestamp:** 2026-11-22 00:29 IST (UTC+05:30)
- **Workstream:** EOD Charting Platform
- **Authorized Windows root:** `E:\TA Projects\EOD Charting Platform`
- **Source authority:** GitHub `main@522cd8a73919e41007e132f7df41f4bbb13f2613` after merged PR #132
- **Bounded issue:** [#133](https://github.com/dhamnaik-lab/Eod-Charting-Platform/issues/133)
- **Implementation branch:** `fix/nsr5-short-history-diagnostics-20261122`
- **Integration state:** DRAFT / UNMERGED until checks and explicit merge approval

## Objective and previous limitation

TypeScript's `runCoreEodScannerBatch` records a short-history target in `errors[]` with the message `NSE:SYMBOL has fewer than 2 completed bars.`. Rust's native executor intentionally classifies the same unevaluable target as `TargetStatus::Skipped`, increments `nativeCounts.skipped`, and publishes a structured `target-skipped` diagnostic explaining the actual warm-up limitation.

Inspection of the native UI adapter confirms that all non-notice native diagnostics were **already copied into the output `errors[]`** and shown in the Scanner window's expandable **data warnings**. The remaining gap was the final status line: `ScannerWindow.tsx` rendered generic `Scanned N symbols; X matches; Y alerts` text for a completed native run and concealed the native skipped/failed counts even though `formatNativeScannerStatus` already supported them.

## Decision / reporting contract

**Preserve the backend-specific classification** rather than converting a skipped target to a failed target or fabricating a TypeScript error. Native `Skipped` is an honest per-target accounting state; TypeScript `errors[]` is a UI warning channel, not a Rust status enum. Keep the native diagnostic's actionable text, target identity and code, and surface it through the existing shared UI data warnings. A completed native run with skips/failures must display the native formatter's `incomplete`, `skipped`, `failed` and diagnostic count in the final status.

This is reporting/display parity, **not** exact byte-identical diagnostic wording or a change in results/counts. Issue #131 has already harmonized the two-bar eligibility boundary.

## Files changed

- `src/plugins/scanner/nativeScannerRun.ts`: add small pure `formatScannerCompletionStatus` helper, retaining exact accepted TypeScript/fallback/cancellation text and delegating completed native runs to existing `formatNativeScannerStatus`.
- `src/components/ScannerWindow.tsx`: replace duplicated inline completion-status conditional with the shared helper. The window still displays `output.errors` under **data warnings**.
- `src/plugins/scanner/__tests__/nativeCoreLatestRoutingNSR2.test.ts`: regression of mocked native terminal diagnostics/counters for zero/one/two completed bars, successful two-bar result publication, no TypeScript fallback, and existing TypeScript/fallback/cancellation completion messages.
- This change record.

## Behavior changed

- For **completed native** scans, final status now identifies the native backend and its genuine `matched`, `noMatch`, `skipped`, `failed` and diagnostic accounting. A short-data skip is visibly incomplete rather than a generic scan-success sentence.
- The existing warning list still carries the native diagnostic text. No diagnostic is reclassified or duplicated.
- No new dependency or native transport field.

## Behavior preserved

- **Rust:** `TargetStatus`, `ScanCounts`, `ScanDiagnostic`, four accepted gap detectors, core warm-up from issue #131, no-match/failed accounting, cancellation, per-target progress, and registered-DB read-only access are unchanged.
- **Renderer:** Native opt-in OFF by default; TypeScript fallback for unsupported/mixed and full-history core rules; TypeScript and fallback completion messages; cancelled scan text; match publication and alerts remain unchanged.
- **Safety:** CA-01 adjusted-native HOLD remains fail-closed; raw `.eod` and SQLite are not accessed or modified. No portable app launch/build, local Git operation, generated output or cross-workstream change.
- The user's ten pre-existing local dirty-worktree entries (including `HANDOFF.md` and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`) remain untouched; GitHub edits only an isolated branch. These local handoff notes intentionally remain locally authoritative until a later guarded reconciliation.

## Validation commands/results

- Verified base commit `522cd8a73919e41007e132f7df41f4bbb13f2613` and inspected live source for Rust outcomes, native transport/adaptation, Scanner window display and prior regressions: **PASS source inspection**, not an executed runtime test.
- The existing issue #131 Rust executor tests covering 0/1/2-bar results passed in merged PR #132 (native 115/0; full Rust 1,406/0). No Rust source changes are proposed by this issue; prior results are not re-labeled as new tests.
- **Pending new GitHub Renderer CI:** Vitest, renderer TypeScript typecheck and Vite build. The new tests use mocked native events (not a live DB).
- **Not run:** New Rustfmt/Cargo tests (no Rust code touched), Windows portable build, live registered-database/native GUI visual acceptance. Manual acceptance remains part of the consolidated scanner release checkpoint.

## Risks and limits

- The message for a native one-bar skip remains more specific than the TypeScript `fewer than 2 completed bars` warning. This is intentional; the same **warning visibility** and honest native counts are the parity target.
- Native progress/error/cancel accounting is not rewritten. The new unit tests assert presentation and transport behavior only; live Windows acceptance is still required before broad native rollout or TypeScript scanner retirement.
- Keep this as one bounded issue. Investigate any unrelated scanner behavior discovered in CI separately.

## Rollback

If validation or user acceptance fails, leave the PR unmerged. If already merged, revert only this issue's renderer status helper, call site and tests through a reviewed commit. Do not alter native scanner source, restore/stash/clean the user's dirty worktree, or access the database.
