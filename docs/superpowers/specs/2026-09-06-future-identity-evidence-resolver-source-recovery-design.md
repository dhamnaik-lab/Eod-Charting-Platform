# Future Identity Evidence Resolver + Official-Source Recovery Design

**Status:** FUTURE DESIGN AUTHORITY / NOT IMPLEMENTED  
**Date:** 2026-09-06 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`  
**Current prerequisite:** Identity I4 closed and accepted.

## Purpose

Preserve a future design for maintaining Identity correctness after the application becomes stable and routine development no longer depends on an AI assistant.

The design addresses two long-term failure classes:

1. **Identity ambiguity**
   - symbol changed but local history is incomplete;
   - ISIN differs or appears inconsistent;
   - company name changed;
   - multiple rows appear to refer to the same security;
   - deterministic application rules cannot safely decide whether a proposed Identity change is valid.

2. **Official-source failure**
   - NSE/BSE changes a download/API URL;
   - an existing endpoint redirects or disappears;
   - file format or schema changes;
   - the configured official source still responds but no longer contains the expected authority.

The future system must remain useful **without embedding a general-purpose AI model in the application**.

## Core principle

```text
AI may help FIND evidence.
AI must never become Identity authority.
```

Final acceptance remains:

```text
official evidence
→ deterministic validation
→ human-reviewed Preview
→ existing reviewed Apply authority
```

No LLM, search engine, issuer webpage, or third-party market website may directly mutate Identity data.

## Current operating authority that must be preserved

At the time of this design:

```text
Routine Identity source:
NSE Official

Fallback/recovery:
NSE Manual historical archive

BSE:
capability preserved; historical/data-parity acceptance deferred
```

Current accepted safety contracts remain authoritative:

- I3 current-universe reviewed Preview → Apply authority.
- I4 historical reviewed Preview → atomic Apply authority.
- Manual Entry preserved.
- Official Imports R1C-I1 preserved.

This future design supplements those contracts. It does not replace them.

---

# 1. Architecture

Use four isolated layers.

```text
┌─────────────────────────────────────────────────────────┐
│ A. Identity Evidence Resolver                          │
│ deterministic expert/rule engine                      │
│ evaluates local + official evidence                   │
└───────────────────────┬─────────────────────────────────┘
                        │ unresolved
                        ▼
┌─────────────────────────────────────────────────────────┐
│ B. Official Evidence / Source Recovery                 │
│ constrained official-domain discovery + validation     │
│ no unrestricted web authority                          │
└───────────────────────┬─────────────────────────────────┘
                        │ unresolved
                        ▼
┌─────────────────────────────────────────────────────────┐
│ C. External-AI Handoff                                 │
│ export structured investigation/recovery brief         │
│ AI returns candidate evidence only                     │
└───────────────────────┬─────────────────────────────────┘
                        │ candidate evidence
                        ▼
