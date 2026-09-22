# NSE Symbol-Change Temporary Staging Concurrency — Future Bounded Issue

**Status:** FUTURE BOUNDED ISSUE / DIAGNOSED / NOT AUTHORIZED FOR IMPLEMENTATION  
**Date:** 2026-09-14 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Purpose

Record a pre-existing Windows parallel-test concurrency defect discovered while closing:

`IDENTITY_ER2C2_NSE_I4_HISTORICAL_SHADOW_EVIDENCE_ADAPTER`

This issue is explicitly **outside ER2-C2 scope**. ER2-C2 R2B is closed and accepted.

## Accepted ER2-C2 closure authority

- ER2-C2 final `nse_identity_imports.rs` SHA-256:  
  `AFD17E1163D7C6E5EC8C566C473503BD55A7F2B7F6BC82E4813D99825832099E`
- Final 541-file source digest:  
  `D7051907CF5C64CA876FA2D7E9C6C2747BAA0BB21F67BBBE592D65E5E5FEC68B`
- R2B closure evidence SHA-256:  
  `844D1AC2B669093C3287772F45AFF338AE4187AC18E64EE8E3619F87B82BAA57`

Do not reopen ER2-C2 merely to repair this helper.

## Observed defect

The NSE symbol-change byte parser stages validation bytes through a temporary CSV path derived from:

- `SystemTime::now()` nanoseconds;
- process ID.

The staging filename has no additional monotonic/atomic uniqueness component.

On Windows, parallel test calls can obtain the same effective timestamp and therefore collide on the same temporary path. One invocation can overwrite or remove the staging file while another invocation is using it.

The relevant pre-existing helper is the byte-based symbol-change loader/stager in `src-tauri-shell/src/database/nse_identity_imports.rs`.

## Diagnostic evidence

Dedicated diagnostic evidence proved:

- exact failing T13 test: **10 PASS / 0 FAIL**
- T13 group: **6 PASS / 0 FAIL**
- focused ER2-C2 suite using default parallelism: **7 PASS / 1 FAIL**
- focused ER2-C2 suite serialized with `--test-threads=1`: **4 PASS / 0 FAIL**

Diagnostic evidence ZIP SHA-256:

`7AB24F47DA0A4A8571500087392C2AE279A08BBC4DBAE97B18544ED438C40A03`

The parallel failure showed one parse observing fewer symbol-change rows than a subsequent parse of the same source content, while source-content SHA remained unchanged. This established test-time staging-path interference rather than an ER2-C2 production semantic defect.

## Current mitigation

For ER2-C2 closure, affected NSE/ER2-C2 integration tests were serialized with:

`--test-threads=1`

This is a validation workaround, not a permanent production repair.

## Future bounded repair objective

Make byte-parser staging paths collision-safe under parallel execution while preserving parsing behavior, error behavior, cleanup behavior, and all existing NSE Identity semantics.

## Candidate repair directions — design only

Possible approaches to evaluate later:

1. Add a process-local atomic monotonic sequence to the temporary filename.
2. Use an existing safe temporary-file primitive already present in project dependencies, if available.
3. Introduce a narrowly scoped helper for unique temporary validation files.

No dependency addition should be made merely for convenience without first checking current dependencies and existing project patterns.

## Preservation requirements for future repair

Any future implementation must preserve:

- symbol-change parsing semantics;
- accepted CSV/headerless parsing behavior;
- source-health validation behavior;
- NSE I3/I4 behavior;
- ER2-B / ER2-C2 behavior;
- BSE Identity;
- ER1 source-health behavior;
- offline build/test capability;
- no real database access unless explicitly authorized.

## Required future validation

At minimum:

- focused new concurrency regression proving distinct staging paths under parallel calls;
- existing symbol-change parser tests;
- NSE Identity owner regression;
- ER2-B and ER2-C2 regressions;
- ER1 Source Health regression;
- `cargo check --locked --offline`;
- repeated parallel test runs demonstrating the flake is removed;
- source-delta and hash preservation appropriate to scope.

## Non-goals

This future issue does not authorize:

- ER2-C3 / ER2-C4;
- BSE resolver integration;
- Identity source recovery;
- real/private database characterization;
- schema changes;
- UI changes;
- dependency upgrades unrelated to the bounded repair.

## Resume instruction

Before implementing this issue in a future session:

1. verify the current EOD Charting Platform source authority;
2. verify this document is still current;
3. inspect the present helper implementation;
4. reproduce the concurrency defect or establish an equivalent deterministic regression;
5. design and approve the smallest maintainable repair before source modification.
