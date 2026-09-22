# Canonical Documentation Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the EOD Charting Platform's maintained/current-authority documentation with the verified August 17, 2026 source/runtime state, while leaving historical evidence immutable and performing no runtime, database, or Git operation.

**Architecture:** Treat the eight canonical root documents as the current-authority layer, but modify only the six documents that are materially stale. Add one new dated reconciliation record and install this plan. Preserve `REQUIREMENTS.md` and `AGENTS.md` byte-for-byte because their Gann statements are enduring constraints rather than stale immediate-next-step status. Validate through exact-path/hash guards, repository documentation-reference checks, content contracts, and a no-runtime/no-Git changed-file allow-list.

**Tech Stack:** Markdown, PowerShell 7, SHA-256 file verification, repository `scripts/check-doc-references.ps1`. No TypeScript/Rust/Vite/Tauri build is required because this is documentation-only.

## Global Constraints

- Basis snapshot: `Eod Charting Platform Source Code 2026-08-17_014948_IST`.
- Mode: documentation-only canonical reconciliation.
- Historical `docs/changes/*` files are immutable; create exactly one new reconciliation record and do not edit an existing historical report.
- Do not modify runtime source, tests, package manifests, Vite/Rust/Tauri configuration, generated source, database files, or application data.
- Do not run any Corporate Actions Preview/Apply or SQLite operation.
- Do not run `git status`, `git diff`, `git add`, `git commit`, branch, reset, clean, checkout, init, or any other Git command. Git is explicitly deferred by the user.
- Do not run `scripts/validate-change.ps1` for this pass because its current implementation always executes `git diff --check`; use `scripts/check-doc-references.ps1` directly instead.
- Verified source snapshots and package/source SHA-256 hashes remain the safety mechanism until Git normalization is handled in a separate governed phase.
- W1.1 Rust warning hygiene — CLOSED.
- W1.2 Vite ESM/CJS deprecation cleanup — CLOSED.
- W1.3 Official Watchlists source-selective lazy-data split — CLOSED.
- W1.4/W1.4-B1 Chart Runtime static partition — CLOSED.
- Final validated portable-build chunk measurements:
  - `feature-chart-canvas`: approximately 204.45 kB
  - `feature-chart-core`: approximately 297.28 kB
  - `feature-chart-analysis`: approximately 164.40 kB
  - `vendor-technicalindicators`: approximately 19.81 kB
  - `feature-official-watchlists`: approximately 55.08 kB
  - no application JavaScript chunk >500 kB
  - Vite CJS Node API deprecation warning absent
  - circular chunk warning absent
- Final portable executable SHA-256: `07889C39B81D0F61D32A41C29FD9C7CBF210E6DE61BFB469D61F71D90DAB6281`.
- User manual smoke test of that portable build: PASS.
- Corporate Actions V1.9.2 repaired identity evidence for 283 authorized safe imports, deduplicating to 281 exact historical identity tuples; it did **not** approve Corporate Actions.
- V1.9.2.3 was reporting/source-only and performed no database operation.
- Historical residual categories requiring fresh read-only re-audit:
  - 9 `COMPANY_IDENTITY_MISMATCH`
  - 3 `CONFLICTING_ISIN_HISTORY`
  - 49 earlier `NO_CANDIDATE`
  - plus current post-bootstrap `PENDING` / READY / approved population
- Those residual counts must be labeled **historical evidence**, not current database truth.
- Immediate next work after documentation reconciliation: fresh **read-only Corporate Actions current-state audit**.
- Gann fidelity/acceptance remains future drawing-family work and the completed Fibonacci baseline remains protected.
- `REQUIREMENTS.md` and `AGENTS.md` are expected to remain unchanged unless execution finds an actual contradiction with this approved design. Their current Gann language is a persistent compatibility rule, not an immediate-next-step instruction.

---

## Locked File Structure

### Modify

