# Identity ER3-B — NSE Controlled Candidate Acquisition & Validation Design R1

**Date:** 2026-09-14 IST  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Current self-contained source authority:** `Eod Charting Platform Source Code 2026-09-14_192551_IST.zip`  
**Authority SHA-256:** `85E7CCED0A71B8E3C4C757E1BE018E65A993446AB51DEA2DECBDB250421B9C62`  
**Protected source authority:** `542 files exact`  
**Status:** DESIGN R1 WRITTEN SPEC APPROVED / IMPLEMENTATION AUTHORIZED FOR ER3-B R1

## 1. Objective

ER3-B adds a private, read-only, NSE-only candidate acquisition and validation layer after ER3-A discovery.

ER3-A deliberately stops at:

```text
DISCOVERED_NOT_PROMOTED
```

ER3-B must determine whether a discovered official-domain candidate can be validated against the frozen NSE Identity source contract, while preserving the rule that discovery/validation does **not** equal approval, promotion, configuration, persistence, or Apply authority.

The ER3-B output remains advisory evidence only.

## 2. Why ER3-B is required

Without ER3-B, the recovery sequence stops at a plausible official URL:

```text
configured source fails
→ trusted official landing page
→ ER3-A discovers official-domain candidate URLs
→ no proof that candidate bytes satisfy the required source contract
```

A plausible official URL may still return:

- an HTML error page with HTTP 200;
- a different CSV/XLSX payload;
- an incompatible schema;
- an empty or implausibly small population;
- a proposed-delisting workbook instead of the actual delisted-company workbook;
- the wrong source role;
- a redirect that exits the approved official-domain boundary.

ER3-B is therefore required to validate candidate acquisition, provenance, bounded response handling, parser/schema compatibility, population rules, and deterministic reporting before any later operator review phase.

## 3. Current authority preserved

ER3-B must preserve exactly:

```text
I3     CLOSED / ACTIVE reviewed Preview → Apply authority
I4     CLOSED / ACTIVE reviewed Preview → atomic Apply authority
ER0    RESOLVED / CLOSED
ER1    CLOSED / CURRENT
ER2    CLOSED / CURRENT
ER3-A  CLOSED / GREEN
ER3-B  DESIGN APPROVED / IMPLEMENTATION NOT YET AUTHORIZED
ER3-C  NOT AUTHORIZED
ER4+   NOT AUTHORIZED
```

ER3-B must not change:

- I3 reviewed mutation authority;
- I4 reviewed mutation authority, rollback, or stale-SHA protections;
- ER1’s current health-report behavior or UI;
- ER2 resolver/shadow semantics;
- ER3-A ordering, matching, rejection behavior, or `DISCOVERED_NOT_PROMOTED` authority;
- configured official URLs;
- managed Identity archive behavior;
- database schema/data;
- public Tauri commands/contracts;
- frontend behavior;
- BSE behavior;
- deferred NSE temp-staging concurrency behavior.

## 4. Architectural decision

Use an isolated validation module rather than expanding ER1 or adding network behavior to ER3-A.

Expected new owner:

```text
src-tauri-shell\src\database\official_source_candidate_validation.rs
```

Expected minimal related changes:

```text
src-tauri-shell\src\database.rs
src-tauri-shell\src\database\official_source_discovery.rs
```

`official_source_discovery.rs` may expose only the minimum `pub(crate)` / sibling-visible source-contract metadata required by ER3-B. Its existing offline discovery behavior must remain unchanged.

ER3-B should reuse existing authorities from:

```text
src-tauri-shell\src\database\official_source_urls.rs
src-tauri-shell\src\database\official_source_health.rs
src-tauri-shell\src\database\nse_identity_imports.rs
```

No second official-host allowlist or duplicate parser should be created.

## 5. Responsibility boundary

### ER3-A owns

- trusted landing-page text input;
- bounded `href` extraction;
- relative URL resolution;
- NSE official-domain candidate filtering;
- source-role semantic matching;
- deterministic candidate ordering;
- `DISCOVERED_NOT_PROMOTED` classification.

### ER3-B owns

- controlled network acquisition;
- ER1-failure → ER3 source mapping;
- bounded landing-page fetch;
- bounded candidate fetch;
- provenance/redirect enforcement;
- response-size enforcement;
- content-type assessment;
- SHA-256 capture;
- source-specific parser/schema/population validation;
- deterministic candidate-validation reporting.

