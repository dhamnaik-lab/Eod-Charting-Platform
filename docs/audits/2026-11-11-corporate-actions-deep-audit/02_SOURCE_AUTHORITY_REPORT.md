# Corporate Actions Deep Audit — Source Authority Report

**Audit Timestamp:** 2026-11-11 IST  
**Authorized Project Root:** `E:\TA Projects\EOD Charting Platform`  
**GitHub Repository:** `https://github.com/dhamnaik-lab/Eod-Charting-Platform`

---

## 1. Local Revision & Remote Authority Comparison

| Attribute | Value | Verification Evidence |
|---|---|---|
| Active Branch | `main` | `git rev-parse --abbrev-ref HEAD` (`logs/git_status.txt`) |
| Local `HEAD` Commit (Current 2026-11-11) | `fc3563be9bf6bf7f8ebbee2ea8eb5a490df9471e` | `git rev-parse HEAD` (`logs/git_log.txt`) |
| Initial Audit Snapshot Commit (2026-11-06) | `e8664382c116b96bce1d105a9b9fa837175d77a0` | Ancestor of `HEAD`; merged PR #75 (`9d5f64d`) and PR #100 (`fc3563b`) into `main` |
| Remote `origin/HEAD` | `fc3563be9bf6bf7f8ebbee2ea8eb5a490df9471e` | `git ls-remote origin HEAD refs/heads/main` |
| Remote `origin/main` | `fc3563be9bf6bf7f8ebbee2ea8eb5a490df9471e` | Exact SHA-1 match with local `HEAD` |
| Remote `origin/ca-audit-dividend-observability-pr7` | `4a923da9fc1e3c42be50bb39f2ddda1200dbafad` | Merged into `main` via `1cf7e59b5c7cefb20a214c99e630294483bc72f6` |
| Remote `origin/ca-audit-safev2-skipped-focus-pr6` | `8d9bb6255966c8e4527579d65d6371170a836f97` | Merged into `main` via `eb7993c36b00f15bbab00d86234e070365187010` |
| Remote `origin/ca-audit-safev2-observability-pr5` | `85ed1ab5d3f8515984abbb98efca98f3274c312b` | Merged into `main` via `826e1ad11234f259c039815a560f0bfbe21b18ec` |
| Remote `origin/ca-audit-stabilization-pr4` | `a11deda40f19402546c04eb8a3008b2255deffbb` | Merged into `main` via `3ef48b63bd2b5a817e3ebbc3931797deed7ab5ab` |
| Remote `origin/ca-audit-stabilization-pr3` | `7c935a764c3be9e49ff13a5a81fc46a4923f821e` | Merged into `main` via `a9ca18794c6ad868ddbb8d78b007b5c102f094fb` |

**Verdict on Remote Synchronization:** Local `HEAD` (`fc3563be9bf6bf7f8ebbee2ea8eb5a490df9471e`) matches `origin/main` and `origin/HEAD` exactly. All historical Corporate Actions audit/stabilization PR branches (`PR #3` through `PR #7`, plus `PR #75` `9d5f64d4e1fe27e169f137896d5fcd5a534bb0ea` and `PR #100` `fc3563be9bf6bf7f8ebbee2ea8eb5a490df9471e`) are merged ancestors of `HEAD`.

---

## 2. Recent Commit History (`logs/git_log.txt`)

Key Corporate Actions commits in `HEAD`:
- `fc3563b` — `Merge pull request #100 from dhamnaik-lab/codex/local-wip-reconciliation-20261109` (`a626c97 Reconcile preserved local WIP, themes and accepted main behavior`)
- `9d5f64d` — `Merge pull request #75 from dhamnaik-lab/feat/ca-identity-gaps-20261108` (`feat(ca): verify single-rename split and bonus adjustment owners`: adds `split_bonus_symbol_chain.rs` and `split_isin_price_proof.rs`)
- `e866438` — `fix(corporate-actions): fill missing BSE security codes during official Fetch`
- `f3d0b5a` — `fix(corporate-actions): prepare combined Split+Bonus pending components`
- `6274903` — `fix(corporate-actions): block incomplete Split/Bonus terms during Load & Validate`
- `c4c579e` — `fix(corporate-actions): refresh pending classifications during Load & Validate`
- `de596a3` — `fix(corporate-actions): support dated symbol-chain price route for Split/Bonus`
- `cf5412b` — `fix(corporate-actions): verify Split/Bonus same-ISIN historical symbol price proof`
- `8ce6da1` — `fix(corporate-actions): defer non-split/bonus actions in normal workflow`
- `bbff383` — `fix(corporate-actions): complete normal three-action workflow`
- `a0f8f7b` — `feat(corporate-actions): add Classic compact workflow`