- `README.md` — add August 17 current baseline, warning-cleanup closure, clean portable evidence, Corporate Actions active/unfinished status, Git-deferred note; supersede stale Gann-first immediate priority without deleting historical August 13 evidence.
- `HANDOFF.md` — make Corporate Actions read-only audit the exact immediate next step; update source-of-truth snapshot; add warning-cleanup/portable closure and Git-deferred operating boundary.
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md` — prepend a new August 17 latest verified-state section; preserve older chronological entries unchanged.
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md` — mark warning cleanup closed, Corporate Actions partial/active, Git housekeeping deferred, and immediate next audit.
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md` — add accepted W1.3 lazy Watchlist and W1.4-B1 static bundle architecture; update canonical basis wording where materially stale.
- `FILE_INVENTORY.md` — update source-snapshot/reconciliation basis, register W1.1–W1.4-B1/current reconciliation docs, and reflect current canonical snapshot completeness without treating generated output as source.

### Create

- `docs/changes/2026-08-17_CANONICAL_DOCUMENTATION_RECONCILIATION.md` — one current reconciliation record describing scope, verified facts, validation, and next step.
- `docs/superpowers/plans/2026-08-17-canonical-documentation-reconciliation-plan.md` — this approved implementation plan.

### Preserve byte-for-byte

- `REQUIREMENTS.md`
- `AGENTS.md`
- every pre-existing file under `docs/changes/`
- all `src/**`
- all `src-tauri-shell/**`
- all configuration/manifests/scripts
- all database/runtime data

### Package-only validation helpers

- `tools/check-canonical-doc-reconciliation.ps1` — exact allowed-path/content/hash contract.
- `payload-manifest.json` — basis hashes and payload hashes.
- `PACKAGE_CONTENT_SHA256.txt`
- `README.txt`
- `Apply-EOD-Canonical-Documentation-Reconciliation.ps1`

---

### Task 1: Freeze the Fresh Snapshot Basis and Allowed-Path Contract

**Files:**
- Read: `README.md`
- Read: `HANDOFF.md`
- Read: `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- Read: `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- Read: `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- Read: `FILE_INVENTORY.md`
- Read/preserve: `REQUIREMENTS.md`
- Read/preserve: `AGENTS.md`
- Create package-only: `payload-manifest.json`

**Interfaces:**
- Consumes: fresh snapshot `Eod Charting Platform Source Code 2026-08-17_014948_IST`.
- Produces: exact SHA-256 basis for every modifiable canonical document and preservation hashes for `REQUIREMENTS.md`/`AGENTS.md`.

- [ ] **Step 1: Calculate basis hashes without Git**

On Windows:

```powershell
$ProjectRoot = "E:\TA Projects\EOD Charting Platform"

$BasisFiles = @(
    "README.md",
    "HANDOFF.md",
    "PROJECT_STATE_EOD_CHARTING_PLATFORM.md",
    "FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md",
    "ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md",
    "FILE_INVENTORY.md",
    "REQUIREMENTS.md",
    "AGENTS.md"
)

$BasisFiles | ForEach-Object {
    $Path = Join-Path $ProjectRoot $_
    [pscustomobject]@{
        Path = $_
        SHA256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
    }
}
```

Expected: all eight files exist and return SHA-256 values.

- [ ] **Step 2: Enumerate historical change-report hashes**

Create a deterministic SHA-256 inventory for all pre-existing `docs/changes/*` files before mutation:

```powershell
Get-ChildItem -LiteralPath (Join-Path $ProjectRoot "docs\changes") -File -Recurse |
    Sort-Object FullName |
    ForEach-Object {
        [pscustomobject]@{
            Path = $_.FullName.Substring($ProjectRoot.Length + 1)
            SHA256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
        }
    }
```

Store this inventory inside package validation data. The one future path
`docs\changes\2026-08-17_CANONICAL_DOCUMENTATION_RECONCILIATION.md`
must not exist in the pre-apply list.

- [ ] **Step 3: Lock the project-write allow-list**

The apply wrapper may write exactly:

```text
README.md
HANDOFF.md
PROJECT_STATE_EOD_CHARTING_PLATFORM.md
FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md
ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md
FILE_INVENTORY.md
docs/changes/2026-08-17_CANONICAL_DOCUMENTATION_RECONCILIATION.md
docs/superpowers/plans/2026-08-17-canonical-documentation-reconciliation-plan.md
```

No other project path is permitted.

- [ ] **Step 4: Explicitly prohibit Git/native build/database commands**

The wrapper source contract must reject command strings containing any invocation of:

```text
git
cargo
npm
npx
tauri
sqlite3
historical-isin-bootstrap
corporate-action
```

Exception: prose inside Markdown payloads may mention these terms; the rejection applies to executable wrapper/helper command statements, not payload text.

---

### Task 2: Reconcile `README.md` and `HANDOFF.md`

**Files:**
- Modify: `README.md`
- Modify: `HANDOFF.md`

**Interfaces:**
- Produces the concise project orientation (`README`) and strongest immediate operational authority (`HANDOFF`).

- [ ] **Step 1: Add an August 17 verified baseline at the top of README's baseline history**

Insert a new section before the August 16 section:

```markdown
## Verified Baseline — August 17, 2026

- Warning cleanup W1.1 through W1.4-B1 is closed.
- The accepted Vite production partition is `feature-chart-canvas` (~204.45 kB), `feature-chart-core` (~297.28 kB), `feature-chart-analysis` (~164.40 kB), and `vendor-technicalindicators` (~19.81 kB). `feature-official-watchlists` remains ~55.08 kB with source-selective lazy payloads.
- The final production build has no application chunk above 500 kB, no circular-chunk warning, and no Vite CJS Node API deprecation warning.
- `npm run tauri:portable:win` passed; portable executable SHA-256 is `07889C39B81D0F61D32A41C29FD9C7CBF210E6DE61BFB469D61F71D90DAB6281`; manual smoke test passed.
- Corporate Actions remains active and unfinished. V1.9.2 resolved identity evidence for 283 authorized safe imports / 281 historical identity tuples but did not approve Corporate Actions. The immediate next step is a fresh read-only current-database/workbench audit.
- Historical residual evidence to re-check is 9 `COMPANY_IDENTITY_MISMATCH`, 3 `CONFLICTING_ISIN_HISTORY`, and 49 earlier `NO_CANDIDATE`, plus the current post-bootstrap PENDING/READY/approved population. These are not assumed current counts.
- Git normalization/status work is deferred; verified source snapshots and SHA-256 package/source checks remain the current safety mechanism.
```

Do not delete the August 16 or August 13 historical baseline sections.

- [ ] **Step 2: Supersede README's stale immediate Gann sentence**

Where the August 13 section currently says:

```text
The next drawing-family work is Gann fidelity/acceptance...
```

retain it as a dated August 13 historical statement but append a clear supersession sentence:

```markdown
This August 13 handoff ordering is historical. As of the August 17 canonical baseline, Corporate Actions read-only status audit is the immediate project step; Gann remains the next drawing-family workstream after that governed Corporate Actions checkpoint.
```

This preserves chronology without making the old sentence current authority.

- [ ] **Step 3: Replace HANDOFF current objective**

Replace the current Gann-first objective with:

```markdown
## Current objective

Resume Corporate Actions from the accepted V1.9.2/V1.9.2.3 identity-bootstrap state. Before any further database write, approval, or resolution implementation, run a fresh read-only current-database/workbench status audit and measure the actual remaining PENDING / READY / approved / mismatch populations.

The historical residual evidence is 9 `COMPANY_IDENTITY_MISMATCH`, 3 `CONFLICTING_ISIN_HISTORY`, and 49 earlier `NO_CANDIDATE`; these values are audit inputs, not assumed current truth.

Gann fidelity/acceptance remains future drawing-family work. Preserve the completed Fibonacci baseline.
```

- [ ] **Step 4: Update HANDOFF source of truth**

Replace the stale August 13 documentation-basis snapshot with:

```text
Eod Charting Platform Source Code 2026-08-17_014948_IST
```

Do not invent a ZIP SHA-256 unless it is independently calculated from the supplied fresh snapshot/package during implementation.

- [ ] **Step 5: Add closed warning-cleanup and Git-deferred boundaries to HANDOFF**

Add concise sections containing:

```markdown
## Accepted Warning-Cleanup Baseline (August 17, 2026)

- W1.1 Rust warning hygiene: CLOSED.
- W1.2 Vite ESM/CJS deprecation cleanup: CLOSED.
- W1.3 Official Watchlists lazy-data split: CLOSED.
- W1.4/W1.4-B1 chart-runtime static partition: CLOSED.
- Final portable build and manual smoke test: PASS.
- No >500 kB application chunk, no circular chunk warning, no Vite CJS deprecation warning.

## Repository Maintenance Boundary

Git status/normalization remains intentionally deferred. Do not mix Git cleanup with the next Corporate Actions audit. Until a separate Git maintenance phase is approved, source snapshots plus SHA-256 package/source guards remain the recovery baseline.
```

- [ ] **Step 6: Replace HANDOFF exact next step**

The final `## Exact next step` must say, in substance:

```markdown
Perform a fresh read-only Corporate Actions status audit against the live current database/workbench. Measure current approval/readiness/identity residual populations and compare them with the historical V1.9.2 residual evidence. Do not write, approve, quick-resolve, or bootstrap anything during that audit. Design the next governed Corporate Actions phase only from the measured current state.
```

Do not present Gann as the immediate exact next step.

---

### Task 3: Append Current State to `PROJECT_STATE` and Update Feature Status

**Files:**
- Modify: `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- Modify: `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`

**Interfaces:**
- `PROJECT_STATE` remains chronological/append-style.
- `FEATURE_STATUS_MATRIX` provides concise current status.

- [ ] **Step 1: Prepend one new latest verified-state section to PROJECT_STATE**

Immediately after the title, add:

```markdown
## Latest Verified State (August 17, 2026 - Warning Cleanup Closed, Clean Portable Baseline, Corporate Actions Resumption)

- W1.1 through W1.4-B1 warning cleanup is closed.
- Final production chart chunks: `feature-chart-canvas` ~204.45 kB, `feature-chart-core` ~297.28 kB, `feature-chart-analysis` ~164.40 kB, `vendor-technicalindicators` ~19.81 kB; `feature-official-watchlists` remains ~55.08 kB with W1.3 lazy source payloads.
- No application JavaScript chunk exceeds 500 kB; circular-chunk and Vite CJS deprecation warnings are absent.
- `npm run tauri:portable:win` passed. Portable executable SHA-256: `07889C39B81D0F61D32A41C29FD9C7CBF210E6DE61BFB469D61F71D90DAB6281`. User manual smoke test passed.
- Corporate Actions remains active/unfinished. V1.9.2 handled 283 authorized safe imports at the identity-evidence layer, deduplicating to 281 exact historical identity tuples, without Corporate Action approval. V1.9.2.3 was reporting-only.
- Historical residual evidence requiring fresh read-only re-audit: 9 `COMPANY_IDENTITY_MISMATCH`, 3 `CONFLICTING_ISIN_HISTORY`, 49 earlier `NO_CANDIDATE`, plus the current post-bootstrap PENDING/READY/approved population. Historical counts are not current truth.
- Immediate next step: fresh read-only Corporate Actions current-state audit before any new write phase.
- Gann fidelity/acceptance remains future drawing work; the completed Fibonacci baseline remains protected.
- Git status/normalization is deferred to a separate governed maintenance phase. Source snapshots and SHA-256 guards remain the current safety mechanism.
```

Do not edit the older August 16/August 15/August 13 entries except for a structural heading collision if required.

- [ ] **Step 2: Inspect the existing FEATURE_STATUS_MATRIX table/sections and make the smallest status edits**

Ensure it has explicit current rows/entries equivalent to:

```text
Warning Cleanup W1.1-W1.4-B1 | COMPLETE / CLOSED
Corporate Actions Phase 1    | ACTIVE / PARTIAL
Git housekeeping             | DEFERRED
Gann fidelity                | FUTURE / QUEUED
```

Corporate Actions notes must state identity bootstrap complete for the authorized safe set, approval/residual audit unfinished.

- [ ] **Step 3: Add the exact next-gate note to FEATURE_STATUS_MATRIX**

Add one concise current-priority line:

```markdown
**Immediate governed gate:** read-only Corporate Actions current-state audit; no write operation until current residual counts are measured.
```

---

### Task 4: Reconcile Current Architecture and File Inventory

**Files:**
- Modify: `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`
- Modify: `FILE_INVENTORY.md`

**Interfaces:**
- Architecture documents accepted runtime structure only.
- Inventory documents active source/config/document ownership and snapshot completeness.

- [ ] **Step 1: Update architecture basis wording**

At the top of `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md`, supersede the stale August 13 reconciliation basis with the August 17 current snapshot:

```text
Eod Charting Platform Source Code 2026-08-17_014948_IST
```

Historical architectural evidence may remain where explicitly dated.

- [ ] **Step 2: Document W1.4-B1 static bundle ownership**

In the renderer/build architecture section add:

```markdown
### Production bundle partition

Vite manual chunking remains synchronous/static. Current chart ownership is:

- `feature-chart-canvas`: exact `src/components/ChartCanvas.tsx`
- `feature-chart-core`: remaining approved chart core (`src/engine/**` except analysis-owned paths, `src/store/chartStore.ts`, `src/features/charts/**`)
- `feature-chart-analysis`: `src/indicators/**`, `src/engine/Patterns.ts`, and `src/engine/candlestick/**`
- `vendor-technicalindicators`: `node_modules/technicalindicators/**`

No chart-runtime dynamic import was introduced by W1.4/W1.4-B1. The old `feature-chart-runtime` monolith is absent.
```

- [ ] **Step 3: Document W1.3 Watchlist lazy-data architecture**

In the Watchlists feature-services/data-flow section, state:

```markdown
Official Watchlists use a lightweight synchronous six-source metadata catalog plus source-selective lazy constituent payload modules. Successful payload promises are session-cached; rejected promises are evicted so retry remains possible. Existing live-source fetch with packaged-snapshot fallback semantics remain unchanged.
```

- [ ] **Step 4: Keep Corporate Actions review-first invariant explicit**

In the Corporate Actions architecture/data-flow section, add or ensure:

```markdown
The historical ISIN bootstrap is identity-evidence infrastructure, not an approval engine. V1.9.2's authorized safe-set bootstrap does not itself approve Corporate Actions. Further work resumes with a read-only current-state audit.
```

- [ ] **Step 5: Rewrite FILE_INVENTORY reconciliation basis**

Replace the stale August 13 basis paragraph with wording based on:

```text
Eod Charting Platform Source Code 2026-08-17_014948_IST
```

Do not state a file count until implementation calculates it from the actual supplied snapshot using the repository's snapshot policy.

- [ ] **Step 6: Register current documentation and warning-cleanup evidence**

Ensure the inventory includes current entries for:
- W1.1 warning hygiene evidence/docs;
- W1.2 Vite config ESM evidence/docs;
- W1.3 Official Watchlists lazy-data source/evidence;
- W1.4 chart-runtime static partition;
- W1.4-B1 ChartCanvas extraction;
- `docs/superpowers/specs/2026-08-17-canonical-documentation-reconciliation-design.md`;
- `docs/superpowers/plans/2026-08-17-canonical-documentation-reconciliation-plan.md`;
- `docs/changes/2026-08-17_CANONICAL_DOCUMENTATION_RECONCILIATION.md`.

Do not inventory `dist/`, `target/`, `release/`, portable EXEs, or database files as source.

---

### Task 5: Create the Dated Reconciliation Record

**Files:**
- Create: `docs/changes/2026-08-17_CANONICAL_DOCUMENTATION_RECONCILIATION.md`

**Interfaces:**
- Historical evidence record for this documentation-only operation.

- [ ] **Step 1: Create the report with fixed scope headings**

Use these headings:

```markdown
# Canonical Documentation Reconciliation — 2026-08-17

## Scope
## Basis
## Current State Recorded
## Corporate Actions Boundary
## Warning-Cleanup Closure
## Git Boundary
## Files Changed
## Validation
## Next Step
```

- [ ] **Step 2: Record evidence without overstating it**

Under `Current State Recorded`, include the final chunk sizes, portable SHA, manual PASS, and W1 closure.

Under `Corporate Actions Boundary`, explicitly distinguish:
- 283 safe imports / 281 tuples handled at identity-evidence level;
- no automatic Corporate Action approval;
- 9 + 3 + 49 are historical residual evidence only;
- fresh read-only current-state audit is required.

Under `Git Boundary`, state that Git was intentionally not invoked.

- [ ] **Step 3: Leave validation status pending only in the package template, then finalize it from actual wrapper results**

The payload used by the apply package must not falsely claim validation PASS before validation. The apply wrapper should write/finalize the report only after all documentation checks pass, or the prebuilt report must phrase validation as commands to be run rather than completed results.

Preferred implementation: generate the final report payload after package self-validation in the isolated build workspace, then apply that exact verified payload on Windows.

---

### Task 6: Preserve `REQUIREMENTS.md`, `AGENTS.md`, and Historical Evidence

**Files:**
- Verify only: `REQUIREMENTS.md`
- Verify only: `AGENTS.md`
- Verify only: pre-existing `docs/changes/**`

**Interfaces:**
- Preservation contract.

- [ ] **Step 1: Verify `REQUIREMENTS.md` does not assert Gann is the immediate project next step**

Current relevant text is a compatibility requirement:

```text
Gann fidelity work must start from the existing `gann` and `gannBox` persisted kinds...
```

This remains valid and must not be changed.

- [ ] **Step 2: Verify `AGENTS.md` Gann text is a protected drawing-fidelity baseline, not current scheduling authority**

Current relevant text instructs preserving the accepted Fibonacci baseline while starting Gann work. It is an operating constraint and remains valid.

- [ ] **Step 3: After applying payloads, compare preservation hashes**

Require:

```powershell
(Get-FileHash "$ProjectRoot\REQUIREMENTS.md" -Algorithm SHA256).Hash -eq $ExpectedRequirementsHash
(Get-FileHash "$ProjectRoot\AGENTS.md" -Algorithm SHA256).Hash -eq $ExpectedAgentsHash
```

For every pre-existing `docs/changes/*` file, require exact equality with the pre-apply hash inventory.

---

### Task 7: Build Documentation-Only Validation Guards

**Files:**
- Create package-only: `tools/check-canonical-doc-reconciliation.ps1`

**Interfaces:**
- Input: `-ProjectRoot`.
- Exit `0`: all content/path/preservation contracts pass.
- Exit non-zero: print each violated contract and stop.

- [ ] **Step 1: Require all eight canonical root docs**

Check existence of:

```text
AGENTS.md
HANDOFF.md
README.md
REQUIREMENTS.md
ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md
FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md
FILE_INVENTORY.md
PROJECT_STATE_EOD_CHARTING_PLATFORM.md
```

- [ ] **Step 2: Enforce required current-state markers**

Require these literal or regex-equivalent markers across canonical docs:

```text
W1.1
W1.2
W1.3
W1.4
W1.4-B1
07889C39B81D0F61D32A41C29FD9C7CBF210E6DE61BFB469D61F71D90DAB6281
COMPANY_IDENTITY_MISMATCH
CONFLICTING_ISIN_HISTORY
NO_CANDIDATE
read-only
Git
deferred
Eod Charting Platform Source Code 2026-08-17_014948_IST
```

- [ ] **Step 3: Enforce residual-count qualification**

Reject wording in current-authority sections that claims `9`, `3`, or `49` are definitive current remaining counts without nearby qualification such as:

```text
historical
re-audit
re-check
not assumed current
```

The checker may scan the paragraph containing each count.

- [ ] **Step 4: Enforce HANDOFF priority**

`HANDOFF.md` must:
- contain `Corporate Actions`;
- contain `read-only`;
- contain an `Exact next step` section;
- not contain Gann as the exact immediate next step.

A safe check is to extract the `## Exact next step` section and fail if it contains `Start the Gann family` or `Gann fidelity/acceptance` without an explicit `future` qualifier.

- [ ] **Step 5: Enforce no stale source-of-truth snapshot in current handoff**

The `HANDOFF.md` `Current source of truth` section must contain:

```text
Eod Charting Platform Source Code 2026-08-17_014948_IST
```

- [ ] **Step 6: Verify historical evidence preservation**

Compare all pre-existing `docs/changes/*` files against the saved pre-apply SHA-256 inventory. Permit only the new reconciliation record to be new/different.

- [ ] **Step 7: Verify protected root docs**

Verify `REQUIREMENTS.md` and `AGENTS.md` hashes exactly match basis.

---

### Task 8: Run Documentation Reference and Consistency Validation

**Files:**
- No further source changes unless a documentation validation defect is found.

**Interfaces:**
- Uses existing repository documentation checker without invoking Git.

- [ ] **Step 1: Run repository documentation reference checker directly**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-doc-references.ps1
if ($LASTEXITCODE -ne 0) {
    throw "Canonical documentation reference validation failed with exit code $LASTEXITCODE"
}
```

Expected:

```text
[PASS] Live documentation references are valid.
```

- [ ] **Step 2: Run the custom reconciliation contract**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File `
    ".\EOD_Chart_Canonical_Documentation_Reconciliation_<timestamp>_IST\tools\check-canonical-doc-reconciliation.ps1" `
    -ProjectRoot "E:\TA Projects\EOD Charting Platform"

if ($LASTEXITCODE -ne 0) {
    throw "Canonical documentation reconciliation contract failed with exit code $LASTEXITCODE"
}
```

- [ ] **Step 3: Verify no runtime/config file hash changed**

The package basis manifest should include hashes for sensitive sentinels such as:

```text
vite.config.mts
package.json
src/components/ChartCanvas.tsx
src-tauri-shell/src/main.rs
src-tauri-shell/src/database/corporate_action_imports/historical_isin_bootstrap.rs
```

Re-hash and require exact equality.

- [ ] **Step 4: Emit final changed-file list without Git**

Compare the before/after hash manifest and print only the eight approved project-write paths. Expected changed/new paths:

```text
README.md
HANDOFF.md
PROJECT_STATE_EOD_CHARTING_PLATFORM.md
FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md
ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md
FILE_INVENTORY.md
docs/changes/2026-08-17_CANONICAL_DOCUMENTATION_RECONCILIATION.md
docs/superpowers/plans/2026-08-17-canonical-documentation-reconciliation-plan.md
```

- [ ] **Step 5: Explicitly state operational non-actions**

Final validation output must include:

```text
NO RUNTIME SOURCE OPERATION was run.
NO DATABASE OPERATION was run.
NO GIT OPERATION was run.
```

---

### Task 9: Package the Guarded Windows Documentation Update

**Files:**
- Create package directory:
  `EOD_Chart_Canonical_Documentation_Reconciliation_<timestamp>_IST/`
- Create:
  - `Apply-EOD-Canonical-Documentation-Reconciliation.ps1`
  - `tools/check-canonical-doc-reconciliation.ps1`
  - `payload-manifest.json`
  - `PACKAGE_CONTENT_SHA256.txt`
  - `README.txt`
  - payload copies of the eight approved write paths

**Interfaces:**
- PowerShell parameters:

```powershell
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,

    [switch]$RunValidation
)
```

- [ ] **Step 1: Fail closed on source drift before mutation**

Verify the six modifiable canonical basis hashes plus `REQUIREMENTS.md`, `AGENTS.md`, and runtime sentinel hashes. If any differ, abort with:

```text
SOURCE BASIS DRIFT. No documentation files were changed.
```

- [ ] **Step 2: Create a verified documentation backup**

Copy only files that will be modified to:

```text
backups\pre_opencode_changes_<timestamp>_canonical-documentation-reconciliation
```

Verify every copied backup SHA-256 before applying payloads.

- [ ] **Step 3: Apply only allow-listed documentation payloads**

Reject any package payload outside the locked project-write allow-list.

- [ ] **Step 4: Verify payload hashes immediately**

Compare applied files with `payload-manifest.json`.

- [ ] **Step 5: Run validation when `-RunValidation` is supplied**

Order:

```text
1. Protected root-doc hash check
2. Historical docs/changes preservation check
3. Runtime/config sentinel hash check
4. Canonical reconciliation content contract
5. scripts/check-doc-references.ps1
6. Final changed-file allow-list report
```

Do not invoke `scripts/validate-change.ps1`, Git, npm, cargo, Tauri, or database utilities.

- [ ] **Step 6: Print final PASS**

Only after all gates pass:

```text
CANONICAL DOCUMENTATION RECONCILIATION PASS.
W1.1-W1.4-B1 closure: RECORDED.
Clean portable baseline/manual PASS: RECORDED.
Corporate Actions status: ACTIVE / UNFINISHED.
Immediate next step: READ-ONLY CURRENT-STATE AUDIT.
Historical residual counts: QUALIFIED FOR RE-AUDIT.
Gann: FUTURE DRAWING WORKSTREAM.
Git: EXPLICITLY DEFERRED.
Historical change evidence: PRESERVED.
NO RUNTIME SOURCE OPERATION was run.
NO DATABASE OPERATION was run.
NO GIT OPERATION was run.
```

- [ ] **Step 7: Package-integrity verification**

Create `PACKAGE_CONTENT_SHA256.txt`, zip the package, extract to a clean temporary directory, and verify each extracted package file against its manifest before delivery.

---

## Self-Review Checklist

- [ ] Six materially stale canonical documents are updated; `REQUIREMENTS.md` and `AGENTS.md` remain preserved.
- [ ] No historical change report is rewritten.
- [ ] Exactly one new reconciliation report is created.
- [ ] W1.1-W1.4-B1 closure appears consistently.
- [ ] Final portable SHA and manual PASS are recorded.
- [ ] W1.3 lazy Watchlist architecture remains protected.
- [ ] W1.4-B1 static chart partition is documented accurately.
- [ ] Corporate Actions V1.9.2 identity bootstrap is not misrepresented as Corporate Action approval.
- [ ] 9 + 3 + 49 are explicitly historical/re-audit-required.
- [ ] Immediate next step is read-only Corporate Actions audit.
- [ ] Gann remains future work and Fibonacci remains protected.
- [ ] Git is explicitly deferred.
- [ ] No Git command appears in execution steps.
- [ ] `scripts/validate-change.ps1` is not used because it invokes Git.
- [ ] No runtime/database/build operation is present.
- [ ] No `TBD`, `TODO`, or unresolved placeholder remains.

## Execution Handoff

Recommended execution mode: **Inline Execution**. This is a tightly bounded documentation-only reconciliation with cross-document consistency checks and an exact changed-file allow-list; keeping the edit/validation cycle in one session minimizes drift.

Because Git is explicitly deferred, execution must use verified backups and SHA-256 manifests instead of commits.