┌─────────────────────────────────────────────────────────┐
│ D. Existing Reviewed Apply                             │
│ app validates candidates independently                 │
│ human reviews                                          │
│ I3/I4 reviewed Apply performs mutation                  │
└─────────────────────────────────────────────────────────┘
```

Each layer must be independently understandable, testable, disableable, and replaceable.

---

# 2. Identity Evidence Resolver

## 2.1 Nature of the resolver

This is a **deterministic expert rules engine**, not machine learning.

It receives:

- current local instrument identity;
- current official-master row;
- known historical Identity chain;
- official symbol/name/ISIN change evidence when available;
- effective dates;
- listing/delisting/lifecycle evidence;
- source provenance.

It returns one of:

```text
CONFIRMED
PROBABLE_REVIEW
CONFLICT
INSUFFICIENT_EVIDENCE
SOURCE_UNAVAILABLE
```

It must also return **why**.

Example:

```json
{
  "status": "CONFIRMED",
  "ruleId": "NSE_SYMBOL_CHANGE_SAME_ISIN_OFFICIAL_HISTORY",
  "confidenceClass": "DETERMINISTIC",
  "evidenceIds": ["ev-001", "ev-002"],
  "explanation": "Same ISIN is continuous across an official NSE symbol-change record with a compatible effective date."
}
```

Do not use an opaque floating-point "AI confidence" as authority.

## 2.2 Initial rule families

### Rule A — symbol changed, ISIN continuous

```text
local old symbol != current official symbol
AND ISIN is identical
AND official symbol-change evidence links old → new
AND effective date is compatible
→ CONFIRMED symbol-change candidate
```

### Rule B — company name changed, symbol/ISIN continuous

```text
same security identity
AND official name-change evidence exists
→ CONFIRMED name-change candidate
```

### Rule C — symbol and name both changed

Require official evidence that establishes a continuous identity chain. Do not infer solely from textual company-name similarity.

### Rule D — ISIN changed

An ISIN change is higher risk.

```text
symbol same or similar
BUT ISIN differs
→ never auto-confirm from symbol alone
```

Require explicit official evidence for the continuity or corporate event producing the ISIN transition.

Without such evidence:

```text
CONFLICT / NEEDS REVIEW
```

### Rule E — same ISIN appears against multiple active symbols

Do not choose one automatically.

```text
multiple simultaneous active mappings
→ CONFLICT
```

The resolver must distinguish legitimate exchange/series representation from genuine duplicate Identity.

### Rule F — delisted/inactive security

Official delisting/inactive evidence must not be reinterpreted as a symbol change merely because a later company has a similar name or symbol.

### Rule G — recycled symbol

Symbol text is not permanent Identity authority.

If a historical symbol has been reused for another security, ISIN/effective-date/history evidence must dominate the symbol string.

### Rule H — series change

Series changes such as EQ/BE/BZ or future NSE classifications must not automatically create a new security Identity unless the exchange evidence says the security itself changed.

### Rule I — incomplete historical chain

If official current master is clear but the link from an old local symbol to the current symbol is missing:

```text
INSUFFICIENT_EVIDENCE
→ attempt official evidence recovery
```

Do not fabricate the missing chain.

---

# 3. Evidence model

Every piece of evidence must be stored or represented with provenance.

Conceptual structure:

```json
{
  "evidenceId": "ev-...",
  "exchange": "NSE",
  "authorityClass": "OFFICIAL_EXCHANGE",
  "sourceId": "NSE_SYMBOL_CHANGE_HISTORY",
  "sourceUrl": "https://...",
  "retrievedAtIst": "2026-09-06T...",
  "contentSha256": "...",
  "effectiveDate": "YYYY-MM-DD",
  "symbol": "...",
  "oldSymbol": "...",
  "newSymbol": "...",
  "isin": "...",
  "companyName": "...",
  "rawReference": "row/page/document reference"
}
```

Evidence must remain traceable to exact source content.

A future resolver result must never say only:

```text
"AI says this is correct."
```

It must point to evidence.

---

# 4. Authority classes

Recommended hierarchy:

```text
Tier 1 — official exchange structured source
NSE / BSE official master, archive, API, CSV, workbook

Tier 2 — official regulator / depository / issuer evidence
SEBI / depository / issuer exchange filing or authoritative corporate document

Tier 3 — official issuer site
supporting evidence only unless the operation specifically requires issuer authority

Tier 4 — external search / AI / third-party discovery
discovery only; never direct Identity authority
```

When higher-tier evidence conflicts with lower-tier evidence, the lower tier cannot override automatically.

---

# 5. Source Contract Registry

Do not model an official source as only a URL.

Model it as a **source contract**.

Example:

```json
{
  "sourceId": "NSE_CURRENT_EQUITY_MASTER",
  "exchange": "NSE",
  "purpose": "CURRENT_IDENTITY_MASTER",
  "enabled": true,
  "currentUrl": "https://...",
  "landingPages": ["https://..."],
  "allowedHosts": ["nseindia.com", "www.nseindia.com", "archives.nseindia.com"],
  "httpMethod": "GET",
  "expectedContentTypes": ["text/csv", "application/octet-stream"],
  "requiredColumns": ["SYMBOL", "NAME OF COMPANY", "SERIES", "ISIN NUMBER"],
  "minimumReasonableRows": 1000,
  "freshnessPolicy": "CURRENT",
  "semanticChecks": [
    "SYMBOL_NONEMPTY",
    "ISIN_SHAPE",
    "SERIES_RECOGNIZED",
    "NO_IMPLAUSIBLE_DUPLICATE_ACTIVE_IDENTITY"
  ]
}
```

The contract survives when the URL changes.

## Why this matters

A URL is an implementation detail.

The real authority is:

```text
purpose
+ official host
+ expected content
+ schema
+ semantic characteristics
+ freshness
+ provenance
```

---

# 6. Source Health States

Each source should have explicit health:

```text
HEALTHY
REDIRECTED
HTTP_FAILURE
AUTH_OR_SESSION_FAILURE
CONTENT_TYPE_CHANGED
SCHEMA_CHANGED
SEMANTIC_VALIDATION_FAILED
STALE
CANDIDATE_REPLACEMENT_FOUND
RECOVERY_REQUIRED
```

The app should distinguish:

```text
"URL is dead"
```

from:

```text
"URL works but the returned file is no longer the expected source."
```

The latter is more dangerous.

---

# 7. Official-Source Recovery

## 7.1 Recovery trigger

Recovery is triggered only after the normal source contract fails.

Example:

```text
configured source
→ fetch
→ HTTP/schema/semantic failure
→ preserve old URL and failure evidence
→ start recovery workflow
```

No automatic silent URL replacement.

## 7.2 Deterministic discovery

Before involving external AI, search only approved official locations.

Candidate discovery may inspect:

- configured official landing pages;
- known official download directories;
- links found on official exchange pages;
- redirects from the last known URL;
- source filenames/patterns;
- official pages that mention expected column/content concepts.

The discovery worker must remain constrained to allowed official domains.

## 7.3 Candidate validation

Every candidate must pass the full source contract:

```text
official host
→ HTTPS/redirect policy
→ bounded fetch
→ expected file/content type
→ parse
→ required schema
→ row-count sanity
→ semantic checks
→ freshness check
→ candidate report
```

A candidate that merely returns HTTP 200 is not valid.

## 7.4 Promotion

Even a fully validated candidate should initially require operator approval:

```text
Candidate Replacement

