# Identity Import I2 Compact UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved compact Identity Import exchange/source workspace while preserving existing identity backends and safety separation.

**Architecture:** Keep `DatabaseToolsDialogs.tsx` as the active Identity host. Add only frontend exchange/source selection, source browsing, NSE source-refresh orchestration, shared Preview/Apply dispatch, compact styling, and updated help copy. Existing NSE/BSE backend APIs remain unchanged.

**Tech Stack:** React + TypeScript + Vitest + Tauri desktop bridge.

**Spec:** `docs/superpowers/specs/2026-09-05-identity-import-i2-compact-ui-approved-design.md`

## Global Constraints

- Project root: `E:\TA Projects\EOD Charting Platform`
- Manual Entry unchanged.
- Official Imports R1C-I1 unchanged.
- Identity I1 Current exchange fix preserved.
- No backend/database schema or mutation behavior change.
- No package dependency change.
- No Git/source-control command in the supplied runner.

---

### Task 1: TDD lock the compact Identity surface

**Files:**
- Create: `src/features/corporateActions/__tests__/corporateActionIdentityCompactWorkspace.test.ts`
- Modify after RED: `src/features/corporateActions/__tests__/corporateActionIdentityImportCharacterization.test.ts`

**Interfaces:**
- Consumes: `DatabaseToolsDialogs.tsx` source contract.
- Produces: current characterization for the compact Identity surface.

- [ ] **Step 1:** Install the focused I2 test before production source changes.
- [ ] **Step 2:** Run the focused test and require failure because `Refresh NSE Sources`, `Refresh BSE Sources`, selector structure, and shared Preview/Apply do not yet exist.
- [ ] **Step 3:** Do not patch production unless RED is confirmed.

### Task 2: Implement compact exchange/source organization

**Files:**
- Modify: `src/components/DatabaseToolsDialogs.tsx`

**Interfaces:**
- Consumes existing handlers: `previewCurrentUniverseSync`, `applyCurrentUniverseSync`, `downloadBseCurrentUniverseMaster`, `previewBseCurrentUniverseSync`, `applyBseCurrentUniverseSync`, `importNseIdentityArchive`.
- Produces: `refreshNseIdentitySources`, `selectIdentityExchange`, `selectIdentitySourceMode`, `previewSelectedIdentitySource`, `applySelectedIdentitySource`.

- [ ] **Step 1:** Add `identityExchange` and `identitySourceMode` state plus separate remembered official/manual BSE paths.
- [ ] **Step 2:** Replace separate NSE download buttons with `refreshNseIdentitySources`, calling current master then de-listed workbook and never Apply.
- [ ] **Step 3:** Preserve BSE lifecycle download and label it `Refresh BSE Sources`; remember its managed file path.
- [ ] **Step 4:** Add manual NSE folder browse and BSE CSV browse using existing desktop bridge methods.
- [ ] **Step 5:** Add shared Preview/Apply dispatch based on selected exchange/source.
- [ ] **Step 6:** Replace the flat toolbar with the approved compact selector/source/action layout.
- [ ] **Step 7:** Rename the Identity filter shortcut to `Current Chart` without changing I1 resolution logic.
- [ ] **Step 8:** Update Identity help copy to describe actual NSE/BSE source composition.

### Task 3: Evolve characterization authority and verify

**Files:**
- Modify: `src/features/corporateActions/__tests__/corporateActionIdentityImportCharacterization.test.ts`
- Test: `src/features/corporateActions/__tests__/corporateActionIdentityCompactWorkspace.test.ts`
- Test: `src/features/corporateActions/__tests__/corporateActionIdentityCurrentShortcut.test.ts`

- [ ] **Step 1:** Replace obsolete pre-I2 label assertions with semantic capability assertions.
- [ ] **Step 2:** Run I2 focused GREEN.
- [ ] **Step 3:** Run revised Identity characterization.
- [ ] **Step 4:** Run I1 Current shortcut regression.
- [ ] **Step 5:** Run the full Corporate Action frontend suite.
- [ ] **Step 6:** Run renderer typecheck.
- [ ] **Step 7:** Run renderer build.
- [ ] **Step 8:** Run portable Windows build.

### Task 4: Evidence and manual checkpoint

**Files:**
- Create: `docs/changes/YYYY-MM-DD_HHMM_IST_IDENTITY_IMPORT_I2_COMPACT_UI.md`

- [ ] **Step 1:** Record pre/post hashes and automated validation results.
- [ ] **Step 2:** Package preimage/postimage, tests, logs, spec, plan, and report into evidence ZIP.
- [ ] **Step 3:** Manually check compact layout at normal Windows scaling and confirm no duplicate legacy buttons.
- [ ] **Step 4:** Manually verify NSE Official, BSE Official, NSE Manual, BSE Manual, Browse, Preview, Apply, Historical Identity, and Current Chart presentation before closing I2.


### Task 3A: Harden the I1 regression against formatting-only changes

**Files:**
- Modify: `src/features/corporateActions/__tests__/corporateActionIdentityCurrentShortcut.test.ts`

**Interfaces:**
- Consumes: accepted I1 Current resolver semantics.
- Produces: whitespace-insensitive semantic regression coverage.

- [ ] **Step 1:** Verify the exact accepted I1 test preimage SHA.
- [ ] **Step 2:** Replace only the one-line formatting-sensitive resolver assertion with a whitespace-normalized semantic assertion.
- [ ] **Step 3:** Run the revised I1 regression against the unchanged post-I1/pre-I2 production source and require PASS.
- [ ] **Step 4:** Continue I2 RED/GREEN.
- [ ] **Step 5:** Run the revised I1 regression again after I2 and require PASS.
