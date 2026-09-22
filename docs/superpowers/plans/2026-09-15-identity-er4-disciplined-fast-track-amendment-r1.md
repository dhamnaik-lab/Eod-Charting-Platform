# Identity ER4 Disciplined Fast-Track Amendment R1

**Status:** APPROVED EXECUTION-CADENCE AMENDMENT / ER4 DESIGN R1 SEMANTICS UNCHANGED  
**Date:** 2026-09-15 IST  
**Workstream:** EOD Charting Platform  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Authority

This amendment records the user's explicit approval:

> Approved ER4 disciplined fast-track amendment — after mandatory ER4-A authority closeout and fresh snapshot acceptance, combine ER4-B+ER4-C into one internally gated RED→GREEN implementation/evidence cycle, then combine ER4-D+ER4-E into one internally gated RED→GREEN implementation/evidence cycle. Preserve all frozen ER4 Design R1 semantics, atomicity, stale fencing, manual-source workflow, explicit operator decisions, post-change ER1 health, rollback-as-new-version, full regressions, manual checkpoint and final snapshot. No automatic promotion/rollback, BSE automation, I3/I4 Apply coupling or ER5+.

This document modifies execution cadence only.

It does **not** modify:

- `docs\superpowers\specs\2026-09-15-identity-er4-source-candidate-review-version-history-design-r1.md`;
- the technical behavior required by ER4-B, C, D or E;
- ER4 persistence, stale-fence, atomicity, health, rollback or preservation semantics.

## Why the cadence is amended

The original plan closes/snapshots each ER4 stage separately. ER4 remaining work has clear dependency pairs:

```text
B persistence/manual compatibility
→ C operator review/history

D explicit promotion
→ E rollback/final acceptance
```

B and C can share one evidence/install cycle as long as B reaches its internal GREEN/preservation gate before C logic is enabled.

D and E can share one evidence/install cycle as long as D reaches its internal GREEN/preservation gate before E rollback logic is enabled.

This removes redundant operator loops without removing technical gates.

## Mandatory precondition

Before ER4-BC:

1. ER4-A must be independently accepted;
2. ER4-A current-authority/handoff documentation must be installed;
3. a fresh post-ER4-A Snapshot V3 must be generated;
4. that snapshot must be independently accepted.

ER4-BC source work is blocked until all four are complete.

## Fast-Track Block 1 — ER4-BC

One combined package/runner may contain ER4-B and ER4-C payloads.

Mandatory internal sequence:

```text
BC authority preflight
→ B RED proof
→ B GREEN
→ B schema/baseline/manual compatibility tests
→ B restart/idempotency/corruption/failure-injection tests
→ B preservation gate
→ C RED proof
→ C GREEN
→ candidate review / Keep / Reject / history tests
→ frontend contract tests
→ combined BC regressions/typecheck/build/Cargo check
→ manual BC checkpoint
→ install combined BC payload
→ POST source/hash authority verification
→ one BC evidence ZIP
```

### B boundary

ER4-B must establish before C:

- three-table ledger schema;
- atomic nine-source baseline migration;
- current pointers/revisions;
- compatibility mirror;
- authoritative ledger read model;
- reviewed manual save;
- generic `officialSourceUrls.v1` bypass closure;
- restart/idempotency/corruption/failure-injection proof.

### C boundary

Only after B GREEN may C add:

- eligible failed NSE candidate action;
- deterministic ER4 review plans;
- durable `KEEP_CURRENT`;
- durable `REJECT_CANDIDATE`;
- required rejection note;
- per-source history;
- review/history UI.

ER4-BC must **not** add candidate promotion or rollback.

## ER4-BC exit gate

Before ER4-DE:

1. combined BC evidence must be independently accepted;
2. BC current-authority/handoff closeout must be installed;
3. a fresh BC Snapshot V3 must be created;
4. that snapshot must be independently accepted.

No extra redesign approval is required; this amendment already authorizes ER4-DE once those predecessor gates are satisfied.

## Fast-Track Block 2 — ER4-DE

One combined package/runner may contain ER4-D and ER4-E payloads.

Mandatory internal sequence:

```text
DE authority preflight
→ D RED proof
→ D GREEN
→ fresh ER3-B direct-candidate revalidation
→ stale revision/fingerprint/SHA fences
→ atomic promotion proof
→ no I3/I4 Apply coupling proof
→ exact-snapshot post-promotion ER1 health proof
→ D preservation gate
→ E RED proof
→ E GREEN
→ rollback-target review/revalidation
→ rollback-as-new-version proof
→ post-rollback ER1 health
→ retry-health behavior
→ full ER4 regressions
→ restart/concurrency/failure-injection
→ frontend typecheck/build
→ portable Windows build
→ manual operator checkpoint
→ install combined DE payload
→ final ER4 evidence/closeout/snapshot
```

## Non-negotiable semantics

The fast-track must preserve:

- dedicated per-source SQLite version/history authority;
- immutable source versions;
- monotonic revisions;
- manual source editor visibly preserved;
- compatibility JSON mirror atomic with ledger mutations;
- explicit operator decisions;
- only `VALIDATED_CANDIDATE_NOT_PROMOTED` may promote;
- fresh ER3-B revalidation before promotion;
- stale version/revision/URL/candidate-SHA/report-fingerprint rejection;
- `BEGIN IMMEDIATE` atomicity;
- no automatic promotion;
- no automatic rollback;
- post-change ER1 health evidence;
- rollback as a new immutable version;
- failed versions/history retained;
- raw remote source bodies not persisted;
- BSE candidate automation excluded;
- I3/I4 Apply separate;
- ER5+ excluded.

## Evidence cadence

The amended cadence is:

```text
ER4-A closeout + snapshot
→ ER4-BC combined implementation/evidence
→ BC closeout + snapshot
→ ER4-DE combined implementation/evidence
→ final ER4 closeout + snapshot
```

Internal B/C/D/E validation records must remain separately identifiable inside the combined evidence packages.

## Stop conditions

Stop and report before continuing if:

- B requires an architectural change from Design R1;
- C cannot preserve the manual source workflow;
- D cannot guarantee stale-fenced atomic promotion;
- E cannot implement rollback as a new immutable version;
- a combined block would require BSE automation, I3/I4 coupling, ER5+, or unrelated refactoring;
- protected-source/source-authority verification fails.

## Current authorization state

```text
ER4-A  CLOSED / GREEN / ACCEPTED
ER4-BC APPROVED CONDITIONALLY — starts only after post-ER4A snapshot acceptance
ER4-DE APPROVED CONDITIONALLY — starts only after ER4-BC evidence + snapshot acceptance
ER4    OPEN
ER5+   NOT AUTHORIZED
```
