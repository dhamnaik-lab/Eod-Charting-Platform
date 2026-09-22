# Identity ER2-B — Deterministic Resolver Rule Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the pure deterministic A-I Identity resolver evaluator on top of the frozen ER2-A contract, with fail-closed precedence, deterministic evidence selection, exhaustive Rule-H same-symbol/different-series coverage, and no runtime/database/UI integration.

**Architecture:** Extend only `src-tauri-shell/src/database/identity_evidence_resolver.rs`. Keep ER2-A contract types/validators authoritative, add internal evaluation errors/candidates/helpers plus `resolve_identity(...)`, evaluate A-H independently, arbitrate by frozen precedence, construct Rule I only as a fallback, and validate every final result through the existing ER2-A result validator. No database, network, Tauri, frontend, Apply, or source-recovery behavior is added.

**Tech Stack:** Rust; existing Serde/serde_json; standard library only for normalization/date parsing; Cargo test/check in `--locked --offline` mode.

**Spec:** `docs/superpowers/specs/2026-09-12-identity-er2b-deterministic-rule-evaluation-design.md`

## Global Constraints

- Active workstream/root: `E:\TA Projects\EOD Charting Platform`.
- Approved ER2-B design creation SHA-256: `E7A044F4142B94D20AD8C38FDB89EAB2E9E600EEA15E5193BE1F7D3DF3B9600C`.
- ER2-A governing full design SHA-256: `230EDC694E92F87E5CF9B740B39ED155AB18AA7373186FF35BC25230B885AAC6`.
- ER2-A resolver preimage SHA-256: `E9CA8A5D20275FC0D2D17F904780F257B422E31062839B8CF36ACE3D186CFCB0`.
- `database.rs` preservation authority: `3E90B2E22CA056340F5076EBA25E0DEFE2125EE1DD467ACE7BBD4B97B65266B9`.
- ER2-A postimage source authority: 536 files / `2343703A060F5A7638D291552B88E04ED6D5132E056CC17B935A6564F243BF37`.
- ER2-A DOC1 evidence SHA-256: `D50D8F29966A7F12FBEF627DBAB2CD523C8FFDE27A92317F6EFB997E38C59921`.
- Preserve frozen ER2-A statuses, conclusions, rule IDs, authority classes, evidence kinds, source-availability values, input/result structures and validators exactly unless a separately approved ER2-A revision exists.
- Preserve I3 current-universe reviewed Preview -> Apply and I4 historical reviewed Preview -> atomic Apply.
- Preserve ER1 Official Source Health behavior.
- No database access.
- No network access.
- No Tauri command.
- No frontend/TypeScript/API integration.
- No source recovery/discovery.
- No AI integration.
- No Apply integration.
- No new Cargo/npm dependency.
- No Git/source-control command unless separately authorized.
- Cargo validation uses `--locked --offline`.
- PowerShell runner, if generated, uses guard clauses/separate `if` blocks only; no `else`/`elseif`; parse before execution.
- If implementation requires another production Rust module, database/UI/Tauri changes, or a contract/schema extension, stop before continuing because the approved one-file ER2-B scope has expanded architecturally.
- Do not begin ER2-C in the same task.
- No portable Windows build is required for the approved pure internal Rust scope.

---

## File Structure

**Modify**
- `src-tauri-shell/src/database/identity_evidence_resolver.rs`
  - Keep all ER2-A contract vocabulary, metadata and validators.
  - Add internal evaluation errors, candidate model, normalization/date/evidence helpers, A-H evaluators, arbitration, Rule-I fallback, `resolve_identity(...)`, and additive ER2-B tests.

**Verify byte-preserved**
- `src-tauri-shell/src/database.rs`
- `src-tauri-shell/src/database/nse_identity_imports.rs`
- `src-tauri-shell/src/database/bse_identity_imports.rs`
- `src-tauri-shell/src/database/official_source_health.rs`
- `src-tauri-shell/Cargo.toml`
- `src-tauri-shell/Cargo.lock`
- `package.json`
- `package-lock.json`

**Documentation**
- Install/copy approved design:
  - `docs/superpowers/specs/2026-09-12-identity-er2b-deterministic-rule-evaluation-design.md`
- Install this plan:
  - `docs/superpowers/plans/2026-09-12-identity-er2b-deterministic-rule-evaluation-plan.md`
- Create closeout report:
  - `docs/changes/YYYY-MM-DD_HHMM_IST_IDENTITY_ER2B_DETERMINISTIC_RULE_EVALUATION.md`

**External evidence**
- Under `E:\TA Projects\EOD Charting Platform Source Audit\IDENTITY_ER2B_...`
- No evidence/build output inside `src` or `src-tauri-shell/src`.

---

