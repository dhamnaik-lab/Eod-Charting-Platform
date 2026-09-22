# Official Imports UX — Approved Documentation / Implementation Handoff

**Prepared IST timestamp:** 2026-09-18 17:56:20 IST (UTC+05:30)  
**Root:** `E:\TA Projects\EOD Charting Platform`  
**Mode:** documentation only; application implementation has not started.

## Objective / previous limitation

Record the user's approval before coding: simplify the existing Official Imports UI, automatically prepare pending records, show expandable symbol/action review, and retain explicit Apply All Ready / Apply Selected. Earlier current-status content included superseded staging/reconstruction directions; the new scoped header makes this task discoverable without deleting that history.

## Files created

- `docs/superpowers/specs/2026-09-18-official-imports-user-friendly-approval-approved-scope-r1.md`
- `docs/superpowers/plans/2026-09-18-official-imports-user-friendly-approval-bounded-implementation-r1.md`
- `docs/changes/2026-09-18_1756_IST_CA_OFFICIAL_IMPORTS_UX_APPROVED_DOCS.md` (this record)

## File modified

- `docs/CURRENT_WORK_STATUS.md`: prepend the scoped approved task and links; every original byte remains preserved after the prefix.

## Final documentation content

Queue scope is all outstanding pending imports, including older unapproved records. Existing CorporateActionDialog stays active; no broad redesign, new persistence/approval authority, backend/schema/API change, or dormant-workspace activation. Identity UX follows separately. Routine matching/validation is app work; strict staged quick-resolution/scans may run during preparation through existing backend owners. No final or exceptional approval is permitted during Fetch/Load. Ordinary Apply remains limited to eligible reviewed IDs in the current filter and explicit operator confirmation.

## Behavior preserved / actual changes

No application behavior, source, profile setting, database, build system, dependency or executable changes in this step. Gann and ER4 dispositions remain unchanged. Source implementation is authorized after successful docs installation/source preflight, but is NOT claimed executed or complete.

## Validation commands and results

Preparation checks cover parent ZIP SHA/integrity, manifest derivation, archive membership and payload hashes, exact documentation preimages, preserved current-status suffix, document links and scope. Actual preparation results accompany the delivery validation record.

The installer will verify exact 548-file source and support-file hashes, document preimages, install only these four documentation paths, compare PRE/POST source inventories, recheck support and docs hashes, and verify the evidence archive member hashes before removing scratch space. The installer executes no app tests/typecheck/build/database/network/Git/snapshot operation. Windows execution results and actual IST run time are written to its evidence SUMMARY.json; they are pending until the operator runs it. A lexical runner check is not a native Windows parser result.

## Risk / limitations

Docs approval does not certify the future UI. Runtime readiness, safe database-context handling and exceptional-decision visibility must pass the defined tests/manual checkpoint. If existing APIs cannot support the scope safely, report that gap before backend or architectural work. An unexpected live-source/doc difference blocks installation instead of overwriting work.

## Rollback

The installer creates a bounded backup of the replaced current-status document and records each created target. On failure it attempts to restore only those touched documentation paths and retains evidence. For deliberate later rollback, use that manifest/backup, remove only docs created by this step, and verify the unchanged 548-file source. Do not restore unrelated source or database files.

## Evidence / next step

Parent snapshot: `Eod Charting Platform Source Code 2026-09-18_140123_IST.zip` / `0EF8966CD8F4C29DAE0F032372322B88827FF44985968688AE1C4BFA6897666F`. The package contains protected-source, support-file and documentation-delta manifests with exact pre/post hashes. Evidence and backup are written only below project `tmp`.

Next: once the documentation installation is confirmed, proceed with the already-approved single bounded Official Imports frontend implementation. No approval round for every internal checkpoint; stop for material scope/authority/safety changes. Manual acceptance and fresh snapshot remain later completion gates.
