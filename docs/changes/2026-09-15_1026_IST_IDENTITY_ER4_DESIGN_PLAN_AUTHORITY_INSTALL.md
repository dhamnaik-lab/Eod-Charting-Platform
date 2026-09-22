# Identity ER4 Design + Plan Authority Installation

**IST timestamp:** `2026-09-15 10:26 IST`  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Parent source authority:** `Eod Charting Platform Source Code 2026-09-15_020218_IST.zip`  
**Parent snapshot SHA-256:** `8C3C9092DC2F6190FEB3703A174721570493DC52510F862FBBBB904C6D7B6BB6`

## Objective

Install the user-approved ER4 Design R1 and Implementation Plan R1 as project documentation authority before any ER4-A source change.

This is the mandatory documentation-authority gate defined by the approved implementation plan. It does **not** authorize or perform ER4-A source implementation. A fresh independently accepted Snapshot V3 must follow this installation before ER4-A can begin.

## Files created

- `docs\superpowers\specs\2026-09-15-identity-er4-source-candidate-review-version-history-design-r1.md`
- `docs\superpowers\plans\2026-09-15-identity-er4-source-candidate-review-version-history-implementation-plan-r1.md`
- `docs\changes\2026-09-15_1026_IST_IDENTITY_ER4_DESIGN_PLAN_AUTHORITY_INSTALL.md`

## Files modified

None.

## Approved authority hashes

- ER4 Design R1 SHA-256: `EEA51A0E969F683065D6DFA58B029D344CFCCD0F17E77D0BB82425E74AA7C688`
- ER4 Implementation Plan R1 SHA-256: `4054064AAA3DAD79D85F9E075071D87E6C0A7972C5C4CE1C6A45191865DD05B2`

## Final implementation

Documentation-only authority installation. No Rust, TypeScript, frontend, Tauri command, schema, database, setting, build-system, dependency, network, archive, source-control, or runtime behavior changes are made.

ER4 stage state after this installation is:

```text
ER3    CLOSED / CURRENT
ER4 Design R1  APPROVED / INSTALLED
ER4 Plan R1    APPROVED / INSTALLED
ER4-A          BLOCKED UNTIL FRESH SNAPSHOT ACCEPTANCE
ER4-B..E       NOT AUTHORIZED
ER5+           NOT AUTHORIZED
```

## Behaviour preserved

Preserved exactly:

- all `543` protected source files;
- I3 reviewed Preview → Apply authority;
- I4 reviewed Preview → atomic Apply authority;
- ER1 source-health semantics and UI;
- ER2 resolver/shadow behavior;
- ER3-A discovery semantics;
- ER3-B validation semantics and non-promoting classifications;
- existing manual Official Source URLs workflow;
- current configured source URLs;
- DB/schema/data;
- public Tauri/frontend contracts;
- BSE behavior;
- deferred NSE temporary-staging concurrency issue.

## Validation performed by the installer

Before copying documentation:

- verify package/member SHA-256 values;
- verify project root exactly;
- verify the accepted `543/543` protected-source manifest;
- verify ER3 final authority/handoff/change-record hashes;
- verify Snapshot V3 script hash;
- verify all three destination paths are absent or already byte-identical.

After copying documentation:

- re-verify `543/543` protected source;
- prove PRE/POST protected-source evidence byte-identical;
- re-verify prerequisite authority files;
- verify installed Design R1, Plan R1, and this change record hashes.

No Cargo/test/build, DB access, network access, Git/source-control, or snapshot action is invoked by the installer.

## Risks / limitations

- ER4-A remains unstarted.
- This installation does not create or migrate ER4 persistence.
- This installation does not expose candidate review UI.
- This installation does not authorize ER4-B through ER4-E.
- The `020218` snapshot remains the parent self-contained source authority until the new post-install snapshot is generated and independently accepted.

## Rollback guidance

Delete only the three documentation files listed under **Files created**, then re-verify the accepted `543` protected-source manifest. No source/database/dependency rollback is required.

## Next step

Run `scripts\Create-EOD-Source-Code-Snapshot-v3.ps1` separately from the real project and submit the generated ZIP/report for independent acceptance.

Only after that snapshot is accepted may **ER4-A — Deterministic Review Authority** source work begin.
