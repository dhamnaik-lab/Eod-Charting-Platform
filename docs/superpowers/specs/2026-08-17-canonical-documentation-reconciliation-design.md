# EOD Charting Platform — Canonical Documentation Reconciliation Design

**Date:** 2026-08-17 IST  
**Basis snapshot:** `Eod Charting Platform Source Code 2026-08-17_014948_IST`  
**Mode:** Documentation-only reconciliation  
**Git:** Explicitly deferred by user

## 1. Objective

Bring the maintained/current-authority documentation into alignment with the actual August 17, 2026 project state before any further Corporate Actions implementation work.

This pass must record the completed W1.1–W1.4-B1 warning-cleanup sequence, the successful portable Windows rebuild and manual smoke test, and the fact that Corporate Actions remains an active unfinished workstream after V1.9.2/V1.9.2.3.

Historical change evidence under `docs/changes/` remains immutable historical evidence and is not rewritten.

## 2. Canonical documents in scope

The reconciliation may update these current-authority files where needed:

1. `README.md`
2. `HANDOFF.md`
3. `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
4. `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
5. `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
6. `FILE_INVENTORY.md`
7. `REQUIREMENTS.md` only if a current requirement/status sentence is materially stale
8. `AGENTS.md` only if an operating rule is materially stale

A dated reconciliation record will be added under `docs/changes/`.

No historical `docs/changes/*` file will be altered.

## 3. Required current-state facts

### 3.1 Warning cleanup is closed

Document the completed sequence:

- W1.1 Rust warning hygiene — closed.
- W1.2 Vite config ESM/CJS deprecation cleanup — closed.
- W1.3 Official Watchlists source-selective lazy data split — closed.
- W1.4/W1.4-B1 Chart Runtime static partition — closed.

Final production chart chunk layout from the validated portable build:

- `feature-chart-canvas`: approximately 204.45 kB
- `feature-chart-core`: approximately 297.28 kB
- `feature-chart-analysis`: approximately 164.40 kB
- `vendor-technicalindicators`: approximately 19.81 kB
- `feature-official-watchlists`: approximately 55.08 kB
- no application chunk >500 kB
- no circular chunk warning
- no Vite CJS Node API deprecation warning

Portable build evidence:

- `npm run tauri:portable:win` passed.
- release Rust build passed.
- portable executable SHA-256: `07889C39B81D0F61D32A41C29FD9C7CBF210E6DE61BFB469D61F71D90DAB6281`.
- user manual smoke test passed.

### 3.2 Official Watchlists W1.3 remains accepted

Record that:

- six source-selective constituent payloads remain lazy-loaded and session-cached;
- Watchlist parity/regression coverage passed;
- the static `feature-official-watchlists` chunk is ~55 kB rather than the former ~1.18 MB monolith;
- this architecture must be preserved during unrelated work.

### 3.3 Corporate Actions remains unfinished

The documentation must distinguish **completed identity bootstrap infrastructure** from **unfinished Corporate Action review/approval work**.

Record:

- V1.9.2 controlled historical ISIN bootstrap applied the authorized safe set only.
- 283 safe imports were Quick Resolved at the identity-evidence level.
- 281 exact historical identity tuples were inserted/recognized because two same-date compound pairs deduplicated.
- Corporate Actions were **not automatically approved** by the bootstrap.
- V1.9.2.3 fixed reporting serialization only; it performed no database operation.
- the next Corporate Actions step is a fresh **read-only current-database/workbench status audit** before any further write operation.

Historical residual categories to re-check in that audit:

- 9 `COMPANY_IDENTITY_MISMATCH`
- 3 `CONFLICTING_ISIN_HISTORY`
- 49 earlier `NO_CANDIDATE`
- plus the post-bootstrap `PENDING` / READY / approval population

These counts are historical residual evidence, not assumed current truth. The next read-only audit must establish current counts before a new implementation/write phase.

### 3.4 Git is deferred, not forgotten

Canonical docs must explicitly state:

- repository Git status/normalization remains pending;
- no Git cleanup/init/commit work is part of this reconciliation;
- verified source-code snapshots and package/source hashes remain the current safety mechanism;
- Git should be addressed later as a separate governed maintenance phase after the current Corporate Actions work reaches a suitable checkpoint.

## 4. Superseded next-step text

The older statement that the exact next work is **Gann fidelity/acceptance** is stale as the immediate project handoff.

Gann remains a future drawing-family workstream, but the canonical immediate next step becomes:

> Corporate Actions — perform a fresh read-only current-state audit against the live database/workbench, then design the next governed resolution phase from measured residual categories.

No Gann source or accepted Fibonacci behavior is changed by this documentation pass.

## 5. Document ownership rules

### README

Keep orientation/build instructions concise. Add an August 17 verified baseline section and identify Corporate Actions as the immediate unfinished workstream. Do not turn README into a full historical log.

### HANDOFF

Make this the strongest current operational authority. Replace stale Gann-first next-step language with Corporate Actions read-only audit. Preserve accepted Bhavcopy, Fibonacci, sidebar, and other completed baselines as protected boundaries.

### PROJECT_STATE

Append a new latest verified state at the top. Do not rewrite older chronological evidence except where a stale "latest" label must be structurally superseded.

### FEATURE_STATUS_MATRIX

Mark warning cleanup as complete, Corporate Actions Phase 1 as active/partial, and Git housekeeping as deferred. Preserve existing feature evidence.

### ARCHITECTURE_CURRENT

Add the accepted Vite static bundle partition and Official Watchlist lazy-data architecture if not already represented. No speculative architecture.

### FILE_INVENTORY

Update the reconciliation/snapshot basis header and register newly added documentation artifacts. Do not inventory generated runtime output as source.

### REQUIREMENTS / AGENTS

Change only if necessary to remove materially stale current-state guidance. Do not use these as status logs.

## 6. Validation

The documentation package must be documentation-only and must not alter runtime/source code.

Validation must include:

- exact allowed-path contract;
- required canonical documents present;
- no historical `docs/changes/*` mutation except the single newly created reconciliation record;
- no runtime/source/config mutation;
- no database access or operation;
- stale immediate-next-step Gann language removed from current handoff authority while Gann remains recorded as future work;
- Corporate Actions residual counts clearly labeled historical/re-audit-required;
- warning cleanup closure and final portable SHA recorded consistently;
- Git explicitly labeled deferred;
- documentation reference checker if already available in repository;
- Markdown/reference consistency checks;
- final changed-file list emitted.

## 7. Non-goals

This pass does not:

- perform a Corporate Actions database audit;
- approve or modify Corporate Actions;
- change source code;
- change Vite/Rust/Tauri configuration;
- rebuild the app;
- modify Git status/history;
- redesign Gann/Fibonacci/drawing behavior;
- rewrite historical change reports.

## 8. Acceptance criteria

The reconciliation is accepted when:

1. all canonical documents agree that W1.1–W1.4-B1 is closed;
2. the final clean portable build and manual PASS are recorded;
3. Corporate Actions is clearly shown as active and unfinished;
4. the next action is explicitly a fresh read-only Corporate Actions current-state audit;
5. historical residual counts are not misrepresented as current counts;
6. Gann is retained as future work but no longer presented as the immediate next task;
7. Git is explicitly deferred and source snapshots remain the current safety baseline;
8. historical evidence remains untouched;
9. no runtime/database/Git operation occurs.