### ER3-B does not own

- UI;
- operator approval;
- URL promotion;
- settings persistence;
- source version history;
- DB writes;
- managed archive writes;
- BSE recovery;
- ER3-C/ER4 behavior.

## 6. Recovery trigger contract

Production ER3-B orchestration must start only from explicit configured-source failure evidence.

Eligible trigger categories:

```text
PROVENANCE_FAILURE
TRANSPORT_FAILURE
HTTP_FAILURE
FORMAT_OR_SCHEMA_FAILURE
POPULATION_FAILURE
SEMANTIC_FAILURE
```

A healthy ER1 result must not trigger recovery.

Any later audit/characterization mode that validates current healthy sources must be explicitly labelled as characterization and must not be confused with normal recovery.

## 7. ER1 → ER3 source mapping

The mapping is explicit and frozen; substring inference is prohibited.

| ER1 source ID | ER3 source contract |
|---|---|
| `NSE_EQUITY_MASTER` | `NSE_CURRENT_EQUITY_MASTER` |
| `NSE_SME_MASTER` | `NSE_CURRENT_SME_MASTER` |
| `NSE_SYMBOL_CHANGE` | `NSE_SYMBOL_CHANGE_HISTORY` |
| `NSE_COMPANY_NAME_CHANGE` | `NSE_COMPANY_NAME_CHANGE_HISTORY` |
| `NSE_DELISTED_WORKBOOK` | `NSE_DELISTED_COMPANIES_WORKBOOK` |
| `NSE_DELISTED_LANDING` | `NSE_DELISTED_COMPANIES_WORKBOOK` with landing-failure context |

Unsupported ER1 source IDs, including all BSE rows, are not eligible for ER3-B and must fail closed or report `NOT_ELIGIBLE_FOR_ER3B` without network acquisition.

## 8. Network safety boundary

Initial ER3-B network policy:

| Boundary | Limit |
|---|---:|
| HTTP method | `GET` only |
| Scheme | HTTPS only |
| Hosts | existing frozen NSE official host allowlist only |
| Redirects | existing NSE redirect policy, maximum 10 hops |
| Request timeout | 45 seconds |
| Landing-page body | 4 MiB maximum |
| Candidate body | 32 MiB maximum per candidate |
| Total candidate bytes | 64 MiB maximum per validation run |
| Candidate fetches | first 5 deterministic ER3-A candidates |
| Automatic retry | none in R1 |
| Recursive discovery | prohibited |

Response-size enforcement must use both:

1. `Content-Length` precheck when present; and
2. bounded streaming/read enforcement because `Content-Length` may be absent or incorrect.

The service must not:

- execute scripts;
- interpret page instructions;
- request arbitrary embedded resources;
- invoke shell commands;
- perform unrestricted web search;
- contact localhost/private-network addresses;
- download/execute binaries.

The existing exact NSE host allowlist remains the sole host provenance authority.

## 9. Proposed validation flow

```text
ER1 configured-source failure
        ↓
exact ER1 → ER3 mapping
        ↓
bounded GET of trusted NSE landing page
        ↓
ER3-A discovery on acquired landing bytes/text
        ↓
first N deterministic candidates
        ↓
bounded GET per candidate
        ↓
NSE provenance / redirect validation
        ↓
HTTP + size + content-type evidence
        ↓
SHA-256 of candidate bytes
        ↓
source-specific parser/schema/population validation
        ↓
VALIDATED_CANDIDATE_NOT_PROMOTED
INDETERMINATE_CANDIDATE
REJECTED_CANDIDATE
```

No step writes settings, archives, DB state, or Apply state.

## 10. Candidate validation report contract

Each candidate result should record at minimum:

```text
sourceId
sourceRole
configuredUrl
landingPageUrl
candidateUrl
discoveryReason
requestUrl
finalUrl
httpStatus
contentType
responseBytes
contentSha256
parserStatus
schemaStatus
populationStatus
populationCount
freshnessStatus
validationReason
classification
```

Raw response bytes remain internal/in-memory only and must not be returned in the report.

The report must contain no field that can express approval, promotion, persistence, or Apply authority.

## 11. Candidate classifications

Exact ER3-B R1 states:

```text
VALIDATED_CANDIDATE_NOT_PROMOTED
INDETERMINATE_CANDIDATE
REJECTED_CANDIDATE
```