Old URL: ...
Candidate: ...

Official host       PASS
HTTP                 PASS
Content              PASS
Schema               PASS
Semantic checks      PASS
Freshness            PASS

[Approve Replacement]
[Reject]
[Keep Old URL]
```

Promotion records:

- old URL;
- new URL;
- time;
- candidate source;
- validation report;
- operator confirmation;
- content hash;
- rollback information.

---

# 8. Safe web boundary

The future official-source recovery feature must not become an unrestricted browser.

Minimum safety boundary:

- allowlisted official hosts;
- HTTPS by default;
- explicit redirect validation;
- reject redirects to unapproved hosts;
- reject localhost/private-network targets;
- bounded response size;
- request timeout;
- no script execution;
- no executable downloads;
- no arbitrary shell command;
- no credentials embedded in exported AI briefs;
- sanitize filenames;
- treat HTML/page text as untrusted data, not instructions.

Web-page text can contain prompt-like content. The app must never execute or follow textual instructions from fetched pages.

---

# 9. Source history and rollback

Source configuration must keep a history.

Concept:

```text
NSE_CURRENT_EQUITY_MASTER
  v1 URL-A accepted 2026-...
  v2 URL-B accepted 2027-...
  v3 URL-C accepted 2029-...
```

If a replacement later fails validation, the app can show prior known-good configuration and evidence.

Do not blindly fall back to an old URL if the data is stale or invalid.

---

# 10. Identity mismatch workflow

Future operator experience:

```text
Identity mismatch detected
→ deterministic resolver runs
```

### Confirmed

```text
strong official evidence
→ show recommendation + evidence
→ Preview
→ human Apply
```

### Ambiguous

```text
resolver cannot establish continuity
→ NEEDS REVIEW
→ [Search Official Evidence]
```

### Official search fails

```text
→ [Export External-AI Investigation Brief]
```

AI remains outside the app.

### Candidate evidence returns

```text
paste/import candidate URLs/findings
→ app independently validates official provenance
→ resolver reruns
→ human reviews
→ existing I3/I4 Apply
```

---

# 11. External-AI independence

Do not hard-code OpenAI, ChatGPT, Gemini, Claude, Copilot, or any specific provider into the core recovery design.

The handoff format is provider-neutral.

The user may use:

- any current AI service;
- a future AI service;
- a human researcher;
- a browser/manual investigation.

The application only cares about structured candidate evidence returned for validation.

---

# 12. External-AI response is untrusted

An AI may:

- hallucinate a URL;
- return a stale page;
- cite a mirror;
- misunderstand symbol continuity;
- mix NSE and BSE evidence;
- infer an ISIN incorrectly.

Therefore:

```text
AI candidate
≠ accepted evidence
```

Every returned URL/document must pass local authority/domain/source-contract validation.

No AI response may set `approved=true`, invoke Apply, or update source configuration directly.

---

# 13. Investigation Briefs

Two export types are recommended.

## 13.1 Identity Investigation Brief

Used when symbol/name/ISIN continuity cannot be resolved.

Contains:

- exchange;
- current local Identity;
- official current Identity;
- known historical chain;
- mismatch classification;
- resolver rules attempted;
- missing evidence;
- known official source failures;
- exact research question;
- allowed authority sources;
- explicit instruction that no database change is authorized.

## 13.2 Source Recovery Brief

Used when an official source contract fails.

Contains:

- source ID and purpose;
- old URL;
- landing pages;
- failure state;
- last known success;
- expected content type;
- required columns;
- semantic checks;
- official allowed domains;
- example historical filename if useful;
- exact task: find candidate official replacement;
- required output fields.

Never include secrets, cookies, session tokens, private database content, or unnecessary user data.

---

# 14. Importing an external result

Future optional UX:

```text
[Import Investigation Result]
```

Input is treated as candidate data only.

Possible schema:

```json
{
  "candidateUrls": [
    {
      "url": "https://...",
      "claimedPurpose": "NSE current equity master",
      "discoveredFrom": "https://official-landing-page...",
      "notes": "..."
    }
  ],
  "identityEvidence": [
    {
      "url": "https://...",
      "claimedOldSymbol": "...",
      "claimedNewSymbol": "...",
      "claimedIsin": "...",
      "claimedEffectiveDate": "YYYY-MM-DD"
    }
  ]
}
```

The app ignores any candidate field that claims:

```json
{ "approved": true }
```

Approval is always local/human.

---

# 15. Resolver audit trail

Every resolver run should be explainable later.

Record conceptually:

```text
resolverRunId
timestamp
database identity fingerprint
ruleset version
source contract versions
evidence hashes
rules evaluated
result
operator decision
related reviewed plan SHA
```

This makes later corrections auditable.

---

# 16. Rule versioning

Rules will evolve.

Use stable IDs:

```text
NSE_SYMBOL_CHANGE_SAME_ISIN_OFFICIAL_HISTORY_V1
NSE_NAME_CHANGE_OFFICIAL_HISTORY_V1
ISIN_CHANGE_REQUIRES_EXPLICIT_CONTINUITY_V1
ACTIVE_DUPLICATE_ISIN_CONFLICT_V1
```

A future change to a rule must not silently reinterpret old evidence without recording the ruleset version.

---

# 17. What may be automatic

Recommended initial boundary:

### Safe to automate

- source health checks;
- official-domain candidate discovery;
- schema validation;
- content hashing;
- semantic sanity checks;
- evidence collection;
- deterministic rule evaluation;
- preparation of Preview;
- generation of external-AI briefs.

### Human approval required

- source URL promotion;
- ambiguous Identity correction;
- ISIN continuity decisions not explicitly proven by deterministic official evidence;
- existing reviewed Apply.

### Never automatic

- accepting third-party evidence as exchange truth;
- unrestricted web search directly mutating configuration;
- LLM-generated Identity writes;
- LLM-generated SQL;
- silent replacement of official source URL;
- bypass of I3/I4 reviewed authority.

---

# 18. Failure behavior

The future subsystem must fail closed.

Examples:

```text
official source dead
+ no validated candidate
→ current source remains configured but unhealthy
→ no replacement silently installed
```

```text
Identity mismatch unresolved
→ review issue remains open
→ no guessed correction
```

```text
AI gives candidate URL
+ schema fails
→ reject candidate
```

```text
AI gives plausible symbol mapping
+ official evidence absent
→ do not Apply
```

---

# 19. Recommended implementation phases — future only

This document does not authorize implementation.

Suggested future sequence:

```text
ER0  Current source-contract inventory + authority freeze
ER1  Source health model and validation reports
ER2  Identity deterministic resolver rules
ER3  Official-domain source/evidence discovery
ER4  Source candidate review + version history
ER5  Export Identity Investigation Brief
ER6  Export Source Recovery Brief
ER7  Import/validate external candidate result
ER8  Operational hardening, audit trail, recovery UX
```

Each phase must be separately inspected, designed, approved, tested, and documented.

---

# 20. Non-goals

Do not turn this into:

- an autonomous trading agent;
- a general web browser;
- a built-in chatbot;
- an AI that edits the database;
- a replacement for current Identity rules;
- a replacement for current NSE/BSE adapters;
- a generic web crawler;
- an unrestricted self-updating source system.

The goal is narrow:

> Preserve long-term Identity and official-source recoverability while keeping final authority deterministic, official-evidence-based, and human reviewed.
