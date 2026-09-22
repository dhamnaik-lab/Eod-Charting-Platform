# Identity ER3-A Current Authority After GREEN

**Status:** CURRENT IDENTITY AUTHORITY / ER3-A CLOSED / GREEN / ER3-B NOT AUTHORIZED  
**Date:** 2026-09-14 IST  
**Workstream:** EOD Charting Platform  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Purpose

Freeze the accepted Identity ER3-A authority after independent review of the completed offline RED → GREEN implementation and preservation evidence.

ER3-A adds a private, deterministic, NSE-only official-domain candidate-discovery kernel. It does not fetch the network, access the application/user database, expose a Tauri/UI API, persist discovery output, promote a URL, alter configured source URLs, or change I3/I4/ER1/ER2 authority.

This record is documentation authority only. It changes no runtime source, database, schema, UI, Tauri/API contract, Apply path, network behavior, dependency state, or source-control state.

## Parent self-contained source authority

`Eod Charting Platform Source Code 2026-09-14_120113_IST.zip`

SHA-256:

`1E7D048C0F251873A0823DEAED9F4567373C9CC41FF95DD0ECF6DFD58CBAEEF8`

Parent protected source files:

`541`

The parent snapshot remains the last self-contained source ZIP until a fresh Snapshot V3 is generated from the real project after this documentation closeout.

## Accepted ER3-A implementation evidence

Implementation evidence ZIP:

`E:\TA Projects\EOD Charting Platform\tmp\IDENTITY_ER3A_2026-09-14_161922_IST_evidence.zip`

SHA-256:

`BE9F178F074850D56729172EF23D9DCEA0EDA1F390C0B803B52FAEE849161206`

Implementation package SHA-256:

`ED326022CBF2B41C3D92E0F75E7CE49D9D23E01C4A1C82818C4F62B67D175347`

Execution timestamp recorded by the accepted evidence:

`2026-09-14T16:19:22+05:30`

Accepted post-implementation protected source:

`542` exact files

No replacement aggregate protected-source digest is asserted here. The accepted 542-entry path/byte-length/SHA-256 manifest is the current live-source evidence until the next self-contained Snapshot V3 is created and independently accepted.

## Installed ER3-A source authority

Created:

- `src-tauri-shell\src\database\official_source_discovery.rs`  
  SHA-256 `590FCCBC807B0CEBAC791524F5ED24383E52C55BF437887E11A271E53C0AE452`

Modified:

- `src-tauri-shell\src\database.rs`  
  SHA-256 `87B0C27676C8FEC0409648A451F63E5AA657F92A3DB516CEDAF566C184F01E41`

The `database.rs` production delta is the private module registration:

```rust
mod official_source_discovery;
```

Accepted implementation documents:

- `docs\superpowers\specs\2026-09-14-identity-er3a-nse-official-domain-offline-discovery-design.md`  
  SHA-256 `1FA8545ED2E6D670DA2927494C5C52E77C80678344D6C70949CA5B54B14A592F`
- `docs\superpowers\plans\2026-09-14-identity-er3a-nse-official-domain-offline-discovery-plan.md`  
  SHA-256 `52D1CE0C85540D651932C5F25D9AFB76A74241B35A91672D9EDF71989B61B8D5`
- `docs\changes\2026-09-14_1619_IST_IDENTITY_ER3A_NSE_OFFICIAL_DOMAIN_OFFLINE_DISCOVERY.md`  
  SHA-256 `808103653316C4A2D73002D7E5E5468E086B806B374D6324EAED15B6D000E66A`

## ER3-A accepted capability

ER3-A may, from caller-supplied trusted official NSE landing-page content:

1. validate the requested frozen NSE Identity source contract;
2. validate configured and landing-page NSE provenance through the existing `validate_nse_official_source_url` authority;
3. extract bounded `href` candidates;
4. resolve relative URLs against the trusted landing page;
5. reject non-HTTPS, malformed, lookalike, unapproved-subdomain, third-party, BSE/cross-exchange, unchanged, duplicate, and source-role-incompatible candidates;
6. de-duplicate and order accepted candidates deterministically;
7. return bounded candidate/rejection diagnostics;
8. mark every accepted candidate exactly `DISCOVERED_NOT_PROMOTED`.