### `VALIDATED_CANDIDATE_NOT_PROMOTED`

All mandatory checks pass:

- NSE official provenance;
- HTTPS/redirect boundary;
- successful HTTP response;
- byte limits;
- compatible/non-HTML content;
- frozen parser/schema validation;
- mandatory population rule;
- source-role semantics.

### `INDETERMINATE_CANDIDATE`

Acquisition succeeded, but one non-fatal contract dimension cannot be proven safely. This classification carries no approval authority.

### `REJECTED_CANDIDATE`

Any mandatory check fails.

ER3-B must never emit:

```text
APPROVED
PROMOTED
CONFIGURED
APPLIED
```

## 12. Source-specific validation

### 12.1 Current equity master

Reuse the existing equity health parser/validator and current-population authority.

Mandatory population:

```text
>= 1000 supported symbols
```

A 999-row supported-symbol result is rejected.

### 12.2 SME master

Reuse the existing SME health parser/validator.

Require successful parsing and non-empty supported population. Do not invent the 1000-row equity threshold for SME.

### 12.3 Symbol-change history

Reuse the existing symbol-change health parser/validator.

Require successful parsing and at least one valid row.

### 12.4 Company-name-change history

Reuse the frozen I4-compatible parser/header/row contract.

Require successful parsing and at least one valid row.

### 12.5 Delisted-company workbook

Reuse the existing delisted-workbook health parser/validator.

Require at least one valid Symbol entry.

ER3-A’s rejection of proposed-delisting-only links remains unchanged and must continue to protect ER3-B input.

## 13. Content-type handling

### CSV-compatible

Accepted header values may include:

```text
text/csv
application/csv
text/plain
application/octet-stream
```

### XLSX-compatible

Accepted header values may include:

```text
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
application/octet-stream
```

Explicit `text/html` for a CSV/XLSX candidate is a hard rejection even with HTTP 200.

Missing or generic content type does not by itself validate or reject a candidate when the frozen parser can make the mandatory content determination. The header must still be recorded in the report.

## 14. Freshness semantics

ER3-B must not infer historical freshness from download time.

For newly fetched candidate bytes:

```text
freshnessStatus = NOT_APPLICABLE
```

The existing 14-day saved-source reuse rule remains outside this live candidate-validation decision.

No `Last-Modified` freshness rule may be invented in ER3-B R1 without a separately frozen source contract.

## 15. Error handling

Fail closed at each authority boundary.

### Whole-request errors

Examples:

- unsupported source mapping;
- invalid configured authority;
- invalid trusted landing-page authority;
- malformed orchestration request.

These return a request-level error and perform no candidate fetch.

### Candidate-local errors

Examples:

- candidate transport failure;
- candidate HTTP failure;
- body-size overflow;
- incompatible content type;
- parser/schema failure;
- population failure;
- semantic mismatch.

These become deterministic candidate results and do not crash the entire run unless continuing would violate the total-run safety budget or authority boundary.

## 16. Determinism

Given the same:

- ER1 failure input;
- landing-page bytes;
- ER3-A discovery result;
- candidate response fixtures;

ER3-B must produce the same candidate ordering, classifications, reasons, SHA-256 values, and aggregate report regardless of fixture insertion order.

Network timestamps must not participate in classification or ordering.

## 17. Operator visibility and persistence

ER3-B remains:

```text
private backend
read-only
in-memory
non-persistent
non-promoting
```

No Tauri command, TypeScript type, renderer state, UI, saved candidate history, or URL-version history is added in ER3-B R1.

Operator-visible review remains ER3-C/ER4 territory and requires separate design approval.

## 18. Implementation stages under this design

ER3-B may be implemented as three bounded stages under this single approved architecture:

### ER3-B1 — offline validation contract

- request/report/classification contracts;
- exact ER1→ER3 mapping;
- source-specific validation over injected response fixtures;
- body-size/content-type/parser/population semantics;
- no network.

### ER3-B2 — bounded NSE transport

- reqwest acquisition;
- official redirect policy;
- landing-page acquisition;
- candidate acquisition;
- total byte/candidate limits;
- orchestration with ER3-A.

### ER3-B3 — controlled online verification and closeout

- explicitly authorized live NSE read-only verification;
- no DB/settings/archive write;
- no UI;
- no promotion;
- evidence capture and closeout.