### Task 1: B0 — Resolver Boundary and Internal Error Model

**Files:**
- Modify: `src-tauri-shell/src/database/identity_evidence_resolver.rs`
- Test: inline `#[cfg(test)] mod tests`

**Interfaces:**
- Consumes:
  - `IdentityResolverInput`
  - `IdentityResolverResult`
  - ER2-A validators
- Produces:
  - `IdentityResolverEvaluationError`
  - initial `resolve_identity(...)` boundary

- [ ] **Step 1: Write failing boundary tests**

Add tests that require:

```rust
#[test]
fn er2b_invalid_input_returns_internal_error() {
    let mut input = valid_input();
    input.local_identity.exchange.clear();

    let result = resolve_identity(&input);

    assert!(matches!(
        result,
        Err(IdentityResolverEvaluationError::InvalidInput(_))
    ));
}

#[test]
fn er2b_no_mismatch_returns_internal_error() {
    let input = equivalent_local_and_official_input();

    assert_eq!(
        resolve_identity(&input),
        Err(IdentityResolverEvaluationError::NoMismatchToResolve)
    );
}

#[test]
fn er2b_available_source_without_official_identity_is_invalid_input() {
    let mut input = valid_input();
    input.official_identity = None;
    input.required_source_health = IdentityResolverSourceAvailability::Available;

    assert!(matches!(
        resolve_identity(&input),
        Err(IdentityResolverEvaluationError::InvalidInput(_))
    ));
}
```

- [ ] **Step 2: Run focused RED**

```powershell
Set-Location -LiteralPath 'E:\TA Projects\EOD Charting Platform\src-tauri-shell'

cargo test --locked --offline `
  database::identity_evidence_resolver::tests::er2b_invalid_input_returns_internal_error `
  database::identity_evidence_resolver::tests::er2b_no_mismatch_returns_internal_error `
  database::identity_evidence_resolver::tests::er2b_available_source_without_official_identity_is_invalid_input `
  -- --nocapture
```

Expected: RED because `IdentityResolverEvaluationError` / `resolve_identity` do not yet exist.

Capture the exact compile/test failure in evidence.

- [ ] **Step 3: Implement the internal error enum**

Add:

```rust
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum IdentityResolverEvaluationError {
    InvalidInput(String),
    NoMismatchToResolve,
    AmbiguousDeterministicCandidates {
        rule_ids: Vec<IdentityResolverRuleId>,
    },
    InvalidConstructedResult(String),
}
```

Do not derive Serde.

- [ ] **Step 4: Add mechanical equality helpers**

Add comparison-only helpers:

```rust
fn normalize_code(value: &str) -> String {
    value.trim().to_uppercase()
}

fn normalize_optional_code(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_uppercase)
}

fn normalize_company_name(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_uppercase()
}

fn normalize_optional_company_name(value: Option<&str>) -> Option<String> {
    value
        .map(normalize_company_name)
        .filter(|value| !value.is_empty())
}
```

Add a pure `identities_equivalent(...)` helper comparing:

```text
exchange
symbol
series
ISIN
company_name
lifecycle_state
```

Dates do not participate in the no-mismatch equality decision.

- [ ] **Step 5: Add minimal resolver boundary**

Implement:

```rust
pub(crate) fn resolve_identity(
    input: &IdentityResolverInput,
) -> Result<IdentityResolverResult, IdentityResolverEvaluationError> {
    validate_resolver_input_contract(input)
        .map_err(IdentityResolverEvaluationError::InvalidInput)?;

    if input.required_source_health != IdentityResolverSourceAvailability::Available {
        return build_source_unavailable_result(input);
    }

    let official = input.official_identity.as_ref().ok_or_else(|| {
        IdentityResolverEvaluationError::InvalidInput(
            "ER2B_AVAILABLE_SOURCE_REQUIRES_OFFICIAL_IDENTITY".to_string(),
        )
    })?;

    if identities_equivalent(&input.local_identity, official) {
        return Err(IdentityResolverEvaluationError::NoMismatchToResolve);
    }

    Err(IdentityResolverEvaluationError::InvalidConstructedResult(
        "ER2B_RULE_EVALUATION_NOT_INSTALLED".to_string(),
    ))
}
```

`build_source_unavailable_result(...)` may be implemented in Task 2 so the initial focused B0 GREEN can temporarily expect the source-available path only.

- [ ] **Step 6: Run B0 GREEN**

Run the three B0 tests again.

Expected: all PASS.

- [ ] **Step 7: Run all existing ER2-A tests**

```powershell
cargo test --locked --offline database::identity_evidence_resolver::tests -- --nocapture
```

Expected: all existing 22 ER2-A contract tests plus B0 tests PASS.

