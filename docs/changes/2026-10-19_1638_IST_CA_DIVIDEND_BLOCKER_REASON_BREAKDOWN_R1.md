# CA Dividend Ineligibility Reason Breakdown R1

- IST package preparation: 2026-10-19 16:38:50 IST.
- Workstream: `E:\TA Projects\EOD Charting Platform` only.
- Source authority: 2026-10-19 11:30:09 IST ZIP SHA-256 `6DFF97E3705A00323FE4ACCF7B84520446D4B68C87E3A71CE4B1F7849F307E8B`, **plus** successfully applied Dividend Explicit Approve R1 RESUME1 candidate (`0341E832A1109F2718B45BFF7BCE06773BF35092B42CDB8392E02136DB3CBCAE`).

## Objective and previous limitation

Operational acceptance found 8,694 evaluated dividends, 1,702 eligible, and 6,992 ineligible, but the UI showed no aggregate reasons. Individual row evidence already contained exact backend policy rejection messages; no further database access is required for this diagnostic.

## Files changed

- `src/components/DatabaseToolsDialogs.tsx` — **modified**; add collapsible dividend reason counts and a copyable aggregate report within the existing summary, only when outcome exists.
- `src/features/corporateActions/legacy/corporateActionDividendBlockerSummary.ts` — **created**; pure grouping and report formatting.
- `src/features/corporateActions/__tests__/corporateActionDividendBlockerSummary.test.ts` — **created**; focused deterministic and mismatch tests.
- `docs/changes/2026-10-19_1638_IST_CA_DIVIDEND_BLOCKER_REASON_BREAKDOWN_R1.md` — **created**; this record.

## Final implementation and behavior preserved

Uses the existing complete read-only evaluator response and the exact `INELIGIBLE` disposition reasons, sorted by count descending. Verifies sum of observed ineligible reasons against backend totals and displays explicit mismatch/incomplete warnings if necessary. Unknown reasons are retained verbatim, never reinterpreted to eligibility. Counts only; no IDs or symbols exported.

No backend, identity/price policy, database schema, adjustment math, source URLs, Load workflow, approve controls, transaction owner, or Plugin P5 change. UI remains unchanged unless user expands a diagnostic element. No automatic approval, no extra scans, no external requests.

## Validation commands/results

- Python ZIP integrity and exact candidate SHA-256 checks: local verification required at packaging.
- Global `tsc` isolated helper strict compile and fixture smoke: local verification required at packaging.
- Windows `npm test -- ...` focused CA tests: **PENDING** until runner executes.
- Windows `npm run typecheck:renderer`: **PENDING** until runner executes.
- Windows `npm run tauri:build`: **PENDING** until runner executes.
- One portable read-only screenshot/report verification: **PENDING**.

## Risks / limits

- Exact string grouping may split dynamically parameterized reason messages; this is intentional fidelity, not a classifier.
- Original 6,992 result lives in application memory and is not stored by the earlier baseline; requires **one** new Load & Validate run in the rebuilt app. No additional DB collector needed.
- Source authority mismatch requires stop, not silent overwrite.
- This diagnostic does **not** make additional dividends eligible.

## Rollback

Restore backed-up `src/components/DatabaseToolsDialogs.tsx` byte-for-byte, remove newly created helper/test/doc only if their current bytes match this package, and rebuild. Preserve already accepted dividend approval R1 source and data.

## Evidence / hashes

Candidate per-file SHA-256 in package manifest; native Windows validation and portable hashes will be emitted only by the runner after successful commands.
