# Identity ER3-B Current Authority After GREEN

**Status:** CURRENT IDENTITY AUTHORITY / ER3-B CLOSED / GREEN / ER3-C NOT AUTHORIZED  
**Date:** 2026-09-15 IST  
**Workstream:** EOD Charting Platform  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Purpose

Freeze the independently accepted Identity ER3-B authority after the complete B1/B2/B3 validation chain succeeded on the real Windows project.

ER3-B adds a private, read-only, NSE-only candidate acquisition and source-contract validation layer after ER3-A discovery. It can fetch bounded official NSE landing/candidate responses and classify candidate evidence, but it has **no URL approval/promotion authority**, no persistence, no UI/Tauri public surface, and no database/settings/archive write authority.

## Parent self-contained source authority

`Eod Charting Platform Source Code 2026-09-14_192551_IST.zip`

SHA-256:

`85E7CCED0A71B8E3C4C757E1BE018E65A993446AB51DEA2DECBDB250421B9C62`

Parent protected source files:

`542`

The parent snapshot remains the last self-contained source ZIP until a fresh Snapshot V3 is created after this documentation closeout.

## Accepted ER3-B implementation evidence

Evidence ZIP:

`E:\TA Projects\EOD Charting Platform\tmp\IDENTITY_ER3B_2026-09-14_234751_IST_evidence.zip`

SHA-256:

`7E6743C1426AF532EC12E978FA106EB0560C1FD6C9A4E5CAD9DA3CAD2FAC198C`

Implementation package SHA-256:

`BF9C5061A059611FF4BCAC62802BBF0E7B6A1EE06D0F93D908CB86FB044E9094`

Accepted execution timestamp:

`2026-09-14T23:47:51+05:30`

Accepted post-implementation protected source:

`543/543 exact`

## Installed ER3-B source authority

Created:

- `src-tauri-shell\src\database\official_source_candidate_validation.rs`  
  SHA-256 `2A34988688B572F6EF3B9BF1195D65C4458AD4480378599B67E9294CCB49B784`

Modified:

- `src-tauri-shell\src\database.rs`  
  SHA-256 `4A10FC439D54EF7CF457B6C6725329F6B055FE12CB5D0FFF7458D015A497F45D`
- `src-tauri-shell\src\database\official_source_discovery.rs`  
  SHA-256 `016B66BFF6242989ADE648CCB34DE8A3C932B93D020A0BB40F9DB311C3B078A9`

Accepted design/plan:

- `docs\superpowers\specs\2026-09-14-identity-er3b-nse-controlled-candidate-acquisition-validation-design-r1.md`  
  SHA-256 `AB7672F95632942E1AF4AAA026AA8CD8CCA96A45CAC2543A845AE419491E6BB1`
- `docs\superpowers\plans\2026-09-14-identity-er3b-nse-controlled-candidate-acquisition-validation-plan-r1.md`  
  SHA-256 `5054561E4C367973D6898B956ED48EDB43505D0654207EB5C475A16D61997816`

Corrected implementation change record:

- `docs\changes\2026-09-14_2347_IST_IDENTITY_ER3B_NSE_CONTROLLED_CANDIDATE_ACQUISITION_VALIDATION.md`  
  SHA-256 `9707AE07721F9324024E2582771A11195FE61011C5620981843195E20DDD1568`

The correction changes evidence filenames only; it does not alter any implementation or validation claim.

## Accepted behavior

ER3-B may:

1. map only the frozen eligible NSE ER1 source IDs to ER3 source contracts;
2. reject healthy/unsupported/BSE recovery triggers fail-closed;
3. reuse ER3-A deterministic discovery;
4. perform GET-only bounded NSE acquisition through the existing official-host provenance and redirect authority;
5. enforce a 45-second timeout, 4 MiB landing limit, 32 MiB per-candidate limit, 64 MiB total candidate budget, and at most five deterministic candidates;
6. enforce both declared `Content-Length` and streamed body limits;
7. reuse the frozen NSE equity/SME/symbol-change/name-change/delisted parsers and population rules;
8. capture final URL, HTTP status, normalized content type, byte count, SHA-256, parser/schema/population/freshness state, and validation reason;
9. return only these classifications:
   - `VALIDATED_CANDIDATE_NOT_PROMOTED`
   - `INDETERMINATE_CANDIDATE`
   - `REJECTED_CANDIDATE`

