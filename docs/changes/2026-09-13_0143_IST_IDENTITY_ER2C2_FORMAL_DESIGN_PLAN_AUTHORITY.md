# Identity ER2-C2 — Formal Design + TDD Plan Authority

**IST timestamp:** 2026-09-13 01:43:46 IST  
**Workstream:** EOD Charting Platform  
**Project root:** `E:\TA Projects\EOD Charting Platform`  
**Mode:** DOCUMENTATION AUTHORITY ONLY / NO SOURCE IMPLEMENTATION

## Objective

Freeze the explicitly approved ER2-C2 Sections 1–5 as a formal design authority and create a self-contained TDD implementation plan before any Rust source change.

## Source authority

- Source snapshot: `Eod Charting Platform Source Code 2026-09-13_002253_IST.zip`
- Snapshot SHA-256: `ACBB247A040B9427D5B59EF5151E8444E59FFFF20A36F83E962261EFEAAF65C9`
- Source files: 536
- POST-ER2-C1 canonical authority: `A66E6154F4C62D3D390617A6D35AB16F6CEF9695164A164ABB02734DB9F92E08`
- `nse_identity_imports.rs`: `55F30A01CF305F5F35E926F60DA577DAF55DC185D0CE31E601149AE31C800E63`
- ER2-B resolver: `AECC6C182D90598CDD78FB777FE4D0D3A0D15D0C73A071CE8E02456F71DFE3CD`

## Installed authority documents

### Formal design

`docs\superpowers\specs\2026-09-13-identity-er2c2-nse-i4-historical-shadow-evidence-adapter-design.md`

SHA-256: `32C7FD236E1FB1BBD003A36AC19FBC41252E18602F1AF72B9CBA62A05D7E0AFA`

### TDD implementation plan

`docs\superpowers\plans\2026-09-13-identity-er2c2-nse-i4-historical-shadow-evidence-adapter-plan.md`

SHA-256: `45AC12B8BE6F2085AACB77C1F9A04A891A243717434DADE6DA0ABF25EC3290A7`

## Frozen implementation boundary

Expected production source delta remains exactly:

`src-tauri-shell\src\database\nse_identity_imports.rs`

No ER2-B rule change, I4 execute/hash/Apply change, DB schema/data change, Tauri/frontend change, BSE integration, network activity, or real/private database use is authorized.

## I4 preservation authorities

- `load_nse_historical_identity_source_snapshot`: `19F24B55AD8C810FA27CDE0938AE203B754A42AED7EA40899E3207B70911E941`
- `execute_nse_historical_identity_plan`: `1116DD13F1B6BD3BEE7B9BA1666F922E233DA2005EB4A4AEB40961306E1C5044`
- `nse_historical_identity_plan_sha256`: `5092727016F77F4BF2CB44B9EEF5CAF60AC4D33A2386EC6990005EE4FA632FEC`
- `apply_nse_historical_identity_archive_internal`: `0327EF2DD0FD53A4FAFE3B80CEBB4D89DA1662D296BC1CA9916AA0A6F76BB575`

The Preview wrapper pre-C2 authority is:

`D977631D16D203F360ED7E21BA740013A54415CF282B4707B279F63972320F3F`

and is the only I4 authority-spine function expected to change during C2 implementation.

## Design decision

ER2-C2 is **not an I4 rebuild**. It is a private one-file, post-rollback, Preview-only shadow integration around the existing reviewed I4 Preview → atomic Apply authority.

## Behaviour preserved

- existing I4 source acquisition;
- existing historical row selection/dispositions;
- existing reviewed plan SHA;
- existing public Preview result;
- existing atomic Apply;
- ER2-B resolver contract;
- ER2-C1;
- BSE Identity;
- ER1 source health;
- frontend/Tauri;
- DB schema/data;
- package/dependency authorities.

## Validation of this documentation step

This authority package must verify:
- the exact 536-file source baseline before installation;
- all critical source/dependency hashes;
- formal design and plan hashes;
- protected I4 function-body authorities;
- exact source baseline again after documentation installation.

No Rust tests/builds are claimed by this documentation-only phase.

## Risks / limitations

- The implementation is not started.
- No C2 runtime behavior has been tested yet.
- No real/private database characterization is authorized.
- The formal plan proposes private helper names/signatures that may receive minor ownership/lifetime adjustments, but any semantic expansion requires a stop/review.
- `docs\superpowers` is excluded from the normal source-snapshot script, so the formal docs remain separately protected by this authority/evidence package unless the snapshot policy is later expanded.

## Rollback guidance

If the documentation authority must be removed, delete only the three newly installed documentation files listed above and this change report. Source code does not require rollback because this phase performs no source modification.

## Future boundary

ER2-C3, ER2-C4, BSE resolver integration, source recovery, external-AI handoff, and real-data shadow certification remain **NOT AUTHORIZED**.

## Status

`IDENTITY_ER2C2_FORMAL_DESIGN_PLAN_AUTHORITY`

**CLOSED / GREEN / DOCUMENTATION AUTHORITY**

ER2-C2 source implementation remains **NOT STARTED**.