Reviewer gate: reject Task 1 if ER2-A contract types or validators were changed to make B0 easier.

---

### Task 2: B1 — Source-Unavailable Precondition

**Files:**
- Modify: `src-tauri-shell/src/database/identity_evidence_resolver.rs`
- Test: inline tests

**Interfaces:**
- Produces valid source-unavailable result before A-I evaluation.

- [ ] **Step 1: Add failing source-health tests**

```rust
#[test]
fn er2b_unavailable_source_returns_source_unavailable() {
    let mut input = valid_input();
    input.required_source_health = IdentityResolverSourceAvailability::Unavailable;
    input.official_identity = None;
    input.evidence.clear();

    let result = resolve_identity(&input).unwrap();

    assert_eq!(result.status, IdentityResolverStatus::SourceUnavailable);
    assert_eq!(result.conclusion, IdentityResolverConclusion::NoConclusion);
    assert_eq!(
        result.rule_id,
        IdentityResolverRuleId::RequiredOfficialSourceUnavailableV1
    );
    assert!(result.evidence_ids.is_empty());
}

#[test]
fn er2b_untrusted_source_outranks_stale_matching_evidence() {
    let mut input = valid_symbol_change_input();
    input.required_source_health =
        IdentityResolverSourceAvailability::UntrustedOrInvalid;

    let result = resolve_identity(&input).unwrap();

    assert_eq!(result.status, IdentityResolverStatus::SourceUnavailable);
    assert_eq!(
        result.rule_id,
        IdentityResolverRuleId::RequiredOfficialSourceUnavailableV1
    );
}
```

- [ ] **Step 2: Run RED**

Expected: source-unavailable behavior not yet implemented or result rejected.

- [ ] **Step 3: Implement source-unavailable result builder**

Create:

```rust
fn source_unavailable_result(
    input: &IdentityResolverInput,
) -> Result<IdentityResolverResult, IdentityResolverEvaluationError> {
    let result = IdentityResolverResult {
        status: IdentityResolverStatus::SourceUnavailable,
        conclusion: IdentityResolverConclusion::NoConclusion,
        rule_id: IdentityResolverRuleId::RequiredOfficialSourceUnavailableV1,
        confidence_class: IdentityResolverConfidenceClass::Deterministic,
        evidence_ids: Vec::new(),
        explanation: "Required official source is unavailable or untrusted.".to_string(),
    };

    validate_resolver_result_contract(input, &result)
        .map_err(IdentityResolverEvaluationError::InvalidConstructedResult)?;

    Ok(result)
}
```

Call it after structural input validation and before A-H evaluation.

- [ ] **Step 4: Run B1 GREEN**

Run both B1 tests.

Expected: PASS.

- [ ] **Step 5: Run focused ER2 module**

```powershell
cargo test --locked --offline database::identity_evidence_resolver::tests -- --nocapture
```

Expected: all tests PASS.

---

### Task 3: B2 — Rule A Symbol Change

**Files:**
- Modify: `src-tauri-shell/src/database/identity_evidence_resolver.rs`
- Test: inline tests

**Interfaces:**
- Produces Rule-A candidate:
  - `CONFIRMED`
  - `SYMBOL_CHANGE`
  - `SymbolChangeSameIsinOfficialHistoryV1`

- [ ] **Step 1: Add Rule-A positive and negative tests**

Positive fixture must have:

```text
same exchange
symbol differs
same series
same non-empty ISIN
same company name
same lifecycle state when present
authoritative current-master evidence
authoritative SYMBOL_CHANGE evidence
old_symbol == local
new_symbol == official
ISIN == shared ISIN
compatible effective date
```

Test:

```rust
#[test]
fn er2b_rule_a_confirms_official_symbol_change_same_isin() {
    let input = rule_a_input();

    let result = resolve_identity(&input).unwrap();

    assert_eq!(result.status, IdentityResolverStatus::Confirmed);
    assert_eq!(result.conclusion, IdentityResolverConclusion::SymbolChange);
    assert_eq!(
        result.rule_id,
        IdentityResolverRuleId::SymbolChangeSameIsinOfficialHistoryV1
    );
    assert_eq!(
        result.evidence_ids,
        vec!["ev-current".to_string(), "ev-symbol-change".to_string()]
    );
}
```

Negative tests:

```text
missing SYMBOL_CHANGE evidence -> Rule I
wrong old/new symbol -> Rule I
different ISIN -> Rule D conflict
series also changed -> not Rule A
company name also changed -> not Rule A
```

- [ ] **Step 2: Run Rule-A RED**

Expected: positive test does not yet confirm Rule A.

- [ ] **Step 3: Add strict date parser**

Implement a no-dependency `parse_yyyy_mm_dd(...)` / `valid_gregorian_date(...)` helper with leap-year correctness.

