# Future Identity External-AI Handoff Contract

**Status:** FUTURE PROVIDER-NEUTRAL CONTRACT / NOT IMPLEMENTED  
**Date:** 2026-09-06 IST  
**Parent design:** `2026-09-06-future-identity-evidence-resolver-source-recovery-design.md`

## Purpose

Define how the application may ask any external AI or human researcher for help without making that external system part of runtime authority.

The handoff is **research assistance only**.

```text
External AI can suggest.
Application validates.
Human approves.
Existing reviewed Apply writes.
```

## Security rule

Never export:

- database files;
- private database paths unless explicitly necessary and sanitized;
- cookies;
- auth headers;
- tokens;
- passwords;
- user identifiers;
- unnecessary portfolio/watchlist data;
- private application logs unrelated to the source failure.

## Brief type A — Identity Investigation

Recommended export:

```json
{
  "briefVersion": "IDENTITY_INVESTIGATION_V1",
  "task": "Find official evidence resolving the identity mismatch.",
  "exchange": "NSE",
  "localIdentity": {
    "symbol": "OLDABC",
    "isin": "INE000A01001",
    "companyName": "ABC Limited"
  },
  "officialCurrentIdentity": {
    "symbol": "NEWABC",
    "isin": "INE000A01001",
    "companyName": "ABC Industries Limited"
  },
  "knownHistory": [],
  "resolverStatus": "INSUFFICIENT_EVIDENCE",
  "resolverReason": "Current source suggests continuity but local official symbol/name history is incomplete.",
  "allowedAuthority": [
    "official NSE sources",
    "official BSE sources when cross-exchange evidence is relevant",
    "SEBI / depository official evidence",
    "official issuer exchange filings"
  ],
  "requiredQuestions": [
    "Was OLDABC officially changed to NEWABC?",
    "What was the effective date?",
    "Was the ISIN continuous?",
    "Was there also a company-name change?"
  ],
  "requiredReturn": [
    "candidate evidence URL",
    "official page/document where discovered",
    "old symbol",
    "new symbol",
    "ISIN",
    "effective date",
    "short factual explanation"
  ],
  "prohibitions": [
    "Do not use third-party market sites as final authority.",
    "Do not propose database SQL.",
    "Do not state that the application should auto-apply the change."
  ]
}
```

## Brief type B — Source Recovery

Recommended export:

```json
{
  "briefVersion": "OFFICIAL_SOURCE_RECOVERY_V1",
  "task": "Find the current official replacement source.",
  "sourceId": "NSE_CURRENT_EQUITY_MASTER",
  "purpose": "Current NSE symbol / company-name / series / ISIN authority",
  "oldUrl": "https://...",
  "failure": {
    "state": "HTTP_FAILURE",
    "detail": "HTTP 404"
  },
  "lastKnownSuccessIst": "YYYY-MM-DD HH:mm:ss IST",
  "expectedContent": {
    "type": "CSV",
    "requiredColumns": [
      "SYMBOL",
      "NAME OF COMPANY",
      "SERIES",
      "ISIN NUMBER"
    ],
    "minimumReasonableRows": 1000
  },
  "allowedHosts": [
    "nseindia.com",
    "www.nseindia.com",
    "archives.nseindia.com"
  ],
  "requiredReturn": [
    "candidate direct URL",
    "official landing page where candidate was discovered",
    "reason candidate matches the requested source",
    "observed format/schema if known",
    "any session/header requirement observed"
  ],
  "prohibitions": [
    "Do not return GitHub mirrors or third-party datasets as authority.",
    "Do not invent a URL.",
    "Do not instruct the app to auto-promote a candidate."
  ]
}
```

## Human-readable prompt wrapper

The JSON may be accompanied by:

```text
You are assisting with official-source recovery for a financial data application.

Use only the authority classes allowed in the attached brief.
Search for factual evidence.
Do not infer database changes.
Do not treat third-party mirrors as official authority.
Return candidate URLs and supporting facts.
The application will independently validate every candidate before human approval.
```

## External result schema

Preferred provider-neutral response:

```json
{
  "responseVersion": "IDENTITY_EXTERNAL_RESEARCH_RESULT_V1",
  "candidateUrls": [
    {
      "url": "https://...",
      "discoveredFrom": "https://...",
      "authorityClaim": "OFFICIAL_NSE",
      "purposeClaim": "CURRENT_IDENTITY_MASTER",
      "notes": "..."
    }
  ],
  "identityEvidence": [
    {
      "url": "https://...",
      "authorityClaim": "OFFICIAL_NSE",
      "oldSymbol": "OLDABC",
      "newSymbol": "NEWABC",
      "isin": "INE000A01001",
      "effectiveDate": "YYYY-MM-DD",
      "notes": "..."
    }
  ]
}
```

All fields are claims until locally verified.

## Local validation after import

For each candidate:

```text
parse URL
→ host allowlist
→ redirect allowlist
→ fetch safely
→ hash content
→ verify expected authority/source contract
→ verify schema/semantic evidence
→ mark VALIDATED or REJECTED
```

Only validated evidence can enter the deterministic resolver.

## No direct Apply

The external result format intentionally has no authoritative fields for:

```text
apply
approved
execute
sql
databaseMutation
```

If an external result includes them, they are ignored.

## Provider independence

The contract must work with:

- ChatGPT/OpenAI;
- Gemini;
- Claude;
- Copilot;
- another future AI;
- a human analyst.

No provider-specific API is required for the core design.

## Audit

Preserve:

- exported brief hash;
- returned response hash;
- candidate URLs;
- local validation results;
- resolver run ID;
- final operator decision.

This supports later investigation without making AI output part of the database authority chain.