Each implementation stage requires RED→GREEN evidence and preservation regression before proceeding to the next stage.

## 19. Required tests

At minimum prove:

1. healthy ER1 result cannot trigger recovery;
2. exact ER1→ER3 source-ID mapping;
3. unsupported/BSE source is not eligible;
4. non-HTTPS candidate rejected;
5. lookalike/unapproved host rejected;
6. redirect to unapproved host rejected;
7. redirect-loop/hop limit enforced;
8. landing-page body limit enforced;
9. candidate body limit enforced with `Content-Length`;
10. candidate body limit enforced without/trusting `Content-Length`;
11. total-run candidate-byte limit enforced;
12. candidate count capped deterministically;
13. HTML response rejected for CSV/XLSX source;
14. compatible CSV content type accepted;
15. compatible XLSX content type accepted;
16. equity parser and >=1000 population pass;
17. equity 999-row candidate rejected;
18. SME parser/non-empty population pass;
19. symbol-change parser pass/fail;
20. company-name-change parser pass/fail;
21. delisted-workbook parser pass/fail;
22. content SHA-256 deterministic;
23. transport failure never becomes validated;
24. raw body is absent from report;
25. candidate state cannot express approval/promotion;
26. input/fixture order does not change deterministic output;
27. ER3-A discovery behavior remains unchanged.

Preservation regressions must include as applicable:

```text
official_source_runtime_provenance_
er1_
er3a_
NSE delisted discovery tests
i3_reviewed_
i4_historical_
er2a_
er2b_
er2c1_
er2c2_
cargo check --locked --offline
```

## 20. Controlled online verification gate

ER3-B cannot close without one explicitly authorized online read-only verification because controlled acquisition is its central capability.

The live gate does **not** require NSE to have moved a source.

A valid verification may prove:

```text
official NSE landing-page acquisition works
configured official source acquisition works
redirect/provenance boundaries hold
real returned bytes satisfy the frozen source contract
zero alternate candidates is an acceptable result
```

If a genuine alternate candidate is discovered, ER3-B may validate and report it but must not promote it.

Live verification boundaries:

- NSE only;
- GET only;
- official-host allowlist only;
- read-only;
- no application/user DB;
- no settings write;
- no managed archive write;
- no UI;
- no URL promotion;
- evidence under `E:\TA Projects\EOD Charting Platform\tmp`.

## 21. Acceptance criteria

ER3-B may close only when all of the following are satisfied:

- ER3-B1 deterministic offline tests pass;
- ER3-B2 bounded transport tests pass;
- one ER3-B3 controlled NSE online verification completes with truthful bounded evidence;
- configured source URLs remain unchanged;
- candidate bodies remain in memory only;
- no DB/settings/archive write occurs;
- no Tauri/frontend public surface is added;
- BSE remains untouched;
- I3/I4/ER1/ER2/ER3-A preservation regressions pass;
- deferred NSE concurrency issue remains untouched;
- evidence is stored only under project `tmp`;
- documentation closeout is performed before a new source snapshot;
- a new source snapshot is created only after ER3-B closeout.

## 22. Non-goals

ER3-B R1 does not implement:

- operator candidate review UI;
- automatic/manual URL promotion;
- saved candidate history;
- source version history;
- BSE source recovery;
- arbitrary web search;
- AI-driven ranking;
- DB/schema changes;
- changes to I3/I4 Apply;
- changes to ER1 UI/report semantics;
- repair of the deferred NSE temp-staging concurrency issue;
- ER3-C or ER4+.

## 23. Evidence location policy

Routine ER3-B task evidence:

```text
E:\TA Projects\EOD Charting Platform\tmp
```

Source-code snapshot evidence only:

```text
E:\TA Projects\EOD Charting Platform Source Audit
```

## 24. Rollback principle

Each ER3-B implementation stage must be independently reversible by restoring only the files changed by that stage and removing newly created ER3-B files. No database rollback should be required because ER3-B is forbidden from writing application/user DB state.

## 25. Approval / implementation gate

This document defines ER3-B Design R1 only.

Implementation is not authorized until:

1. this written specification is reviewed and approved;
2. a separate ER3-B implementation plan is written from this design;
3. that plan is reviewed/approved before source changes begin.

ER3-C, ER4+, BSE recovery, URL promotion, persistence, and the deferred concurrency repair remain separately gated.
