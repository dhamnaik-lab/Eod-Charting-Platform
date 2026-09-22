# Identity ER3-A — NSE Constrained Official-Domain Offline Discovery Design

**Date:** 2026-09-14 IST  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Authority snapshot:** `Eod Charting Platform Source Code 2026-09-14_120113_IST.zip`  
**Authority SHA-256:** `1E7D048C0F251873A0823DEAED9F4567373C9CC41FF95DD0ECF6DFD58CBAEEF8`  
**Status:** APPROVED FOR ER3-A IMPLEMENTATION ONLY

## Objective

Add a deterministic, offline, NSE-only candidate-discovery kernel for Identity official-source recovery. ER3-A may inspect trusted official landing-page content supplied by a caller and produce bounded candidate/rejection diagnostics. It must not fetch the network, mutate configuration, promote a URL, access a database, expose a Tauri/UI API, or alter I3/I4/ER1/ER2 behavior.

## Existing authority reused

ER3-A reuses `validate_nse_official_source_url` from `src-tauri-shell/src/database/official_source_urls.rs` as the sole runtime NSE host/scheme authority. It must not create a second NSE host allowlist.

Supported ER0 NSE source IDs in this slice:

- `NSE_CURRENT_EQUITY_MASTER`
- `NSE_CURRENT_SME_MASTER`
- `NSE_SYMBOL_CHANGE_HISTORY`
- `NSE_COMPANY_NAME_CHANGE_HISTORY`
- `NSE_DELISTED_COMPANIES_WORKBOOK`

BSE is excluded.

## Architecture

Create one private database module:

`src-tauri-shell/src/database/official_source_discovery.rs`

Register it privately from:

`src-tauri-shell/src/database.rs`

The module owns:

- the ER3-A request/result contracts;
- deterministic `href` extraction from trusted HTML text;
- relative URL resolution against the trusted official landing page;
- reuse of the frozen NSE provenance validator;
- source-role semantic scoring;
- candidate/rejection de-duplication and deterministic ordering;
- bounded output.

No new Cargo dependency is permitted.

## Contract

The offline entry point accepts:

- source ID;
- source role/purpose label;
- configured source URL;
- trusted landing-page URL;
- trusted landing-page HTML/text.

The report returns:

- source ID and role;
- configured URL;
- landing-page URL;
- discovered candidates;
- rejected candidate references.

Each accepted candidate records:

- resolved HTTPS URL;
- discovery provenance (`landing-page href`);
- deterministic semantic reason;
- discovery authority exactly `DISCOVERED_NOT_PROMOTED`.

The report contains no field that can express local approval or promotion.

## Candidate rules

A candidate may be accepted only when all of the following hold:

1. its URL resolves from an `href` in the supplied trusted landing-page content;
2. the resolved URL passes the existing `validate_nse_official_source_url` authority;
3. it is semantically compatible with the requested ER0 NSE source contract;
4. it is not the configured URL itself;
5. it survives deterministic de-duplication;
6. it remains within the bounded candidate limit.

Semantic compatibility uses source-specific filename/path/context signals only. It does not claim that the remote bytes satisfy schema, population, freshness, or semantic content validation; those belong to ER3-B.

For `NSE_DELISTED_COMPANIES_WORKBOOK`, the candidate must be an `.xlsx` URL with delisted-company semantics and must not be a proposed-delisting-only link.

## Rejection rules

Reject and diagnose, without throwing for ordinary candidate failures:

- HTTP/non-HTTPS URLs;
- malformed URLs;
- lookalike or unapproved NSE hosts/subdomains;
- BSE/cross-exchange URLs;
- `javascript:`, `data:`, `file:` or other unsupported schemes;
- semantically unrelated official NSE links;
- the already configured URL;
- duplicate candidate URLs.

Malformed request authority is different: an unsupported source ID, an invalid/non-official configured URL, or an invalid/non-official landing-page URL fails the whole request closed with an error.

## Determinism and bounds

- scan at most 256 extracted `href` values;
- return at most 25 accepted candidates;
- return at most 50 rejection diagnostics;
- canonicalize candidates by the resolved `reqwest::Url` string with fragments removed;
- order accepted candidates by semantic score, then URL lexically;
- order rejection diagnostics lexically after de-duplication.

## Non-goals

ER3-A does not:

- perform network requests;
- open or read the application/user database; existing regression tests may use isolated in-memory or temporary SQLite fixtures only;
- validate remote file content/schema/population/freshness;
- persist discovery output;
- change `OfficialSourceUrls` or settings;
- promote or approve any URL;
- expose a Tauri command or frontend API;
- change ER1 health behavior;
- change I3/I4 Preview or Apply behavior;
- change ER2 resolver/shadow behavior;
- integrate BSE;
- repair the deferred NSE symbol-change temp-staging concurrency issue;
- implement ER3-B/ER3-C/ER4 or later phases.

## Preservation requirements

The implementation must preserve exactly:

- I3 reviewed Preview → Apply authority;
- I4 reviewed Preview → atomic Apply authority;
- ER1 source-health semantics;
- ER2-A/B resolver contract and evaluator;
- ER2-C1/C2 private shadow-only behavior;
- existing NSE delisted-workbook discovery behavior;
- current configured URLs and redirect policies;
- database schema/data;
- Tauri command surface;
- frontend behavior;
- BSE behavior.

## Required tests

At minimum prove:

1. official NSE absolute candidate accepted;
2. relative official candidate resolved correctly;
3. duplicate candidate removed deterministically;
4. non-HTTPS candidate rejected;
5. NSE lookalike domain rejected;
6. unapproved NSE subdomain rejected;
7. third-party URL rejected;
8. BSE candidate rejected in NSE discovery;
9. candidate ordering deterministic;
10. accepted candidate authority is `DISCOVERED_NOT_PROMOTED` and cannot express approval;
11. malformed HTML/text does not panic and produces bounded safe output;
12. existing narrow delisted-workbook discovery tests remain green;
13. unsupported source ID fails closed;
14. invalid/non-official configured or landing-page URL fails closed.

## Validation

Use offline/local commands only. No application/user database may be opened; existing regression tests may create isolated test-owned in-memory/temp SQLite fixtures:

- focused ER3-A RED/GREEN tests;
- existing official-source URL provenance tests;
- ER1 tests;
- existing NSE delisted discovery tests;
- I3 reviewed-authority regressions;
- I4 reviewed-authority regressions;
- ER2-A/B tests;
- ER2-C1 tests;
- ER2-C2 tests;
- `cargo check --locked --offline`.

Routine task evidence belongs under:

`E:\TA Projects\EOD Charting Platform\tmp`

The source-snapshot audit directory is not used for ER3-A evidence.