---

## 3. Uncommitted Working Tree State (`2026-11-11`)

Full output retained in `logs/git_status.txt`.

### 3.1 Corporate Actions Source Files With Uncommitted Modifications
- **Zero (`0`)** Corporate Actions source or test files under `src/features/corporateActions/` or `src-tauri-shell/src/database/corporate_action_imports*` have uncommitted modifications at `HEAD` (`fc3563be9bf6bf7f8ebbee2ea8eb5a490df9471e`).
- *(Note: On `2026-11-06` at `e866438`, `bse_identity_mapping.rs` had an uncommitted `+64/-1` T+0 `#` settlement variant refinement; that exact refinement was subsequently committed into `main` via `a626c97` / PR #100. Its diff is preserved in `logs/diff_bse_identity_mapping.txt` for historical completeness.)*
- In `src-tauri-shell/src/database/`, only `bootstrap.rs` has uncommitted modifications (related to Bhavcopy/market holiday calendar tables), plus Bhavcopy and theme files outside the Corporate Actions subsystem.

---

## 4. Active vs. Retired / Historical Corporate Actions Modules

| Path | Status | Evidence |
|---|---|---|
| `src/components/DatabaseToolsDialogs.tsx` (`CorporateActionDialog`) | **ACTIVE PRODUCTION HOST** | Mounted by `src/App.tsx`; hosts Classic workspace and Advanced tabs (`pending`, `approved`, `fetch`, `history`, `scan`, `issues`, `manual`, `identity`). |
| `src/features/corporateActions/workspace/CorporateActionClassicWorkspace.tsx` | **ACTIVE CLASSIC UI** | Rendered inside `DatabaseToolsDialogs.tsx` when `classicCorporateActionsView === true` (default `true`). |
| `src/features/corporateActions/legacy/corporateActionImportOperations.ts` | **ACTIVE WORKFLOW ORCHESTRATOR** | Called by `DatabaseToolsDialogs.tsx` for `Fetch from Officials`, `Load & Validate`, and `Approve Selected Ready`. |
| `src/features/corporateActions/workspace/CorporateActionNormalWorkflowWorkspace.tsx` | **RETIRED / UNMOUNTED DONOR** | Not mounted by `src/RootApp.tsx` or `src/App.tsx` (enforced by `corporateActionThreeActionCompletionR1.test.ts` and `corporateActionNormalWorkflowWorkspace.test.tsx`). |
| `src/features/corporateActions/workflow/corporateActionNormalWorkflowAdapter.ts` | **PARTIALLY SHARED / DONOR ADAPTER** | `runNormalWorkflowLoadAndValidate` and `runNormalWorkflowApproveReady` are only used by the unmounted `CorporateActionNormalWorkflowWorkspace.tsx`; helper predicates (`getCorporateActionRowReadiness`, `getCorporateActionBlockedCategory`, `isExistingCorporateActionRow`, `formatCorporateActionTerms`) are imported by `DatabaseToolsDialogs.tsx`. |
| `src/features/corporateActions/workflow/corporateActionAutoApprovalSettings.ts` | **DISABLED BY POLICY** | `DEFAULT_AUTO_APPROVE_SAFE_SPLIT_BONUS_R1 = false`; `readAutoApproveSafeSplitBonusR1Setting()` always returns `false` and clears legacy localStorage key `eod.corporateActions.autoApproveSafeSplitBonusR1`. |
| `tmp/*` and `backups/*` | **NON-AUTHORITATIVE ARCHIVES** | Historical snapshots, disposable copies, and candidate worktrees. Not part of the active runtime, though unscoped `vitest run` erroneously traverses them (see Finding CA-AUD-003). |
