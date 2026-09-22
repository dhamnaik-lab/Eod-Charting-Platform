# Identity F5-R1 — Runtime Official-Host Enforcement Current Authority

**Status:** CURRENT AUTHORITY / F5 RESOLVED  
**Date:** 2026-09-07 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Scope

This authority closes **ER0-R1-F5 only**:

> Official source URL overrides were previously accepted as non-empty strings, but runtime NSE/BSE source downloads did not enforce the frozen official-host boundary.

F1 remains resolved. F2, F3 and F4 remain unchanged/open/deferred according to the existing ER0-R1 authority.

## TDD authority

RED evidence:

`E:\TA Projects\EOD Charting Platform Source Audit\IDENTITY_F5_R1_RUNTIME_HOST_RED_2026-09-07_155040_IST_evidence.zip`

SHA-256:

`C45B7E30C4A56DF661FBFE41599F78A0C04B813C4CED049781733EC999BD4941`

RED proved the runtime provenance validation API did not exist.

GREEN evidence:

`E:\TA Projects\EOD Charting Platform Source Audit\IDENTITY_F5_R1_RUNTIME_HOST_GREEN_2026-09-07_161602_IST_evidence.zip`

SHA-256:

`8C57D04B587ADCE040BF657FC92AF9D0F84D970FAA742DCD5838CE8049F46278`

Accepted GREEN validation:

- focused provenance contract tests: 5/5 PASS;
- full NSE Identity Rust test module: 31/31 PASS;
- full BSE Identity Rust test module: 5/5 PASS;
- offline `cargo check`: PASS;
- no project database access/change;
- no external network test;
- no source-control command.

The existing unused `apply_nse_current_universe_sync_internal` warning remains unrelated.  
`nse_official_redirect_policy` is unused only in test builds because its NSE consumer is under `#[cfg(not(test))]`; normal `cargo check` uses it and does not emit that warning.

## Current production source authorities

`src-tauri-shell\src\database\official_source_urls.rs`

`2540D12AD94AC71C60196138290C75C757E43A9D602900127F8A9CB43CC33FF7`

`src-tauri-shell\src\database\nse_identity_imports.rs`

`E6DB2DC15C0FC6E9FF5BB4EE6653E5DD72CDD4C1511A58B1919F89C073425DDB`

`src-tauri-shell\src\database\bse_identity_imports.rs`

`518123F411AD39843AF6031C00D00FC90EDC03C4D5708937D21312A9CC5866E9`

## Runtime provenance contract

### NSE exact allowed hosts

- `nseindia.com`
- `www.nseindia.com`
- `nsearchives.nseindia.com`
- `archives.nseindia.com`

### BSE exact allowed hosts

- `bseindia.com`
- `www.bseindia.com`
- `api.bseindia.com`

### Required behavior

```text
configured source URL
→ parse URL
→ require HTTPS
→ require exact exchange-approved host
→ create redirect policy with same host contract
→ validate every redirect target before following
→ validate final response URL before consuming content
```

Unknown, malformed, HTTP, lookalike or unapproved-subdomain sources fail closed with the provenance marker:

`OFFICIAL_SOURCE_PROVENANCE_REJECTED`

Examples rejected:

- `http://www.nseindia.com/...`
- `https://nseindia.com.evil.example/...`
- `https://sub.nseindia.com/...`
- `https://bseindia.com.evil.example/...`
- malformed URLs

## Saved override boundary

F5 does **not** rewrite, delete or redesign saved `officialSourceUrls.v1` overrides.

A previously saved non-approved URL can remain in settings, but runtime download use fails closed before its content can become source evidence.

This intentionally separates:

```text
stored candidate/configuration
from
runtime source authority
```

## Preserved boundaries

No F5 change was made to:

- Identity database schema/data;
- I3 reviewed Preview/Apply authority;
- I4 historical reviewed/atomic Apply authority;
- NSE F1 delisted semantic-selection behavior;
- source URL editing UI;
- saved override storage semantics;
- NSE/BSE parser field contracts;
- source population-sanity checks;
- NSE company-name automatic source coverage;
- BSE historical parity/production acceptance;
- source-control state.

## Relationship to ER0-R1

The original ER0-R1 risk document remains historical evidence and is not rewritten.

For current status:

```text
F1 NSE delisted semantic selection
→ RESOLVED by F1-R1

F2 NSE company-name official history coverage
→ OPEN / DEFERRED

F3 BSE parser tolerance vs intended contract
→ OPEN / DEFERRED

F4 source population sanity
→ OPEN

F5 official-host enforcement
→ RESOLVED by F5-R1
```

The broader ER1 source-health phase is not automatically authorized by this closeout.  
F5-R1 is a standalone provenance gate that future ER1 work may reuse.
