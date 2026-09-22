# CA 20MICRONS Historical-ISIN Transition — Final Closeout / Current Authority

**IST timestamp:** 2026-09-21 13:51  
**Objective:** close the bounded 20MICRONS strictly-pre-transition same-symbol historical-ISIN transition-window capability after accepted source implementation and real TEST-DB rollback acceptance.

## Previous limitation

Before this slice, exact event-date historical-ISIN evidence and AUTO-ID1 persisted event-identity evidence could not safely resolve earlier same-symbol `20MICRONS` dividends that used historical ISIN `INE144J01019`. Reinterpreting historical evidence as a generic validity interval would have incorrectly supported post-transition stale-ISIN rows.

## Files changed by this closeout

Documentation only:

- `docs\superpowers\specs\2026-09-21-corporate-action-20microns-historical-isin-transition-final-closeout-current-authority.md`
- `docs\superpowers\specs\2026-09-21-corporate-action-new-chat-handoff-after-20microns-transition.md`
- `docs\changes\2026-09-21_1351_IST_CA_20MICRONS_HISTORICAL_ISIN_TRANSITION_FINAL_CLOSEOUT.md`

No runtime/source file is changed by this final-closeout step.

## Final implementation authority

Accepted production hashes:

- `src-tauri-shell\src\database\corporate_action_imports.rs` — `9968D91EE99ECCF92B853E349734BF24BFA295477C2A28C89D67CAEF7181BE44`
- `src-tauri-shell\src\database\corporate_action_imports\historical_isin_transition.rs` — `D45AD89AEAB209D304A929F0112561CA0B82EAAF43CA30232BB5B04A698EC05D`

Accepted source authority before documentation installation:

- source inventory: `560`;
- protected source: `554`.

Implementation evidence SHA-256:

`56A89FD1965442B39E4722C1A6EA2B96BAD38900C8324F1D7302EDE045E4E54F`

## Runtime acceptance authority

Runtime evidence SHA-256:

`669E7B9BBA98C234A79ADA1E61032F058CF6D56DA49F225D99916B3BE494EFE9`

Writer-excluded stable-copy TEST-DB acceptance proved:

- imports `41528`, `13307`, `14958` are the exact strictly-pre-transition dividend population;
- all three Quick Resolve to `PENDING`;
- exactly three `VERIFIED_HISTORICAL_ISIN_TRANSITION` decisions are produced inside the transaction;
- zero Corporate Action approvals occur;
- raw historical ISIN `INE144J01019` remains unchanged;
- transition SPLIT `16153` remains unchanged;
- eight post-transition dividend rows remain unchanged;
- ten `OTHER` / AGM rows remain unchanged;
- import `43206` remains `PENDING_ISIN_MISMATCH`;
- selected CA/identity/history evidence remains unchanged;
- `ROLLBACK` restores the exact selected logical state;
- schema version remains unchanged;
- live SQLite opens/writes/checkpoints/sidecar deletes are zero.

## Behavior preserved

- AUTO-ID1 stays `CLOSED / CURRENT`.
- Exact event-date historical-ISIN Quick Resolve is unchanged.
- `PENDING_ISIN_MISMATCH` is unchanged.
- Post-transition stale-ISIN rows remain blocked.
- Unsupported action types remain unsupported.
- Corporate Action approval remains explicit.
- No schema or migration is introduced.
- No frontend/Tauri public contract changes.
- No chart/raw-price behavior changes.

## Validation / evidence

Source implementation:

- RED -> GREEN proven;
- transition 10/10;
- AUTO-ID1 6/6;
- Quick Resolve 5/5;
- Recheck 6/6;
- V1.9.2 13/13;
- full CA-import 122/122;
- Cargo check PASS;
- post-install 10/10.

Runtime:

- real TEST-DB stable-copy transaction PASS;
- 3/3 target rows;
- zero approvals;
- rollback exact;
- live DB mutation 0.

This closeout itself requires only documentation installation plus exact source PRE/POST preservation; no source test or build is required because it introduces no runtime change.

## Risks / limitations

The proof is deliberately narrow. It does not resolve post-transition stale ISINs, unsupported Corporate Action types, BSE, or generalized historical-ISIN validity intervals. Those remain separately gated problems.

## Rollback guidance

The final-closeout step is additive documentation only. To roll back only this closeout, remove the three documentation files listed above. Do not revert the accepted Rust implementation or its accepted runtime evidence.

## Next step

Independently verify the closeout evidence, then create a fresh real-project Snapshot V3. Promote that snapshot only after independent archive/source verification.