Supported ER3-A NSE source IDs remain exactly:

- `NSE_CURRENT_EQUITY_MASTER`
- `NSE_CURRENT_SME_MASTER`
- `NSE_SYMBOL_CHANGE_HISTORY`
- `NSE_COMPANY_NAME_CHANGE_HISTORY`
- `NSE_DELISTED_COMPANIES_WORKBOOK`

BSE is excluded.

## Validation authority

The accepted FIX2 run proved:

- Windows PowerShell parser preflight: PASS;
- genuine sandbox RED: expected missing ER3-A contract/function compile failure, exit `101`;
- ER3-A focused GREEN: `18 passed / 0 failed`;
- official-source provenance: `5 passed / 0 failed`;
- ER1: `9 passed / 0 failed`;
- existing NSE delisted discovery: `6 passed / 0 failed` across two focused runs;
- I3: `5 passed / 0 failed`;
- I4: `9 passed / 0 failed`;
- ER2-A: `22 passed / 0 failed`;
- ER2-B: `45 passed / 0 failed`;
- ER2-C1: `19 passed / 0 failed`;
- ER2-C2: `25 passed / 0 failed`;
- total focused/preservation tests: `163 passed / 0 failed`;
- `cargo check --locked --offline`: PASS;
- installed protected-source postflight: `542/542 exact`;
- network: not used; Cargo forced offline;
- application/user database: not opened by the runner; existing tests used only test-owned fixtures where applicable;
- source control: not used.

The non-test binary emitted dead-code/unused warnings because ER3-A intentionally creates a private kernel before any ER3-B runtime acquisition path exists. Those warnings are accepted as part of the current bounded state and are not authorization for unrelated cleanup.

## Current Identity state

```text
I3     CLOSED / ACTIVE reviewed Preview → Apply authority
I4     CLOSED / ACTIVE reviewed Preview → atomic Apply authority
ER0    RESOLVED / CLOSED
ER1    CLOSED / CURRENT
ER2-A  CLOSED
ER2-B  CLOSED / GREEN
ER2-C1 CLOSED / GREEN / SHADOW-ONLY
ER2-C2 CLOSED / GREEN / SHADOW-ONLY
ER2-C3 OMITTED / NOT IMPLEMENTED / NOT REQUIRED
ER2-C4 NOT AUTHORIZED
ER2    CLOSED / CURRENT
ER3-A  CLOSED / GREEN
ER3-B  NOT AUTHORIZED
ER3-C  NOT AUTHORIZED
ER4+   NOT AUTHORIZED
```

## Exact preservation requirements

Preserve unchanged:

- I3 reviewed Preview → Apply mutation authority;
- I4 reviewed Preview → atomic Apply authority and rollback/stale-SHA guarantees;
- ER1 Official Source Health & Drift semantics;
- ER2-A/B resolver contract/evaluator;
- ER2-C1/C2 private shadow-only behavior;
- current configured NSE URLs and redirect policy;
- existing narrow NSE delisted-workbook discovery behavior;
- application/user database schema/data;
- Tauri public command/API surface;
- frontend behavior;
- BSE behavior;
- the deferred NSE symbol-change temp-staging concurrency issue.

ER3-A has no source-promotion or Apply authority.

## Separately gated future work

This authority does **not** authorize:

- ER3-B live/controlled official-network acquisition;
- remote candidate file/content/schema/population/freshness validation;
- ER3-C operator-visible workflow;
- URL approval or promotion;
- persistence/version history;
- ER4+;
- BSE discovery/integration/parity;
- resolver operational gating;
- repair of the deferred NSE temp-staging concurrency issue;
- database/schema/data changes.

## Next authority step

After this documentation closeout is installed and independently verified, run the existing accepted local snapshot script separately:

`E:\TA Projects\EOD Charting Platform\scripts\Create-EOD-Source-Code-Snapshot-v3.ps1`

Only the fresh locally generated and independently accepted Snapshot V3 becomes the next self-contained source authority.

After that snapshot is accepted, the next Identity task may be an **ER3-B necessity/design review — read-only first**. ER3-B implementation is not automatically authorized.
