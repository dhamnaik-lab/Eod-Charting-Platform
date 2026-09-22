# Official Source Recovery Brief — Give This to Any AI

**Purpose:** Find the current official replacement source URL when an NSE/BSE source used by the application stops working or changes format.

## Rules for the researcher / AI

- Use official exchange, regulator, depository, or issuer sources only when relevant to the requested source.
- Do not use GitHub mirrors, blogs, third-party market sites, cached datasets, or unofficial aggregators as final authority.
- Do not invent a URL.
- Return candidate evidence only. Do not claim a candidate is approved.
- Do not propose database SQL or direct database changes.
- Do not instruct the application to auto-apply or auto-promote a candidate source.

## Source to recover

Exchange: `[NSE / BSE]`

Source ID / purpose: `[example: NSE_CURRENT_EQUITY_MASTER]`

Current / old URL: `[paste current URL]`

Observed failure: `[404 / timeout / redirect / schema changed / wrong content / access pattern changed]`

Last known working date/time: `[if known]`

## Expected source contract

Expected content type: `[CSV / XLSX / JSON / HTML-linked download]`

Required columns / fields:

- `[field 1]`
- `[field 2]`
- `[field 3]`

Expected approximate row count: `[if known]`

Expected freshness: `[current / daily / historical]`

## Allowed official domains

Use only official domains relevant to the source. Typical examples include:

- `nseindia.com`
- `www.nseindia.com`
- `nsearchives.nseindia.com`
- `archives.nseindia.com`
- `bseindia.com`
- `www.bseindia.com`
- `api.bseindia.com`
- official SEBI / depository / issuer domains when the requested authority requires them

A redirect to an unapproved third-party host is not an acceptable replacement.

## Task

Find the current official replacement source URL and return:

1. Candidate direct URL.
2. Official landing page where the candidate was discovered.
3. Why the candidate matches the requested source purpose.
4. Observed file/content format.
5. Observed schema or column names, when available.
6. Any required headers, cookies, session bootstrap, referer, or access pattern you observed.
7. Whether the old URL redirects to the candidate.
8. Evidence that the source is official and current.

## Required response format

```text
Candidate URL:
Official landing page:
Authority:
Purpose match:
Format:
Schema / columns:
Access requirements:
Redirect behavior:
Evidence:
Notes:
```

Do not say `approved`, `safe to apply`, or `ready for database update`. The user/application will independently validate the candidate before any source configuration or Identity change.