Use:

```rust
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
struct Er2bDate {
    year: i32,
    month: u8,
    day: u8,
}
```

Required valid examples:

```text
2026-01-31
2024-02-29
```

Required invalid examples:

```text
2026-13-01
2026-02-30
2025-02-29
04/09/2026
```

- [ ] **Step 4: Implement transition chronology helper**

Conceptually:

```rust
fn transition_date_is_compatible(
    local: &IdentityResolverLocalIdentity,
    official: &IdentityResolverOfficialIdentity,
    evidence: &IdentityResolverEvidence,
) -> bool
```

Rules:

- evidence effective date is required and valid;
- if official effective date exists, parsed date must equal evidence date;
- if local effective-to exists, evidence date must be `>=` local effective-to;
- malformed supplied chronology makes the rule non-matching.

- [ ] **Step 5: Implement Rule-A evaluator**

```rust
fn evaluate_rule_a(
    input: &IdentityResolverInput,
    official: &IdentityResolverOfficialIdentity,
) -> Option<IdentityResolverCandidate>
```

Use only authoritative evidence and exact normalized fields.

- [ ] **Step 6: Add temporary Rule-I fallback helper**

To make Rule-A negative missing-history cases GREEN before full Rule-I task, add only an internal test helper or defer negative missing-history assertions to Task 10. Prefer deferment: keep Task 3 focused on positive Rule-A and "A does not match" direct evaluator tests.

- [ ] **Step 7: Run Rule-A GREEN**

Run Rule-A evaluator tests plus all prior tests.

Expected: PASS.

---

### Task 4: B3 — Rule B Name Change

**Files:**
- Modify: `src-tauri-shell/src/database/identity_evidence_resolver.rs`
- Test: inline tests

**Interfaces:**
- Produces `CONFIRMED / NAME_CHANGE / Rule B`.

- [ ] **Step 1: Add Rule-B RED tests**

Positive:

```text
same exchange
same symbol
same series
same non-empty ISIN
company name differs
same lifecycle state when present
authoritative NAME_CHANGE evidence
evidence symbol == official symbol
evidence ISIN == shared ISIN
evidence company_name == official company name
compatible date
```

Negative direct-evaluator tests:

```text
fuzzy/similar names without NAME_CHANGE -> no B candidate
symbol also changed -> no B candidate
series also changed -> no B candidate
wrong ISIN in evidence -> no B candidate
```

- [ ] **Step 2: Run RED**

Expected: no Rule-B evaluator exists.

- [ ] **Step 3: Implement `evaluate_rule_b(...)`**

Do not add fuzzy matching.

- [ ] **Step 4: Run GREEN**

Expected: Rule-B tests plus prior suite PASS.

---

### Task 5: B4 — Rule C Symbol + Name Change

**Files:**
- Modify: `src-tauri-shell/src/database/identity_evidence_resolver.rs`
- Test: inline tests

**Interfaces:**
- Produces `CONFIRMED / SYMBOL_AND_NAME_CHANGE / Rule C`.

- [ ] **Step 1: Add Rule-C RED tests**

Positive requires both matching authoritative `SYMBOL_CHANGE` and `NAME_CHANGE` evidence bound to the same shared ISIN/security.

Negative:

```text
only symbol evidence -> no C candidate
only name evidence -> no C candidate
series also changed -> no C candidate
evidence bound to another ISIN/security -> no C candidate
```

- [ ] **Step 2: Run RED**

- [ ] **Step 3: Implement `evaluate_rule_c(...)`**

Select canonical evidence for each required kind independently and enforce chronology for both.

- [ ] **Step 4: Run GREEN**

---

### Task 6: B5 — Rule D Explicit ISIN Continuity / Conflict

**Files:**
- Modify: `src-tauri-shell/src/database/identity_evidence_resolver.rs`
- Test: inline tests

**Interfaces:**
- Produces either:
  - `CONFIRMED / ISIN_CONTINUITY / Rule D`, or
  - `CONFLICT / CONFLICTING_IDENTITY / Rule D`.

- [ ] **Step 1: Add Rule-D RED tests**

Positive proof requires:

```text
local ISIN != official ISIN

old side:
authoritative HISTORICAL_IDENTITY
isin == local ISIN
binds local symbol/security

new side:
authoritative ISIN_CHANGE
isin == official ISIN
binds official symbol/security
effective_date present and compatible

shared provenance bridge:
same exchange
same source_id
same source_reference
same content_sha256
```

Test output evidence order:

```text
current official
ISIN_CHANGE
HISTORICAL_IDENTITY
```

Negative tests:

```text
new-side only -> D conflict
old-side only -> D conflict
different source_reference -> D conflict
different content_sha256 -> D conflict
incompatible date -> D conflict
symbol similarity alone -> D conflict
```

