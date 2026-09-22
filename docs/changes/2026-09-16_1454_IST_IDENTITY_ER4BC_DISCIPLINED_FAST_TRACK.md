# Identity ER4-BC Disciplined Fast-Track

**IST timestamp:** `2026-09-16 14:54:03 +05:30`  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Parent source authority:** `Eod Charting Platform Source Code 2026-09-16_001332_IST.zip`  
**Parent snapshot SHA-256:** `08D9D895BD20B5BFB7522F15196046D74B902469EF03B5C19692485F380D3624`

## Objective

Implement the approved combined ER4-B + ER4-C disciplined fast-track while preserving the frozen ER4 Design R1 semantics and the accepted ER4-A authority.

## Previous limitation

ER4-A could deterministically bind technically validated ER3-B candidates to a current source version/revision, but the application still lacked durable per-source version authority, reviewed manual URL saves, durable Keep/Reject review decisions, per-source history, and operator candidate-review controls.

## Files created

- `src-tauri-shell\src\database\official_source_version_history.rs`
- `src\features\identityRecovery\__tests__\identityEr4SourceRecovery.test.ts`
- `docs\changes\2026-09-16_1454_IST_IDENTITY_ER4BC_DISCIPLINED_FAST_TRACK.md`

## Files modified

- `src-tauri-shell\src\database.rs`
- `src-tauri-shell\src\database\bootstrap.rs`
- `src-tauri-shell\src\database\bse_identity_imports.rs`
- `src-tauri-shell\src\database\nse_identity_imports.rs`
- `src-tauri-shell\src\database\official_source_candidate_review.rs`
- `src-tauri-shell\src\database\official_source_health.rs`
- `src-tauri-shell\src\database\official_source_urls.rs`
- `src-tauri-shell\src\database\settings.rs`
- `src-tauri-shell\src\main.rs`
- `src\components\DatabaseToolsDialogs.tsx`
- `src\features\corporateActions\__tests__\corporateActionIdentityImportCharacterization.test.ts`
- `src\platform\tauriDesktop.ts`
- `src\platform\types.ts`
- `src\types\desktop.ts`

## Final implementation

### ER4-B

- dedicated immutable source-version ledger;
- nine-source atomic baseline migration and current pointers;
- ledger-authoritative official-source read model;
- compatibility JSON mirror retained and atomically updated;
- versioned reviewed manual source saves with revision/fingerprint stale fencing;
- generic `officialSourceUrls.v1` setting writes fail closed with `OFFICIAL_SOURCE_URLS_REQUIRES_REVIEWED_SAVE`;
- existing nine-field manual URL editor and visible success/health-clearing workflow preserved;
- restart, corruption, idempotency and failure-injection behavior covered by test-owned SQLite fixtures.

### ER4-C

- controlled candidate discovery for exactly five eligible failed NSE source contracts;
- existing ER3-B transport/parser/budget authority reused;
- durable `KEEP_CURRENT` and `REJECT_CANDIDATE` review events;
- non-empty rejection notes required;
- stale decisions return `ER4_STALE_REJECTED` with zero review-event write;
- per-source immutable version/review history;
- candidate evidence/history UI adjacent to existing source-health tooling;
- exact `Find Official Replacement Candidates`, `Keep Current URL`, and `Reject Candidate` actions;
- no `Approve Replacement` affordance and no promotion behavior.

## Behaviour preserved

- ER4-A deterministic fingerprint/review authority;
- I3/I4 reviewed mutation authority;
- ER1 source-health behavior;
- ER2 resolver/shadow behavior;
- ER3-A/B discovery/validation semantics;
- current manual Official Source URLs visible workflow;
- current official-source URLs at baseline;
- BSE source behavior;
- current download/archive ownership;
- deferred NSE staging concurrency issue;
- no automatic promotion;
- no automatic rollback;
- no I3/I4 Apply coupling;
- no ER5+.

## Automated validation

- ER4-B backend RED: PASS — expected missing `ensure_official_source_baseline`.
- ER4-B frontend RED: PASS — reviewed authority command absent before B implementation.
- ER4-B focused GREEN: PASS — 12/12.
- ER4-B ER4-A preservation: PASS — 12/12.
- ER4-B official-source provenance: PASS — 5/5.
- ER4-B ER1 preservation: PASS — 10/10.
- ER4-B existing bootstrap preservation: PASS — 1/1.
- ER4-B `cargo check --locked --offline`: PASS.
- ER4-B focused Vitest: PASS.
- ER4-B existing source-health/characterization Vitest: PASS.
- ER4-B renderer typecheck: PASS.
- ER4-B renderer build: PASS.
- ER4-C backend RED: PASS — candidate-review orchestration absent before C implementation.
- ER4-C frontend RED: PASS — C command/UI contract absent before C implementation.
- ER4-C FIX2 stale-fence RED: PASS — pinned original GREEN returns `ER4_REVIEW_PLAN_INVALID` for stale base revision.
- ER4-C FIX2 stale-fence GREEN: PASS — stale base version/revision/URL check precedes full review-plan integrity inside the decision transaction.
- ER4-C focused GREEN: PASS — 9/9.
- Final ER4-B GREEN rerun: PASS — 12/12.
- ER4-A regression: PASS — 12/12.
- ER3-A regression: PASS — 18/18.
- ER3-B B1 regression: PASS — 7/7.
- ER3-B B2 regression: PASS — 5/5.
- ER3-B online authorization guard: PASS — deliberate fail-closed RED with `ER3B_ONLINE_AUTHORIZATION_REQUIRED`; no production network request.
- Official-source runtime provenance: PASS — 5/5.
- ER1 regression: PASS — 10/10.
- NSE delisted discovery/fallback: PASS — 5/5 + 1/1.
- I3 regression: PASS — 5/5.
- I4 regression: PASS — 9/9.
- ER2-A regression: PASS — 22/22.
- ER2-B regression: PASS — 45/45.
- ER2-C1 regression: PASS — 19/19.
- ER2-C2 regression: PASS — 25/25.
- Final `cargo check --locked --offline`: PASS.
- Final ER4-BC focused Vitest: PASS.
- Existing source-health/characterization Vitest: PASS.
- Final renderer typecheck: PASS.
- Final renderer build: PASS.
- Live/user database: NOT OPENED BY RUNNER.
- Production network acquisition: NOT INVOKED.
- Git/source-control: NOT USED.
- Promotion/rollback/ER4-D/ER4-E: NOT IMPLEMENTED.
- Manual operator checkpoint: PENDING.

