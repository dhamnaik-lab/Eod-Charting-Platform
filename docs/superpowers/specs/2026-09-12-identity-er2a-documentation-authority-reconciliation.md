# Identity ER2-A — Documentation Authority Reconciliation

**Status:** CURRENT DOCUMENTATION AUTHORITY / PRE-ER2-B GATE  
**Date:** 2026-09-12 IST  
**Active workstream:** EOD Charting Platform  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## 1. Objective

Remove an authority ambiguity discovered during independent ER2-A evidence review.

ER2-A source implementation, TDD, regressions, Cargo validation, preservation, and evidence all passed. The only issue was documentary: the implementation evidence installed shorter rewritten design/plan documents under the normal ER2-A design/plan filenames, while the user had previously approved a fuller 21-section design and a more detailed implementation plan.

This reconciliation does **not** change ER2-A source, behavior, tests, rule semantics, dependencies, database state, network behavior, Tauri/UI behavior, or I3/I4 Apply authority.

## 2. Governing design authority

The full user-approved design authority is now preserved project-locally as:

```text
docs\superpowers\specs\
2026-09-11-identity-er2a-approved-full-design-authority.md
```

SHA-256:

```text
230EDC694E92F87E5CF9B740B39ED155AB18AA7373186FF35BC25230B885AAC6
```

That file is the exact approved 21-section design artifact. It governs ER2-A semantics and the boundary for ER2-B.

In particular, it freezes:

- five statuses;
- seven conclusions;
- deterministic-only confidence;
- authority/evidence/source-availability vocabulary;
- A-I versioned rule IDs;
- infrastructure source-unavailable rule;
- reserved no-match rule;
- provenance invariants;
- precedence;
- fail-closed result invariants;
- serialization stability;
- I3/I4/ER1 preservation;
- ER2-A non-goals;
- the rule that ER2-B may not silently redefine ER2-A contract vocabulary or provenance semantics.

## 3. Condensed installed design classification

The file installed by the implementation runner under:

```text
docs\superpowers\specs\
2026-09-11-identity-er2a-deterministic-resolver-contract-rule-matrix-design.md
```

has evidence SHA-256:

```text
0ECB1BE3FB30E71B0A24763E27D69A6FFB5E422D17243B6E2E738B635337A53E
```

It is **not** the exact full approved artifact.

It is hereby classified as:

```text
AS-EXECUTED DESIGN SUMMARY / IMPLEMENTATION-SCOPE SUMMARY
```

It remains useful historical execution documentation and must not be deleted or rewritten merely to hide the mismatch. Where it conflicts with or omits detail from the full approved design, the full approved design authority wins.

## 4. Detailed implementation-plan authority

Before inline execution, the user approved a detailed Task 1-4 TDD implementation plan recorded with SHA-256:

```text
A7E1D8FE3524E3ADFA28714045AF185CF3D966F89CC2C3E7D1D3C1F52F2848B
```

The approved task decomposition was:

```text
Task 1  Contract vocabulary + serialization
Task 2  A-I rule-matrix freeze
Task 3  Provenance + fail-closed validators
Task 4  Preservation regressions + evidence + closeout
```

An additional user-approved TDD sequencing correction tightened Task 1:

```text
RED:
  test-only resolver-module registration
  missing-contract compile failure required

GREEN:
  production internal module registration
  minimal contract implementation
```

No architecture or rule semantics changed through that correction.

## 5. Condensed installed plan classification

The file installed by the implementation runner under:

```text
docs\superpowers\plans\
2026-09-11-identity-er2a-deterministic-resolver-contract-rule-matrix-plan.md
```

has evidence SHA-256:

```text
A9B5EAB2E1471BCFA2F83B20C4FC9232E812764D6958D819AA1C6DB64DC1AD4B
```

It is classified as:

```text
AS-EXECUTED CONDENSED IMPLEMENTATION PLAN
```

It accurately records the final four-task execution shape, but it is not to be represented as the exact byte-for-byte detailed plan approved earlier.

The exact approved detailed-plan hash is preserved above. The executed behavior is independently proven by the ER2-A evidence authority, so no attempt is made here to fabricate or reconstruct a byte-identical historical plan artifact.

## 6. Execution/evidence authority

The accepted ER2-A implementation evidence is:

```text
E:\TA Projects\EOD Charting Platform Source Audit\
IDENTITY_ER2A_CONTRACT_RULE_MATRIX_2026-09-11_233927_IST_evidence.zip
```

SHA-256:

```text
6384E131DC49799968E5A6BC67DB4C64F782C3DF3F4CD04295BE1E4D35679C9F
```

Independent review confirmed:

```text
TDD RED                         PASS
Focused ER2-A contract tests    22/22 PASS
NSE Identity I3/I4 regression   32/32 PASS
BSE Identity regression          5/5 PASS
ER1 Source Health regression     9/9 PASS
cargo check --locked --offline  PASS
```

Exact production-source delta:

```text
ADDED
src-tauri-shell/src/database/identity_evidence_resolver.rs

MODIFIED
src-tauri-shell/src/database.rs
  one additive internal module registration

REMOVED
none
```

Postimage authorities:

```text
src-tauri-shell/src/database.rs
3E90B2E22CA056340F5076EBA25E0DEFE2125EE1DD467ACE7BBD4B97B65266B9

src-tauri-shell/src/database/identity_evidence_resolver.rs
E9CA8A5D20275FC0D2D17F904780F257B422E31062839B8CF36ACE3D186CFCB0

postimage source fingerprint
2343703A060F5A7638D291552B88E04ED6D5132E056CC17B935A6564F243BF37 / 536 files
```

## 7. Authority precedence after reconciliation

For ER2-A and ER2-B continuation, use this order:

```text
1. Full approved ER2-A design authority
   230EDC...5AAC6

2. ER2-A implementation evidence / FINAL_STATE
   6384E1...79C9F evidence ZIP

3. ER2-A source postimages
   database.rs + identity_evidence_resolver.rs hashes

4. Condensed installed design/plan
   historical as-executed summaries only
```

The condensed documents may clarify execution history, but they cannot weaken or silently replace the full approved design.

## 8. ER2-A closure

With this documentation authority reconciliation installed and verified, ER2-A is classified:

```text
IDENTITY_ER2A_DETERMINISTIC_RESOLVER_CONTRACT_RULE_MATRIX
CLOSED / GREEN / CONTRACT AUTHORITY FROZEN
```

## 9. Next authorized phase

```text
ER2-B — Deterministic Resolver Rule Evaluation TDD
```

ER2-B must start from the full approved ER2-A design and accepted source postimages.

High-priority ER2-B behavior coverage must include Rule H cases for **same symbol / different series**, proving that series changes do not automatically create a new security identity and that higher-risk ISIN/conflict evidence still takes precedence.

## 10. Preservation / rollback

This reconciliation is documentation-only.

It must not modify:

- `src`;
- `src-tauri-shell`;
- Cargo/npm files;
- database/schema/data;
- source URLs;
- frontend/Tauri runtime behavior;
- I3/I4 Apply paths;
- ER1 Source Health behavior.

Rollback is simply removal of the new reconciliation documents created by DOC1. Existing historical condensed ER2-A documents and source implementation remain untouched.