- [ ] **Step 2: Run RED**

- [ ] **Step 3: Implement linked-evidence helper**

Conceptually:

```rust
fn find_rule_d_continuity_pair<'a>(
    input: &'a IdentityResolverInput,
    official: &IdentityResolverOfficialIdentity,
) -> Option<(&'a IdentityResolverEvidence, &'a IdentityResolverEvidence)>
```

Do not add new evidence fields.

- [ ] **Step 4: Implement D confirmed/conflict evaluator**

A changed non-empty ISIN always produces a D candidate:
- confirmed when linked pair is valid;
- conflict otherwise.

- [ ] **Step 5: Run Rule-D GREEN**

---

### Task 7: B6 — Rules E, F and G Hard Conflicts

**Files:**
- Modify: `src-tauri-shell/src/database/identity_evidence_resolver.rs`
- Test: inline tests

**Interfaces:**
- Produces the specific hard-conflict candidates:
  - E > G > F > D-conflict

#### Rule E

- [ ] **Step 1: Add Rule-E RED tests**

Positive:

```text
same exchange
same non-empty ISIN
2+ distinct normalized symbols
authoritative CURRENT_MASTER evidence
```

Counter-tests:

```text
ABC/EQ + ABC/BE + same ISIN -> not E
NSE + BSE same ISIN -> not one same-exchange E conflict
```

- [ ] **Step 2: Implement `evaluate_rule_e(...)`**

Canonicalize current-master facts; distinct series alone does not create distinct symbols.

#### Rule F

- [ ] **Step 3: Add Rule-F RED tests**

Positive:

```text
authoritative DELISTING evidence binds local security
local/current do not share same proven ISIN
no proven Rule-D continuity
```

Counter-tests:
- unrelated delisting ignored;
- same proven continuing security does not trigger F.

- [ ] **Step 4: Implement `evaluate_rule_f(...)`**

#### Rule G

- [ ] **Step 5: Add Rule-G RED tests**

Positive:

```text
same exchange
same symbol
different non-empty ISIN
old authoritative lifecycle end
new authoritative listing/current lifecycle
old end < new start
```

Negative:
- chronology absent -> no G; generic D conflict remains;
- equal dates -> not G;
- overlapping dates -> not G.

- [ ] **Step 6: Implement `evaluate_rule_g(...)`**

- [ ] **Step 7: Run B6 GREEN**

Expected: E/F/G tests PASS.

---

### Task 8: B7 — Rule H Series Change / Same Security

**Files:**
- Modify: `src-tauri-shell/src/database/identity_evidence_resolver.rs`
- Test: inline tests

**Interfaces:**
- Produces:
  - `CONFIRMED`
  - `SAME_SECURITY_NO_IDENTITY_SPLIT`
  - `SeriesChangeNotNewSecurityByDefaultV1`

This is a mandatory acceptance cluster.

- [ ] **Step 1: Add Rule-H RED tests**

Positive cases:

```text
BE -> EQ
EQ -> BE
BZ -> EQ
arbitrary future series code -> another code
```

Every positive case requires:

```text
same exchange
same symbol
same mechanically-normalized company name
same non-empty ISIN
same lifecycle state when supplied
different non-empty series
authoritative SERIES_CHANGE evidence
evidence symbol == current symbol
evidence ISIN == shared ISIN
evidence series == official series
compatible date
```

Example:

```rust
#[test]
fn er2b_rule_h_confirms_same_security_across_be_to_eq() {
    let input = rule_h_input("BE", "EQ", "INE123456789");

    let result = resolve_identity(&input).unwrap();

    assert_eq!(result.status, IdentityResolverStatus::Confirmed);
    assert_eq!(
        result.conclusion,
        IdentityResolverConclusion::SameSecurityNoIdentitySplit
    );
    assert_eq!(
        result.rule_id,
        IdentityResolverRuleId::SeriesChangeNotNewSecurityByDefaultV1
    );
}
```

Counter-tests:

```text
same symbol + different series + different ISIN -> never H
missing SERIES_CHANGE evidence -> no H
wrong symbol in series evidence -> no H
wrong ISIN in series evidence -> no H
same series -> no H
```

- [ ] **Step 2: Run Rule-H RED**

- [ ] **Step 3: Implement `evaluate_rule_h(...)`**

Do not whitelist `EQ/BE/BZ`.

- [ ] **Step 4: Run Rule-H GREEN**

Expected: all series cases PASS.

Reviewer gate: reject Task 8 if a series whitelist or symbol-only inference is introduced.

---

### Task 9: B8/B9 — Candidate Arbitration and Precedence

