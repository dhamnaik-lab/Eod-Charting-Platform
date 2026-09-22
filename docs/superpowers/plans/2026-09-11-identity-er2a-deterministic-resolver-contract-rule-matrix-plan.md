# Identity ER2-A — Deterministic Resolver Contract + Rule-Matrix Implementation Plan

**Status:** APPROVED PLAN / INLINE EXECUTION  
**Project:** `E:\TA Projects\EOD Charting Platform`  
**Design:** `docs\superpowers\specs\2026-09-11-identity-er2a-deterministic-resolver-contract-rule-matrix-design.md`

## Goal

Install and freeze the pure Rust ER2-A contract, exact A-I V1 metadata and structural fail-closed validation without implementing Identity decision logic or changing any current Identity write path.

## Scope

Create:

```text
src-tauri-shell\src\database\identity_evidence_resolver.rs
```

Modify additively:

```text
src-tauri-shell\src\database.rs
```

Install the approved design/plan and create the required IST change report/evidence.

## Constraints

- current source authority: snapshot SHA `D673BBC51B9134977D5739D8DF7988630AFDCEBD4918857CD4CE84ABFDE41C2E`;
- source fingerprint: `490D8844A47767F16DC08470839823C613D93B3A93EA92C398635BD44F3C2836` / 535 files;
- preserve NSE Identity backend SHA `100F27D48F85570EE45C3EA0E3522E60742C5188E474858B0EDE61F19EE2F598`;
- preserve BSE Identity backend SHA `B71050D9D2FCD69491A066313EDCA3E72AFF10498D9C7FB94B7877C8732B6D6B`;
- preserve ER1 source-health backend SHA `0A027FE03647D2BFB10100F1DB91927664E6F9AB5BA585BACE145D78B9637DF0`;
- preserve `Cargo.toml`, `Cargo.lock`, `package.json` and `package-lock.json` exact hashes;
- no user/live database path, network, Git, Tauri, frontend or dependency operation; existing regression tests may create isolated temporary SQLite fixtures;
- Cargo validation is locked/offline;
- PowerShell runner uses no `else`/`elseif` and is parser-checked before execution;
- no portable build unless the implemented scope expands unexpectedly.

## Task 1 — strict TDD RED

- [ ] Verify all exact preimages and absence of the ER2-A module.
- [ ] Back up `database.rs` and record any pre-existing target docs.
- [ ] Install test-only `#[cfg(test)] mod identity_evidence_resolver;` registration.
- [ ] Install a RED-only module test referencing the missing status/conclusion types.
- [ ] Run:

```text
cargo test --locked --offline database::identity_evidence_resolver::tests -- --nocapture
```

- [ ] Require nonzero exit plus the expected module/type marker.
- [ ] Preserve RED output in external evidence.

## Task 2 — contract vocabulary and matrix GREEN

- [ ] Replace test-only registration with `pub(crate) mod identity_evidence_resolver;`.
- [ ] Install stable status, conclusion, confidence, authority, evidence-kind and source-availability enums.
- [ ] Install local/current/evidence/input/result structs.
- [ ] Install exact rule families A-I and 11 stable V1 IDs (nine Identity, one source-unavailable, one reserved).
- [ ] Install the nine-row `IDENTITY_RESOLVER_RULE_MATRIX_V1` metadata table.
- [ ] Verify hard-conflict precedence and disabled implicit probable-review path.
- [ ] Run focused tests GREEN.

## Task 3 — provenance and fail-closed GREEN

- [ ] Install input structural validation.
- [ ] Install result structural validation.
- [ ] Reject duplicate/missing provenance and unknown evidence references.
- [ ] Prevent external-candidate-only confirmation.
- [ ] Require explicit authoritative `ISIN_CHANGE` evidence for confirmed ISIN transitions.
- [ ] Reject invalid status/conclusion/rule combinations.
- [ ] Verify serialized result contains no mutation authority.
- [ ] Run focused tests GREEN.
- [ ] Statically require absence of `resolve_identity`, DB/Tauri/network/Apply dependencies.

## Task 4 — preservation and closeout

- [ ] Run focused ER2-A test module.
- [ ] Run full NSE Identity module tests.
- [ ] Run full BSE Identity module tests.
- [ ] Run ER1 source-health module tests.
- [ ] Run `cargo check --locked --offline`.
- [ ] Verify I3/I4/ER1 source hashes remain exact.
- [ ] Verify Cargo/npm authorities remain exact.
- [ ] Compare source manifests; only `database.rs` and the new resolver module may differ.
- [ ] Install approved design and plan under `docs\superpowers`.
- [ ] Create `docs\changes\YYYY-MM-DD_HHMM_IST_IDENTITY_ER2A_DETERMINISTIC_RESOLVER_CONTRACT_RULE_MATRIX.md`.
- [ ] Build external evidence ZIP and record its SHA.
- [ ] Stop before ER2-B.

## Transaction/rollback

Before the first edit, retain the exact `database.rs` preimage externally. On any failure after mutation:

1. restore the exact `database.rs` preimage;
2. remove the new resolver module;
3. remove only ER2-A docs created by the run;
4. verify preserved hashes;
5. retain external failure evidence.

No database rollback is relevant.

## Completion classification

Only after command-backed validation:

```text
IDENTITY_ER2A_DETERMINISTIC_RESOLVER_CONTRACT_RULE_MATRIX
CLOSED / GREEN / CONTRACT AUTHORITY FROZEN
```

Then stop at:

```text
ER2-B — Deterministic Resolver Rule Evaluation TDD
```
