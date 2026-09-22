# Identity Investigation Brief — Give This to Any AI

**Purpose:** Find official evidence needed to resolve symbol / ISIN / company-name continuity when the application's deterministic Identity rules cannot safely decide.

## Rules for the researcher / AI

- Use official NSE/BSE, regulator, depository, or relevant issuer exchange-filing evidence.
- Do not treat symbol-name similarity as proof that two securities are the same Identity.
- Do not treat a matching symbol as proof when ISIN/effective-date evidence conflicts.
- Do not use third-party market sites as final authority.
- Do not propose database SQL.
- Return candidate evidence only. Do not instruct the application to Apply a change.

## Investigation context

Exchange: `[NSE / BSE]`

Local symbol: `[value]`

Local ISIN: `[value]`

Local company name: `[value]`

Current official symbol: `[value]`

Current official ISIN: `[value]`

Current official company name: `[value]`

Known historical chain: `[paste known symbol/name changes and effective dates]`

Resolver status / reason: `[CONFLICT / INSUFFICIENT_EVIDENCE / other]`

## Questions to answer

Use only questions relevant to the mismatch:

- Was the old symbol officially changed to the new symbol?
- What was the effective date?
- Was the ISIN continuous across the change?
- Was there an official company-name change?
- If the ISIN changed, what official corporate/listing event proves continuity?
- Is one of the symbols inactive/delisted rather than renamed?
- Could the same symbol have been reused for another security?

## Evidence requested

Return, where available:

1. Official evidence URL.
2. Official landing/index page where it was discovered.
3. Old symbol.
4. New/current symbol.
5. ISIN(s).
6. Old company name.
7. New/current company name.
8. Effective date.
9. Short factual explanation of what the official evidence establishes.

## Required response format

```text
Official evidence URL:
Official landing page:
Authority:
Old symbol:
New/current symbol:
ISIN:
Old company name:
New/current company name:
Effective date:
Evidence summary:
Unresolved questions:
```

Do not state that the Identity change is approved. The application/user will independently validate the evidence and use the existing reviewed Preview → Apply workflow if a change is accepted.
