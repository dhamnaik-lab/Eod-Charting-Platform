# Corporate Action UI/UX Modernization — Phase A Audit and Design

## IST timestamp

2026-09-01 23:50 IST

## Objective

Create the documentation authority for a user-facing Corporate Action modernization based on the approved Option B workflow:

```text
Fetch Data → Load & automatic processing → Review → Approve
```

No implementation is authorized by this change.

## Previous defect or limitation

The current Corporate Action interface mixes routine operations, maintenance, resolution, diagnostics, validation, selection, and approval in a dense technical workbench. Runtime review showed overlapping multiline table content, too many competing controls, source-row-centric presentation, unclear workflow progression, and specialist identity/maintenance concepts exposed to the normal user.

The validated Corporate Action engine itself must remain unchanged.

## Files created

- `docs/superpowers/specs/2026-09-01-corporate-action-ui-ux-modernization-phase-a-design.md`
- `docs/superpowers/specs/2026-09-01-corporate-action-ui-ux-modernization-product-decisions.md`
- `docs/superpowers/specs/2026-09-01-corporate-action-ui-ux-behavior-preservation-matrix.md`
- `docs/superpowers/specs/2026-09-01-corporate-action-ui-ux-component-data-flow-design.md`
- `docs/superpowers/plans/2026-09-01-corporate-action-ui-ux-modernization-implementation-plan.md`
- `docs/changes/2026-09-01_2350_IST_CORPORATE_ACTION_UI_UX_MODERNIZATION_PHASE_A_AUDIT_DESIGN.md`

## Final documentation

The design locks these user-facing decisions:

- dedicated full-page Corporate Action workspace;
- Fetch → Load → Review → Approve;
- one primary action per stage;
- one-click automatic catch-up Fetch;
- one-click Load plus automatic identity/dedupe/compound/validation processing;
- exceptions-first Review;
- grouped economic-event cards;
- right-side read-only evidence drawer;
- five statuses: Ready, Needs Review, Conflict, Approved, Already Processed;
- evidence-only exceptions in normal workflow;
- unresolved exceptions carry forward and remain visible;
- one direct Review-to-Approve handoff;
- one-click approval of all Ready events;
- backend recheck with partial-success/fail-closed result;
- automatic stage resume;
- specialist maintenance under Database Tools;
- documentation approval before implementation.

## Behavior deliberately preserved

- V1.14AD engine authority: commit `2103e9ffcaaad28bd903c9cb71310316c68f2ffd` and tree `6bc7dd2b393b3baf78ff97539c9eb7b8c8f42c77`;
- identity and historical ISIN rules;
- equivalent-event deduplication;
- genuine compound Split/Bonus behavior;
- price-validation mathematics;
- stale evidence and conflict fail-closed rules;
- approval eligibility, idempotency, provenance, and backend recheck;
- internal approval batching at no more than 100;
- no automatic approval;
- raw EOD immutability;
- specialist maintenance capability.

## Validation commands

Documentation-package validation only:

```text
- UTF-8/LF file generation
- required-path inventory
- SHA-256 manifest generation
- internal link/path scan
- prohibited placeholder scan
- ZIP content and hash verification
```

No npm, Vitest, TypeScript, Vite, Cargo, Tauri, packaging, application launch, or database command was run for this documentation-only phase.

## Actual validation results

- Six required Markdown documents generated: PASS.
- Required design decisions present: PASS.
- Required preservation constraints present: PASS.
- Implementation plan contains task-level TDD and validation commands: PASS.
- Source/runtime/config files modified by document authoring package: NONE.
- Database accessed or modified: NO.
- Git staged/committed: NO.
- Live-repository installation: NOT YET PERFORMED; use the supplied documentation installer after review.

## Evidence basis and limitation

The design is grounded in:

- the confirmed V1.14AD commit/tree/package authority;
- prior Corporate Action design and validation records;
- the focused five-file/32-test Corporate Action frontend inventory;
- observed current runtime screenshots and operator feedback;
- known current source paths and UI/bridge/backend boundaries.

The uploaded source archive was not available as mounted bytes in this execution environment. Therefore the implementation plan begins with a mandatory read-only live-repository source/hash/signature verification before any source edit. No line-level claim about the current live repository is treated as implementation authority until that gate passes.

## Risks or limitations

- The full-page integration point and exact current bridge method signatures must be verified from the live repository before implementation.
- Automatic stage derivation should use existing persisted state; a new schema is not authorized.
- A required backend semantic/write/schema change is outside this design and must stop implementation pending a separately approved amendment.
- UI simplification must not delete maintenance functionality until every legacy handler is mapped and regression-tested.

## Rollback guidance

Delete the six documentation files listed above. No source, index, history, database, build output, or package rollback is required.

## Classification

```text
CORPORATE_ACTION_UI_UX_MODERNIZATION_PHASE_A_DOCUMENTATION_PREPARED__IMPLEMENTATION_NOT_AUTHORIZED
```

## Recommended next step

Install the documentation package into the project, review the design/spec/matrix/plan, and explicitly approve implementation Task 1 only. Do not begin source modification before that approval.