**Files:**
- Modify: `src-tauri-shell/src/database/identity_evidence_resolver.rs`
- Test: inline tests

**Interfaces:**
- Produces:
  - `IdentityResolverCandidate`
  - `arbitrate_candidates(...)`
  - deterministic conflict specificity
  - ambiguity error

- [ ] **Step 1: Add candidate struct**

```rust
#[derive(Clone, Debug, PartialEq, Eq)]
struct IdentityResolverCandidate {
    rule_id: IdentityResolverRuleId,
    status: IdentityResolverStatus,
    conclusion: IdentityResolverConclusion,
    precedence: IdentityResolverPrecedenceClass,
    evidence_ids: Vec<String>,
    explanation: String,
}
```

- [ ] **Step 2: Add synthetic arbitration RED tests**

Required:

```text
D conflict + H confirm -> D conflict wins
G conflict + D conflict -> G wins
E conflict + G conflict -> E wins
D confirmed + H confirm -> D confirmed wins
A + H incompatible ordinary candidates -> AmbiguousDeterministicCandidates
same semantic duplicate candidate -> canonical collapse
```

- [ ] **Step 3: Run RED**

- [ ] **Step 4: Implement conflict specificity**

Hard-conflict ordering function:

```rust
fn hard_conflict_specificity(rule_id: IdentityResolverRuleId) -> Option<u8> {
    match rule_id {
        IdentityResolverRuleId::ActiveDuplicateIsinConflictV1 => Some(0),
        IdentityResolverRuleId::RecycledSymbolRequiresIdentityHistoryV1 => Some(1),
        IdentityResolverRuleId::DelistedInactiveNotSymbolChangeV1 => Some(2),
        IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1 => Some(3),
        _ => None,
    }
}
```

Lower number = more specific.

- [ ] **Step 5: Implement `arbitrate_candidates(...)`**

Requirements:
- highest frozen precedence class wins;
- compatible duplicate candidates collapse;
- hard conflicts use E > G > F > D-conflict;
- incompatible same-precedence candidates return `AmbiguousDeterministicCandidates`;
- evaluator invocation order cannot determine outcome.

- [ ] **Step 6: Run arbitration GREEN**

---

### Task 10: B8 — Rule I Fallback and Full `resolve_identity(...)`

**Files:**
- Modify: `src-tauri-shell/src/database/identity_evidence_resolver.rs`
- Test: inline tests

**Interfaces:**
- Completes the production resolver.

- [ ] **Step 1: Add Rule-I RED tests**

Required:

```text
symbol mismatch + missing symbol history -> I
series mismatch + missing series history -> I
name mismatch + missing name history -> I
different non-empty ISIN without continuity proof -> D conflict, never I
no mismatch -> NoMismatchToResolve, never I
```

- [ ] **Step 2: Add full flow RED tests**

Ensure:
- A-H candidate collection is independent;
- arbitration result is converted to `IdentityResolverResult`;
- no A-H winner + material mismatch -> Rule I;
- no material mismatch -> internal no-mismatch error.

- [ ] **Step 3: Implement `has_material_mismatch(...)`**

Material dimensions:

```text
symbol
company name
series
ISIN presence/continuity
lifecycle state
```

Exchange mismatch is structural/high-risk; do not use Rule I to silently bridge two exchanges.

- [ ] **Step 4: Implement Rule-I result builder**

```rust
fn build_rule_i_candidate(...) -> IdentityResolverCandidate
```

Return:
- `InsufficientEvidence`
- `NoConclusion`
- `IncompleteHistoryRequiresMoreEvidenceV1`

Use only relevant available authoritative evidence IDs.

- [ ] **Step 5: Complete `resolve_identity(...)`**

Order:

```text
validate input
source precondition
require official for AVAILABLE
no mismatch check
evaluate A-H independently
arbitrate
if winner -> finalize
if no winner + material mismatch -> I
finalize
```

- [ ] **Step 6: Final result must pass ER2-A validator**

Add:

```rust
fn finalize_candidate(
    input: &IdentityResolverInput,
    candidate: IdentityResolverCandidate,
) -> Result<IdentityResolverResult, IdentityResolverEvaluationError>
```

Call `validate_resolver_result_contract(...)`.

- [ ] **Step 7: Add invalid-constructed-result RED/GREEN proof**

Provide a test-only malformed candidate and require:

```text
Err(InvalidConstructedResult(...))
```

- [ ] **Step 8: Run Rule-I/full-flow GREEN**

---

### Task 11: B10 — Deterministic Evidence Selection and Metamorphic Tests

**Files:**
- Modify: `src-tauri-shell/src/database/identity_evidence_resolver.rs`
- Test: inline tests

**Interfaces:**
- Produces deterministic canonical evidence output independent of input ordering.

