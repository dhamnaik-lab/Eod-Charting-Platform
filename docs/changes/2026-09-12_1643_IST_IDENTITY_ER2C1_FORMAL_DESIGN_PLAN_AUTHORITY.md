# Identity ER2-C1 — Formal Design + TDD Plan Authority

**IST timestamp:** 2026-09-12 16:43 IST  
**Workstream:** EOD Charting Platform  
**Project root:** `E:\TA Projects\EOD Charting Platform`  
**Status:** DOCUMENTATION AUTHORITY PREPARED / SOURCE IMPLEMENTATION NOT STARTED

## Objective

Consolidate the fully approved ER2-C1 Sections 1–5 into one formal design authority and one self-contained TDD implementation plan before any C1 source mutation.

## Source authority

```text
Snapshot:
Eod Charting Platform Source Code 2026-09-12_141501_IST.zip

SHA256:
D14ABCAF8B067A6474786571272C28F8C1267595EF656D1B6B78C76CE54DD822

536-source-file fingerprint:
8E6011E50CF64CF1F7179EF435A49F8F6EF9B57A1C5B16F0C4CA194740E7A037
```

## Governing parent authorities

```text
ER2-A full design                 230EDC694E92F87E5CF9B740B39ED155AB18AA7373186FF35BC25230B885AAC6
ER2-B approval-time design        E7A044F4142B94D20AD8C38FDB89EAB2E9E600EEA15E5193BE1F7D3DF3B9600C
ER2-B final resolver              AECC6C182D90598CDD78FB777FE4D0D3A0D15D0C73A071CE8E02456F71DFE3CD
ER2-B implementation evidence     B3D251F69979A2A0EE100B78E8909D339400C12D592EF9AD4ED2A9FBB97D1FED
ER2-B DOC1 evidence               5EF95055C65EF209F7D7466F68EEBAEAC96F5FD0D894B5BCF2D18BE369CADE0A
Future Identity design            9DF3101384726F19150B7FA4EAD2CDA48A91A3993601D8467E53BD9280C736C9
```

## Files created by this documentation authority

```text
docs\superpowers\specs\2026-09-12-identity-er2c1-nse-i3-shadow-evidence-adapter-design.md
docs\superpowers\plans\2026-09-12-identity-er2c1-nse-i3-shadow-evidence-adapter-plan.md
docs\changes\2026-09-12_1643_IST_IDENTITY_ER2C1_FORMAL_DESIGN_PLAN_AUTHORITY.md
```

## Production behavior changed

None.

No source implementation, database access, network action, build, test, Tauri change, frontend change or source-control action is performed by this documentation step.

## Frozen implementation boundary

```text
Expected production file:
src-tauri-shell\src\database\nse_identity_imports.rs

No ER2-B resolver change.
No I3 Apply change.
No plan-SHA change.
No public result change.
No I4/BSE integration.
No runtime shadow persistence/logging.
```

## Preservation sentinels

```text
nse_identity_imports.rs           100F27D48F85570EE45C3EA0E3522E60742C5188E474858B0EDE61F19EE2F598
identity_evidence_resolver.rs     AECC6C182D90598CDD78FB777FE4D0D3A0D15D0C73A071CE8E02456F71DFE3CD
database.rs                       3E90B2E22CA056340F5076EBA25E0DEFE2125EE1DD467ACE7BBD4B97B65266B9
bse_identity_imports.rs           B71050D9D2FCD69491A066313EDCA3E72AFF10498D9C7FB94B7877C8732B6D6B
official_source_health.rs         0A027FE03647D2BFB10100F1DB91927664E6F9AB5BA585BACE145D78B9637DF0
Cargo.toml                        D1199096F9EA2548FD011BC120ABD15407849A75D9AAA14240DF1D250A020D42
Cargo.lock                        670E1F7C8AF8C757122E48DFD37743D6A6CBE847A61C14E629149AAA2F5B9CCA
package.json                      8C4BEBD7A534A3393939E4F99C4E3A28691D9FA7C8F85503F0565D4544C20E6F
package-lock.json                 08A6F8C52D4FD94A6777B5CC181F534C7D74DB6C9C10CFF73D9A95806C2C766D

I3 reviewed Apply body            B3297AC350E262CBAA8D4F824728C70C7EC0721271DDD910BF3AB5BF22CE4981
I3 plan-hash function body        E1E528547427A529771B5BFEAA63985CBA4DC8CF26EBF232661A82B5C1A3A1E7
I3 plan-to-result function body   3DEED9F0D44F30DEEFC5ED8A2A643BF772746579138B4960057D16D5F78BA05F
```

## Validation performed for this documentation step

- Verified the uploaded POST-ER2-B/PRE-ER2-C snapshot SHA-256.
- Verified exact current key source/package hashes from the snapshot.
- Inspected current I3 plan, Preview, reviewed Apply, current master loaders and ER2-B resolver signatures.
- Self-reviewed the formal spec for placeholders, contradictions, scope expansion and ambiguity.
- Self-reviewed the TDD plan for spec coverage, placeholders and interface/type consistency.
- No source tests/builds are claimed because implementation has not started.

## Risks / limitations

The design intentionally leaves several real evidence gaps unresolved: no authoritative SERIES_CHANGE or ISIN_CHANGE acquisition is added; local `instrument_identity_history` remains non-authoritative for ER2 evidence; reactivation is not a new resolver rule; and C1 diagnostics are intentionally invisible to operators.

## Rollback

Documentation-only rollback removes only the three ER2-C1 formal-authority documents. No source/database rollback is required.

## Next step

After this formal authority is installed/accepted, prepare and execute the ER2-C1 implementation package/runner using the frozen plan. ER2-C2/C3/C4 and BSE integration remain unauthorized.
