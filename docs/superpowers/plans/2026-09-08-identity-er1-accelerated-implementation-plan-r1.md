# Identity ER1 Accelerated Implementation Plan R1

> **For agentic workers:** Execute task-by-task with fresh review gates. This project uses guarded evidence runners and explicitly forbids source-control commands in these tasks.

**Goal:** Add a deterministic read-only Official Source Health & Drift Assessor for NSE/BSE by reusing existing provenance, parser, population, and Recovery infrastructure.

**Architecture:** One new Rust assessor module performs in-memory fetch/evidence collection and reuses existing validators. One shared cross-source result contract flows through the Tauri bridge to a compact Identity UI table and optional Source Recovery Brief appendix. Existing downloaders, saved-source flows, and I3/I4 Apply authorities remain unchanged.

**Tech Stack:** Rust/Tauri, reqwest blocking client, serde, sha2, TypeScript/React, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-08-identity-er1-official-source-health-drift-design-r1.md`

## Global Constraints

- Project root: `E:\TA Projects\EOD Charting Platform`
- No automatic source replacement.
- No managed Identity source write from ER1 health assessment.
- No SQLite mutation from ER1 health assessment.
- No I3/I4 Apply from ER1.
- No saved URL rewrite.
- No automatic parser-adapter installation.
- No AI provider/API dependency.
- Existing F1-F5 and I3/I4 authority remains current.
- Cargo tests/checks are offline until the separately approved ER1-F live-network gate.
- No source-control command.

---

### ER1-B: One TDD RED gate

**Files:**
- Temporary test only: `src/features/corporateActions/__tests__/corporateActionIdentityOfficialSourceHealth.test.ts`

**Produces:** Evidence that the shared result contract, desktop method, Rust command/module, Official-mode health action, and Recovery Brief evidence formatter do not yet exist.

- [ ] Create one temporary source-contract Vitest with focused assertions for:
  - `OfficialSourceHealthReport`
  - `OfficialSourceHealthResult`
  - `assessIdentityOfficialSourceHealth`
  - Rust module/command `assess_identity_official_source_health`
  - `Check Source Health`
  - `formatOfficialSourceHealthMarkdown`
- [ ] Run the focused test and require deterministic RED.
- [ ] Require existing Identity source hashes to remain unchanged.
- [ ] Remove the temporary test after evidence capture.
- [ ] Review RED evidence before ER1-C.

Expected boundary: no production source mutation, no database, no network.

---

### ER1-C: Shared backend assessor + NSE + BSE

**Files:**
- Create: `src-tauri-shell/src/database/official_source_health.rs`
- Modify: `src-tauri-shell/src/database.rs`
- Modify: `src-tauri-shell/src/main.rs`
- Modify minimally for pure-function reuse:
  - `src-tauri-shell/src/database/nse_identity_imports.rs`
  - `src-tauri-shell/src/database/bse_identity_imports.rs`
- Modify bridge types:
  - `src/types/desktop.ts`
  - `src/platform/types.ts`
  - `src/platform/tauriDesktop.ts`

**Interfaces produced:**

```rust
pub async fn assess_identity_official_source_health(
    app: AppHandle,
) -> AppResult<OfficialSourceHealthReport>
```

```ts
assessIdentityOfficialSourceHealth(): Promise<OfficialSourceHealthReport>
```

- [ ] Add Rust `OfficialSourceHealthReport` / `OfficialSourceHealthResult`.
- [ ] Add an in-memory HTTP evidence helper that captures:
  request URL, final URL, status, bytes, SHA-256.
- [ ] Reuse the existing NSE/BSE provenance validators and redirect policies.
- [ ] Expose only the minimum pure parser/validator functions needed with module-local visibility.
- [ ] Implement the seven NSE logical assessments.
- [ ] Implement the BSE referer + Active/Delisted/Suspended assessments.
- [ ] Enforce NSE >=1000 and BSE Active >=1000 using existing population validators.
- [ ] Keep live-response freshness `NOT_APPLICABLE`.
- [ ] Emit `COMPATIBLE` only on a proven clean format pass.
- [ ] Leave `driftClass = null` when failure evidence cannot safely distinguish adapter drift from semantic change.
- [ ] Add fixture-only Rust tests; no network.
- [ ] Add command export + Tauri invoke registration + desktop bridge.
- [ ] Run focused Rust tests, F1-F5 regressions, NSE/BSE modules, and `cargo check --offline`.
- [ ] Review ER1-C evidence before ER1-D.

No existing downloader is replaced.

---

### ER1-D: Operator UI + Recovery Brief evidence

**Files:**
- Modify: `src/components/DatabaseToolsDialogs.tsx`
- Create: `src/features/identityRecovery/officialSourceHealthExport.ts`
- Modify or extend focused tests:
  - `src/features/corporateActions/__tests__/corporateActionIdentityOfficialSourceHealth.test.ts`
  - `src/features/corporateActions/__tests__/corporateActionIdentityRecoveryHandoffExport.test.ts`

**Consumes:** `assessIdentityOfficialSourceHealth()` and `OfficialSourceHealthReport`.

**Produces:**

```ts
export function formatOfficialSourceHealthMarkdown(
  report: OfficialSourceHealthReport,
): string
```

- [ ] Add `Check Source Health` beside the Official source controls.
- [ ] Store the latest report in renderer state only.
- [ ] Render the eleven results in a compact read-only table.
- [ ] Display drift class or `Not classifiable` without inventing a class.
- [ ] Keep Refresh & Preview, Preview Saved Sources, and Apply behavior unchanged.
- [ ] Add deterministic Markdown formatting for the latest report.
- [ ] Append that Markdown only to `source-recovery` export when a report exists.
- [ ] Preserve the other two Recovery exports byte-for-byte in behavior.
- [ ] Run focused UI/recovery tests and renderer typecheck.
- [ ] Review ER1-D evidence before ER1-E.

---

### ER1-E: Full offline validation

**Files:** no new production design.

- [ ] Verify exact ER1-C/D postimage hashes.
- [ ] Run focused ER1 Rust tests.
- [ ] Run focused ER1 frontend tests.
- [ ] Run F1/F2/F3/F4/F5 regressions.
- [ ] Run full NSE Identity module.
- [ ] Run full BSE Identity module.
- [ ] Run existing Recovery export regression.
- [ ] Run `cargo check --offline`.
- [ ] Run renderer TypeScript typecheck.
- [ ] If the project’s accepted build gate requires it, run renderer build.
- [ ] Capture one evidence ZIP; fail closed on any non-zero result.

No live network in ER1-E.

---

### ER1-F: Controlled live-network read-only verification

**Boundary:** network allowed; writes remain forbidden.

- [ ] Verify the ER1-E source hashes before network access.
- [ ] Run one controlled assessment against the currently configured official URLs.
- [ ] Require eleven logical result rows.
- [ ] Capture final URLs, HTTP statuses, byte counts, hashes, gate statuses, and drift classification.
- [ ] Confirm no managed source file timestamps/hashes changed.
- [ ] Confirm no SQLite mutation occurred.
- [ ] Confirm no I3/I4 Apply occurred.
- [ ] Export the Source Recovery Brief with the ER1 appendix and review it.
- [ ] If any source fails, preserve the evidence; do not auto-repair.
- [ ] Review ER1-F evidence before closeout.

---

### ER1-G: Current-authority closeout

**Files:**
- Create current-authority and handoff docs under `docs/superpowers/specs/`
- Create `docs/changes/<timestamp>_IDENTITY_ER1_OFFICIAL_SOURCE_HEALTH_DRIFT_CLOSEOUT.md`

- [ ] Bind ER1-B through ER1-F evidence hashes.
- [ ] Freeze final production source hashes.
- [ ] Record live-source verification outcome.
- [ ] Record that health assessment is read-only and non-authoritative for Apply.
- [ ] Preserve future Recovery work as a separate stage.
- [ ] Do not authorize automatic source replacement or parser adaptation.

Completion condition:

```text
ER1 = CLOSED
Official Source Health & Drift Assessor = CURRENT
Automatic Recovery = NOT AUTHORIZED
```