- [ ] **Step 1: Add RED tests for evidence shuffle**

For a Rule-H input:

```text
[e-current, e-series, e-unrelated]
[e-unrelated, e-series, e-current]
```

must produce exactly the same:

```text
status
conclusion
rule_id
evidence_ids
```

- [ ] **Step 2: Add case/whitespace metamorphic tests**

Equivalent values such as:

```text
"NSE"
" nse "

"ABC LIMITED"
" abc    limited "
```

must produce the same semantic result.

- [ ] **Step 3: Add irrelevant-evidence test**

Adding unrelated authoritative evidence for another symbol/security must not change the winner or output supporting evidence.

- [ ] **Step 4: Add duplicate-equivalent-fact test**

Two different evidence IDs with the same rule-relevant/provenance fact must not increase authority or change the result. Canonical representative = lexicographically smallest evidence ID.

- [ ] **Step 5: Implement canonical evidence key/selection**

Use a deterministic key composed of normalized:

```text
exchange
authority_class
source_id
source_reference
content_sha256
evidence_kind
effective_date
symbol
old_symbol
new_symbol
series
ISIN
company_name
```

Do not treat equivalent copies as independent proof.

- [ ] **Step 6: Implement stable result evidence ordering**

Categories:

```text
1. official current identity evidence
2. primary transition/conflict evidence
3. supporting historical evidence
```

Sort/deduplicate lexically within each category.

- [ ] **Step 7: Run metamorphic GREEN**

---

### Task 12: B10 — Date and Panic-Free Edge Tests

**Files:**
- Modify: `src-tauri-shell/src/database/identity_evidence_resolver.rs`
- Test: inline tests

- [ ] **Step 1: Add strict date parser tests**

Must PASS:

```text
2026-01-31
2024-02-29
```

Must reject:

```text
2026-13-01
2026-02-30
2025-02-29
04/09/2026
""
```

- [ ] **Step 2: Add chronology tests**

Required:
- transition date equal to official effective date -> eligible;
- transition before local effective-to -> not confirm;
- G old-end < new-start -> G eligible;
- G old-end == new-start -> G not eligible;
- malformed date -> no panic.

- [ ] **Step 3: Add panic-free representative inputs**

Do not use `catch_unwind` as a substitute for proper `Result`; call resolver normally on malformed/edge fixtures and assert safe return.

Production evaluator/arbitration path static scan must reject normal-flow use of:

```text
.unwrap(
.expect(
panic!(
```

Tests may use them.

- [ ] **Step 4: Run edge GREEN**

---

### Task 13: B11 — Full ER2-B Acceptance and Preservation

**Files:**
- Verify/modify only:
  - `src-tauri-shell/src/database/identity_evidence_resolver.rs`
  - docs/evidence
- All other listed production authorities must remain exact.

- [ ] **Step 1: Run complete focused resolver module**

```powershell
Set-Location -LiteralPath 'E:\TA Projects\EOD Charting Platform\src-tauri-shell'

cargo test --locked --offline `
  database::identity_evidence_resolver::tests `
  -- --nocapture
```

Record actual total test count. Do not assume a number in advance.

Expected: all ER2-A + ER2-B tests PASS.

- [ ] **Step 2: Run NSE Identity regressions**

```powershell
cargo test --locked --offline `
  database::nse_identity_imports::tests `
  -- --nocapture
```

Expected: PASS; report actual count.

- [ ] **Step 3: Run BSE Identity regressions**

```powershell
cargo test --locked --offline `
  database::bse_identity_imports::tests `
  -- --nocapture
```

Expected: PASS.

- [ ] **Step 4: Run ER1 Source Health regressions**

```powershell
cargo test --locked --offline `
  database::official_source_health::tests `
  -- --nocapture
```

Expected: PASS.

- [ ] **Step 5: Run locked/offline Cargo check**

```powershell
cargo check --locked --offline
```

Expected: PASS.

- [ ] **Step 6: Verify preserved hashes**

Must still equal accepted ER2-A authorities:

```text
database.rs
3E90B2E22CA056340F5076EBA25E0DEFE2125EE1DD467ACE7BBD4B97B65266B9

Cargo.toml
D1199096F9EA2548FD011BC120ABD15407849A75D9AAA14240DF1D250A020D42

Cargo.lock
670E1F7C8AF8C757122E48DFD37743D6A6CBE847A61C14E629149AAA2F5B9CCA

package.json
8C4BEBD7A534A3393939E4F99C4E3A28691D9FA7C8F85503F0565D4544C20E6F

package-lock.json
08A6F8C52D4FD94A6777B5CC181F534C7D74DB6C9C10CFF73D9A95806C2C766D
```

