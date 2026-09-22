# Corporate Action V1.7.3 Compound Residual Percentage Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make V1.7.2 compound residual presentation use percentage points instead of decimal ratios.

**Architecture:** Preserve all scanner and UI rendering paths. Change only the shared presentation helper contract so it matches the existing Corporate Action percentage formatter; update focused tests to lock the unit convention.

**Tech Stack:** React, TypeScript, Vitest, Tauri 2, Rust (guarded unchanged).

## Global Constraints

- No Rust production changes.
- No changes to compound factor computation, fingerprinting, approval gating, identity logic, raw EOD data, or adjustment math.
- Do not change global `formatCorporatePercent()` because existing callers already provide percentage points.
- Portable build is a manual gate after automated validation.

---

### Task 1: Lock the residual unit contract with tests

**Files:**
- Modify: `src/features/corporateActions/__tests__/corporateActionCompoundValidation.test.ts`

**Interfaces:**
- Consumes: `getCorporateActionPriceValidationPresentation(scan)`
- Produces: percentage-point expectations for `openResidualPct` and `closeResidualPct`

- [ ] Change BHARATRAS expected open residual from `0.0298989899` to `2.9898989899` and close residual from `0.0735353535` to `7.3535353535`.
- [ ] Change FCL expected open residual from `0.0277554304` to `2.7755430410`.
- [ ] Change ordinary +5% expected residual from `0.05` to `5`.
- [ ] Run the focused behavior check against V1.7.2 and verify it fails because BHARATRAS returns `0.029898...`.

### Task 2: Correct the presentation helper

**Files:**
- Modify: `src/features/corporateActions/corporateActionCompoundValidation.ts`

**Interfaces:**
- Consumes: actual price and theoretical price
- Produces: residual percentage points through `openResidualPct` / `closeResidualPct`

- [ ] Change `return actual / theoretical - 1;` to `return (actual / theoretical - 1) * 100;`.
- [ ] Re-run the behavior check and verify BHARATRAS ≈ `2.9899`, FCL ≈ `2.7755`, ordinary +5% = `5`.
- [ ] Transpile the helper and test file to verify TypeScript syntax.

### Task 3: Package and project validation

**Files:**
- Create: `docs/changes/2026-08-15_1905_IST_CORPORATE_ACTION_PHASE1_COMPOUND_RESIDUAL_PERCENTAGE_FIX_V1_7_3.md`

- [ ] Guard V1.7.2 helper/test hashes plus unchanged `DatabaseToolsDialogs.tsx` and Rust Corporate Action source hashes.
- [ ] Apply only the helper, test, and documentation payloads.
- [ ] Run four focused Corporate Action Vitest suites.
- [ ] Run `npm run typecheck:renderer`.
- [ ] Run `npm run build:renderer`.
- [ ] Run `npm run tauri:check`.
- [ ] Rebuild portable only after all automated gates pass, then manually verify BHARATRAS/FCL/NAZARA residual display.
