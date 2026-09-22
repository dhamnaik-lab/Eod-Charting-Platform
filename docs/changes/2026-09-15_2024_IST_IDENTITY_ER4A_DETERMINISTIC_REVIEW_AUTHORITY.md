# Identity ER4-A Deterministic Review Authority

**IST timestamp:** `2026-09-15 20:24:03 +05:30`
**Workstream:** `E:\TA Projects\EOD Charting Platform`
**Parent source authority:** `Eod Charting Platform Source Code 2026-09-15_110440_IST.zip`
**Parent snapshot SHA-256:** `C5E1B73460446438FAF81233D1A62A302E8D7860F82736F9387B8D4878AE7FC2`

## Objective

Implement ER4-A only: frozen nine-source registry, pure configuration authority types, deterministic canonical fingerprints, ER3-B candidate to ER4 review-plan conversion, and pure stale-base checks.

## Previous limitation

ER3-A/B could discover and technically validate official NSE replacement candidates, but there was no frozen ER4 review authority contract that bound those candidate results to a current source version/revision or produced deterministic review evidence.

## Files created

- `src-tauri-shell\src\database\official_source_candidate_review.rs`
- `docs\changes\2026-09-15_2024_IST_IDENTITY_ER4A_DETERMINISTIC_REVIEW_AUTHORITY.md`

## Files modified

- `src-tauri-shell\src\database.rs`
- `src-tauri-shell\src\database\official_source_candidate_validation.rs`

## Final implementation

- exact nine-source ER4 registry;
- exactly five NSE candidate-promotion-eligible contracts;
- pure current-source/configuration authority types;
- canonical `ER4_CONFIG_V1`, `ER4_VALIDATION_V1`, and `ER4_REVIEW_V1` SHA-256 fingerprints;
- deterministic ER3-B candidate to `OfficialSourceCandidateReviewPlan` conversion;
- only `VALIDATED_CANDIDATE_NOT_PROMOTED` is marked promotable;
- stale version/revision/URL returns `ER4_STALE_REJECTED`;
- only ER3-B classification constant visibility widened to `pub(crate)`;
- no Tauri/public command, DB/schema/write, UI, persistence, network, promotion, rollback, or ER4-B behavior.

## Behaviour preserved

- I3/I4 reviewed data-mutation authority;
- ER1 health semantics;
- ER2 resolver/shadow behavior;
- ER3-A discovery behavior;
- ER3-B transport/parser/population behavior;
- official-source provenance/redirect behavior;
- existing manual Official Source URLs workflow;
- BSE behavior;
- deferred NSE temp-staging concurrency issue.

## Validation commands/results

- Cycle 1 registry RED: PASS — isolated compile failure contained `ER4_SOURCE_REGISTRY`.
- Cycle 1 registry GREEN: PASS — 3/3.
- Cycle 2 fingerprint RED: PASS — isolated compile failure contained `Er4ValidationProjection`.
- Cycle 2 fingerprint GREEN: PASS — 7/7 cumulative ER4-A tests.
- Cycle 3 review-plan/stale RED: PASS — isolated compile failure contained `build_er4_candidate_review_plan`.
- ER4-A focused GREEN: PASS — 12/12.
- ER3-A regression: PASS — 18/18.
- ER3-B B1 regression: PASS — 7/7.
- ER3-B B2 regression: PASS — 5/5.
- ER3-B online authorization guard: PASS — deliberate fail-closed RED before any network, marker `ER3B_ONLINE_AUTHORIZATION_REQUIRED`.
- Official-source runtime provenance: PASS — 5/5.
- ER1 regression: PASS — 10/10.
- NSE delisted discovery: PASS — 5/5.
- NSE delisted fallback: PASS — 1/1.
- I3 reviewed regression: PASS — 5/5.
- I4 historical regression: PASS — 9/9.
- ER2-A regression: PASS — 22/22.
- ER2-B regression: PASS — 45/45.
- ER2-C1 regression: PASS — 19/19.
- ER2-C2 regression: PASS — 25/25.
- `cargo check --locked --offline`: PASS.
- Application/user database: NOT OPENED by ER4-A.
- Network: NOT USED; online guard deliberately failed before transport construction.
- UI/Tauri command/persistence/promotion/rollback/ER4-B: NOT IMPLEMENTED.
- Git/source-control: NOT USED.

## Actual source hashes

- src-tauri-shell\src\database\official_source_candidate_review.rs: 86224F5AC296BB5AA63A62694277A513CC21D5884E1DEEFFF278DC2CA0B34CC7
- src-tauri-shell\src\database.rs: 96E5EE06278925409533571759CC60DE1105E9773B332FE971991AE87FE2331C
- src-tauri-shell\src\database\official_source_candidate_validation.rs: B1BA001819DCACD8698EC451997D6A5D125267865043C863EA8D266EC744673D

## Risks / limitations

- ER4-A remains private/read-only.
- Current version IDs/revisions are pure contract fields only; ER4-B persistence is not implemented.
- No operator UI exists.
- No candidate promotion or rollback exists.
- Existing accepted ER3 private-kernel dead-code warnings may remain.

## Rollback guidance

Remove `official_source_candidate_review.rs`, remove its module registration from `database.rs`, and restore the three ER3-B classification constants to private `const`. Then verify the accepted pre-ER4-A protected-source manifest.

## Next step

Independently accept this ER4-A evidence. Then perform ER4-A current-authority/handoff closeout and a fresh Snapshot V3. ER4-B remains unauthorized until explicit approval after that closeout.