Also compare current NSE/BSE/ER1 source hashes against the live pre-ER2-B preflight rather than blindly relying on older snapshot values.

- [ ] **Step 7: Verify exact source delta**

Against a pre-ER2-B source fingerprint/manifest:

```text
MODIFIED
src-tauri-shell/src/database/identity_evidence_resolver.rs

ADDED
none in production source

REMOVED
none
```

If another production source file changed, stop and investigate.

- [ ] **Step 8: Static runtime-boundary scan**

The ER2-B production module must contain no:

```text
rusqlite::Connection
#[tauri::command]
reqwest::
apply_nse_current_universe_sync
apply_nse_historical_identity_archive
database mutation handle
HTTP client
```

`resolve_identity(...)` is now expected and authorized.

- [ ] **Step 9: Create mandatory IST change report**

Create:

```text
docs\changes\
YYYY-MM-DD_HHMM_IST_IDENTITY_ER2B_DETERMINISTIC_RULE_EVALUATION.md
```

Include:
- IST timestamp;
- objective;
- ER2-A governing design SHA;
- ER2-B design SHA;
- ER2-A resolver preimage SHA;
- ER2-B resolver postimage SHA;
- exact A-I implemented predicates;
- Rule-H BE/EQ/BZ/future-series proof;
- D/G/E/F precedence proof;
- source-unavailable behavior;
- internal error model;
- determinism/metamorphic proof;
- focused/broader test commands and actual counts;
- Cargo check result;
- source delta;
- preserved hashes;
- no DB/network/Tauri/frontend/Apply authority;
- risks/limitations;
- rollback;
- evidence ZIP SHA;
- next gate explicitly not auto-authorized.

- [ ] **Step 10: Build external evidence package**

Recommended minimum evidence files:

```text
00-authority-preflight.json
01-b0-red.log
02-b1-red.log
03-rule-a-red-green.log
04-rule-b-red-green.log
05-rule-c-red-green.log
06-rule-d-red-green.log
07-rules-efg-red-green.log
08-rule-h-red-green.log
09-rule-i-red-green.log
10-arbitration-red-green.log
11-determinism-red-green.log
12-date-edge-tests.log
13-full-er2-resolver-tests.log
14-nse-identity-regression.log
15-bse-identity-regression.log
16-er1-source-health-regression.log
17-cargo-check-locked-offline.log
18-source-after.json
19-source-delta.json
20-preservation-authorities.json
21-static-boundary.json
22-change-report.md
FINAL_STATE.json
SUMMARY.txt
```

- [ ] **Step 11: Final classification**

Only after command-backed validation:

```text
IDENTITY_ER2B_DETERMINISTIC_RULE_EVALUATION
CLOSED / GREEN / PURE EVALUATOR AUTHORITY
```

Then stop.

Do **not** start ER2-C.

---

## Transaction / Rollback Expectations for a Windows Runner

If an implementation runner is generated:

1. verify exact live preimages before mutation;
2. save the exact pre-ER2-B resolver module outside source folders;
3. install each RED test before its production behavior;
4. retain full logs externally;
5. use `CARGO_NET_OFFLINE=true`, `--locked`, `--offline`;
6. on any failed required gate:
   - restore the exact pre-ER2-B resolver module;
   - remove only ER2-B documentation/test artifacts created by the failed run as appropriate;
   - verify all preservation hashes;
   - retain failure evidence;
7. do not invoke Git;
8. do not accept a database path;
9. do not run a portable build for this pure internal Rust scope.

---

## Self-Review

### Spec coverage

Mapped:
- error channel: Tasks 1-2;
- source-unavailable precedence: Task 2;
- Rules A-C: Tasks 3-5;
- Rule D explicit bridge/conflict: Task 6;
- hard conflicts E/F/G: Task 7;
- Rule H series continuity: Task 8;
- arbitration/ambiguity: Task 9;
- Rule I fallback/full resolver: Task 10;
- deterministic evidence output: Task 11;
- strict date/panic-free behavior: Task 12;
- regression/preservation/docs/evidence: Task 13.

No approved ER2-B requirement is intentionally deferred.

### Placeholder scan

No unresolved placeholder markers, generic deferred-implementation language, or unspecified test step is present.

### Type consistency

The plan consistently uses:
- `IdentityResolverEvaluationError`
- `IdentityResolverCandidate`
- `resolve_identity`
- `evaluate_rule_a` through `evaluate_rule_h`
- `arbitrate_candidates`
- `finalize_candidate`
- existing `validate_resolver_input_contract`
- existing `validate_resolver_result_contract`

No new serialized ER2-A enum/status/rule ID is introduced.

### Scope integrity

Production source remains one Rust module. Any need for another production module/interface is an explicit stop condition rather than an implicit refactor.
