# Corporate Actions — Classic Ready default and Issues filter

**IST timestamp:** 2026-11-01 23:11 IST
**Workstream:** EOD Charting Platform, authorized Windows root `E:\TA Projects\EOD Charting Platform`.
**Remote source authority:** `dhamnaik-lab/Eod-Charting-Platform`, branch `fix/corporate-actions-financial-integrity-20261101` (Draft PR #3), based on `main` commit `7865a7ef1931ee4b410882d81e7b97e773d98d2a`.
**Status:** Source committed remotely. No Windows checkout, full build, test execution, or runtime checkpoint performed. Do not merge before verification.

## Objective / previous limitation

The real, active Classic Corporate Actions pending table (visible in the November 1 screenshot) defaulted its Status filter to All, showing tens of thousands of blocked/unsupported/informational items beside Ready events. The requested normal user experience is Ready-only across **all symbols** after Fetch and Load & Validate, with outstanding issues available explicitly, while not interrupting automated preparation of the underlying full pending queue.

## Files changed

- `src/features/corporateActions/workspace/corporateActionClassicModel.ts`: added `ClassicStatusFilter` and a derived Issues category for waiting/review/checking events, without promoting any event to Ready.
- `src/features/corporateActions/workspace/CorporateActionClassicWorkspace.tsx`: pending default Status is Ready, approved default Status stays All; reset on view transition/Clear filters; explicit Issues (count) and All (diagnostics) choices; useful empty Ready message.
- `src/features/corporateActions/__tests__/corporateActionClassicModel.test.ts`: added all-exchange Ready/Issues and exact approval-ID scope regression coverage.
- `src/features/corporateActions/__tests__/corporateActionQuickSearch.test.ts`: added server-rendered Classic pending default and Approved view regression coverage.

## Behavior preserved

- Fetch still retrieves the selected NSE/BSE source scope; display filters do not scope fetch.
- Load & Validate still evaluates the whole outstanding pending queue; Ready-only visibility does not discard or resolve stored imports.
- Existing eligibility and exact-ID approval guards, confirmation, grouping, searching, sorting, selection, status subdivisions, Approved view, and ability to inspect all events are preserved.
- No changes to Rust, database schema, corporate-action financial math, stored prices, existing exports, network policy, or dependencies.
- Existing specialist identity/terms/EOD price resolution remains where implemented; this change does **not** implement new automatic resolution.

## Validation performed and results

- GitHub API fetched all four changed files from the exact feature branch after commits and confirmed expected source signatures and file/blob SHA values: PASS (source-presence only, not parser/test execution).
- Modified source blob SHAs (Git blob identifiers, **not SHA-256**):
  - `corporateActionClassicModel.ts`: `ca7330f7607e4ffae01d24e3ddb1cdb13603e9e4`
  - `CorporateActionClassicWorkspace.tsx`: `919ba3b092416f8010cb69d7ceec5ed0f1c3745f`
  - `corporateActionClassicModel.test.ts`: `37a64aab0f70acdad7b7f5dbab3168b7f2094afd`
  - `corporateActionQuickSearch.test.ts`: `b1341e39c77d9a9258199c8092f146fd54d14e37`
- No existing project documentation was read.
- **NOT RUN:** TypeScript parser/typecheck, Vitest, frontend build, Windows/Tauri build, user runtime verification, database data tests.

## Required verification on a current authorized Windows checkout

Run from `E:\TA Projects\EOD Charting Platform` only after independently verifying source authority matches this branch:

```powershell
npm test -- src/features/corporateActions/__tests__/corporateActionClassicModel.test.ts src/features/corporateActions/__tests__/corporateActionQuickSearch.test.ts
npm run typecheck:renderer
npm run build:renderer
```

Also run relevant broader Corporate Actions regressions and inspect the actual Windows desktop UI (pending Ready-only, separate Issues, Approved view, search, all-symbol selection and approval scope) before promotion. None of these commands are reported as passing here.

## Risks, limitations, rollback

- A Ready filter can make the queue look empty while unresolved items remain. The explicit Issues and All views prevent data from being hidden permanently; verify usability with the actual large queue.
- An Issues count includes waiting/review/checking events, not informational or already-processed records; those remain inspectable via their dedicated filters or All.
- Full self-resolution of historical identity, missing EOD data, and unverified official announcement terms is **not** delivered by this bounded UI change.
- PR #3 has earlier unverified financial-integrity code unrelated to this UI slice; the combined branch is not release-qualified.
- **Rollback:** restore the four files above to their immediate pre-change Git blob versions or revert their four bounded commits on the feature branch; do not revert unrelated PR #3 financial-integrity commits or touch production data. Pre-change blob identifiers recorded from the GitHub source inspection: `corporateActionClassicModel.ts` `8de22056101be6509f5c13e849f34b80b86b4541`; `CorporateActionClassicWorkspace.tsx` `0a1777b4bff28ddbf9647c07e24a62c9edcf66ec`. Tests may be restored from the PR's pre-change parent commits.

## Next step

Validate this bounded user-facing change and PR #3's existing untested fixes. After a clean checkpoint and separate approval, implement a source-specific, fail-closed EOD/identity/official-terms resolver without changing accepted financial math.