ER3-B may not approve, promote, configure, persist, apply, or expose candidate state to the operator.

## Validation authority

The accepted FIX2 run proved:

- Windows PowerShell parser preflight: PASS;
- combined B1/B2 RED: expected missing-contract compile failure, exit `101`;
- B1 GREEN: `7 passed / 0 failed`;
- B2 GREEN: `5 passed / 0 failed`;
- ER3-A regression: `18 passed / 0 failed`;
- official-source provenance: `5 passed / 0 failed`;
- ER1 filter: `10 passed / 0 failed`;
- NSE delisted discovery/fallback: `6 passed / 0 failed` across two focused runs;
- I3: `5 passed / 0 failed`;
- I4: `9 passed / 0 failed`;
- ER2-A: `22 passed / 0 failed`;
- ER2-B: `45 passed / 0 failed`;
- ER2-C1: `19 passed / 0 failed`;
- ER2-C2: `25 passed / 0 failed`;
- total offline passing focused/regression executions: `176`;
- `cargo check --locked --offline`: PASS;
- B3 authorization RED: expected fail-closed authorization failure, exit `101`;
- B3 online GREEN: `1 passed / 0 failed`;
- protected source POST: `543/543 exact`;
- no application/user DB, source-control, UI, persistence, managed archive write, or URL promotion.

## Accepted B3 live NSE evidence

```text
landingStatus    = 200
landingBytes     = 1611746
landingFinalUrl  = https://www.nseindia.com/static/market-data/securities-available-for-trading
candidateStatus  = 200
candidateBytes   = 181324
candidateFinalUrl= https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv
candidateSha256  = CBA7CBAA0B2320D1D3FDA70F3339F05D457AE71276658EE9EAE5E9A1F39DC851
populationCount  = 2568
classification   = VALIDATED_CANDIDATE_NOT_PROMOTED
```

This proves bounded official NSE acquisition and source-contract validation at that execution time. It does not confer promotion authority and does not imply NSE has moved the configured source.

## Current Identity state

```text
I3     CLOSED / ACTIVE
I4     CLOSED / ACTIVE
ER0    RESOLVED / CLOSED
ER1    CLOSED / CURRENT
ER2-A  CLOSED
ER2-B  CLOSED / GREEN
ER2-C1 CLOSED / GREEN / SHADOW-ONLY
ER2-C2 CLOSED / GREEN / SHADOW-ONLY
ER2-C3 OMITTED / NOT REQUIRED
ER2-C4 NOT AUTHORIZED
ER2    CLOSED / CURRENT
ER3-A  CLOSED / GREEN
ER3-B  CLOSED / GREEN
ER3-C  NOT AUTHORIZED
ER4+   NOT AUTHORIZED
```

## Exact preservation requirements

Preserve unchanged:

- I3 reviewed Preview → Apply mutation authority;
- I4 reviewed Preview → atomic Apply authority and rollback/stale-SHA guarantees;
- ER1 source-health report/UI semantics and freshness semantics;
- ER2 resolver/shadow semantics;
- ER3-A discovery ordering and `DISCOVERED_NOT_PROMOTED` semantics;
- configured source URLs and redirect policy;
- existing NSE download commands and managed archive behavior;
- DB/schema/data;
- public Tauri/frontend surfaces;
- BSE behavior;
- deferred NSE symbol-change temp-staging concurrency issue.

## Separately gated future work

This authority does **not** authorize:

- ER3-C operator-visible workflow;
- candidate approval or URL promotion;
- persistence/version history;
- ER4+;
- BSE discovery/integration/parity;
- resolver operational gating;
- deferred concurrency repair.

## Next authority step

After this documentation closeout is installed and independently verified, run the accepted local Snapshot V3 script separately to create a fresh self-contained source authority containing the 543 protected source files and ER3-B closeout documents.

Only after that snapshot is accepted may an **ER3-C necessity/design review — read only first** begin. ER3-C implementation is not automatically authorized.