## Installed source hashes

- src-tauri-shell/src/database/official_source_version_history.rs: 3684650ABC04C1D4EB6A0036D1F1E3784F9881588B7994885D0ADDD91BD269A5
- src/features/identityRecovery/__tests__/identityEr4SourceRecovery.test.ts: 28A39E715367A9C7CC4267CCEE12F9CCC214DE03B6ED0DEB44927136F5EF0DC4
- src-tauri-shell/src/database.rs: B8DFCF7E4DB697DCF244BE0C49AC466091304C9E70D960A0238D288E06EC7AB3
- src-tauri-shell/src/database/bootstrap.rs: 205C54181D97344C296DB16A2670D6B6DD5B798E8C411528DE641FB7C74D3059
- src-tauri-shell/src/database/bse_identity_imports.rs: 799C8AE0F7B54694AC9E81EFCC1277512E903C69036E38A1CCF8ED22A8E36A3A
- src-tauri-shell/src/database/nse_identity_imports.rs: CD82FEE8B6317A56D01A52CEFD1CDCDF33CADD2F668DCC47BF60B4B00E3B41F6
- src-tauri-shell/src/database/official_source_candidate_review.rs: 7A58CC67883A38DC6B7165D140838F3040A6F312E64ACF09D2EFD3FB1A95F8A2
- src-tauri-shell/src/database/official_source_health.rs: 170D6A97DB6308C6C21089771020BEA38FE683121EB04B046CC6E1BE4BE9FF24
- src-tauri-shell/src/database/official_source_urls.rs: BE9C7140BF3501D8FBF208CC9F14F2F77529FAE6A15F4D3B7A3D4A0C7C0002C4
- src-tauri-shell/src/database/settings.rs: 79E7E36DF764C2997C84711B304E81580BE0B5530278ABA9A7A5C675E5596210
- src-tauri-shell/src/main.rs: 9674419F230645FB334CA79045EFFD7AB88357286B60E4C69D47252F7C902618
- src/components/DatabaseToolsDialogs.tsx: C5704005EF09FEF14DD39074FC1D0089EB1E1C217B4F5F78AB059E34F2CDC372
- src/platform/tauriDesktop.ts: A0DC7489DEC38E125E52351D6CD226A35FAFCC6A397441FB0CC73071F7C0FD47
- src/platform/types.ts: 5F09FDFBFD14D20B06C2A431E6B9417AF5B3ECDDAB8672CEABBF69E4B6695549
- src/types/desktop.ts: 1EC98968EBAA32AEB06B417762DD0468905EA84625053E63CE5443D83772144A
- src/features/corporateActions/__tests__/corporateActionIdentityImportCharacterization.test.ts: 809541A56609E62AF24116763E1231F808F2CE7139CED8DD2934D7184DB0D3CA

## Manual checkpoint

Status at automated runner completion:

`MANUAL_CHECKPOINT_PENDING`

Required operator proof before ER4-BC can be independently closed:

1. Existing Official Source URLs editor still opens, shows all nine fields, Reset Defaults, and Apply URLs.
2. An eligible failed NSE source row shows `Find Official Replacement Candidates`.
3. Healthy NSE, BSE, and landing-page rows do not show that action.
4. `Keep Current URL` records history without changing the configured URL.
5. `Reject Candidate` requires a non-empty rejection note and records history without changing the configured URL.
6. Candidate/history panel shows the frozen classification labels and evidence fields.
7. No `Approve Replacement` action or other promotion affordance exists.

## Risks / limitations

- Opening an existing database after installation performs the approved ER4-B baseline migration and normalizes the compatibility mirror to all nine fields.
- Candidate discovery is operator-triggered and may use network at runtime; automated validation did not invoke production network acquisition.
- ER4-D promotion and ER4-E rollback are not implemented.
- ER4-BC is not closed until the manual checkpoint and independent evidence acceptance are complete.

## Rollback guidance

Restore all modified files from the accepted `001332` snapshot, remove the two new protected files, and remove this change record. Re-verify the accepted 544-entry protected-source manifest. Database rollback is not performed by this runner because it never opens the live/user database.

## Next step

Complete the manual checkpoint and submit the automated evidence plus checkpoint result for independent ER4-BC acceptance. Only after BC closeout and a fresh accepted snapshot may ER4-DE begin.


## ER4-BC FIX2 stale-fence correction

The accepted base package is unchanged. FIX2 derives official_source_version_history.rs from the pinned base-package GREEN SHA by moving full review-plan integrity validation to after the transactional current version/revision/URL stale check. This preserves ER4-A review-integrity semantics while making stale operator decisions return ER4_STALE_REJECTED with zero write, as required by frozen ER4 Design R1. No promotion, rollback, network, or live/user DB behavior is added.

