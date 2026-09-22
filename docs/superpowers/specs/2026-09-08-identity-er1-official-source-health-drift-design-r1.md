# Identity ER1 — Official Source Health & Drift Design R1

**Status:** DESIGN FROZEN / IMPLEMENTATION NOT STARTED  
**Stage:** ER1-A — accelerated P1 + P2 + P3 freeze  
**Project root:** `E:\TA Projects\EOD Charting Platform`  
**Snapshot authority:** `Eod Charting Platform Source Code 2026-09-08_021604_IST`  
**Snapshot SHA-256:** `3B47B02166069F0A58FA8B35E2666AAA567EB91F043F05949FA00F18D98C14BB`  
**ER1-P0 evidence SHA-256:** `53930C8B9EE0E2A699FEB15B4799AF3880C1720B354BED451EF113D64D9BEB7B`

## 1. Objective

ER1 adds one deterministic, read-only **Official Source Health & Drift Assessor** over the already-accepted Identity official-source stack.

ER1 does **not** rebuild the source downloaders, Identity parsers, I3/I4 reviewed Apply paths, Identity matching, or SQLite model.

The architecture is:

```text
existing OfficialSourceUrls
        ↓
NEW read-only in-memory fetch/evidence layer
        ↓
existing HTTPS/host/redirect/final-URL provenance authority
        ↓
existing NSE/BSE parser + semantic contracts
        ↓
existing population/freshness rules where applicable
        ↓
NEW OfficialSourceHealthResult
        ↓
operator-visible health table
        ↓
optional deterministic Recovery Brief appendix
```

## 2. Non-goals

ER1 does not:

- replace or rewrite any configured URL;
- write or replace managed Identity source files;
- mutate SQLite Identity or Corporate Action data;
- call I3/I4 Apply;
- install parser adapters;
- perform automatic source discovery;
- make AI a source of authority;
- redesign NSE/BSE Identity parsing;
- replace the current Refresh & Preview workflow.

Any later source replacement, parser adaptation, or semantic-contract change is a separate reviewed recovery stage.

## 3. Shared result contract

The implementation shall use one cross-source result contract.

### Rust

```rust
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialSourceHealthReport {
    pub assessed_at_utc: String,
    pub results: Vec<OfficialSourceHealthResult>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialSourceHealthResult {
    pub source_id: String,
    pub exchange: String,
    pub role: String,
    pub request_url: String,
    pub final_url: Option<String>,
    pub provenance_status: String,
    pub transport_status: String,
    pub http_status: Option<u16>,
    pub content_bytes: Option<u64>,
    pub content_sha256: Option<String>,
    pub format_status: String,
    pub population_status: String,
    pub population_count: Option<u32>,
    pub freshness_status: String,
    pub drift_class: Option<String>,
    pub reason: String,
}
```

### TypeScript

```ts
export type OfficialSourceCheckStatus =
  | 'PASS'
  | 'FAIL'
  | 'NOT_APPLICABLE'
  | 'NOT_EVALUATED';

export type OfficialSourceDriftClass =
  | 'COMPATIBLE'
  | 'ADAPTER_REQUIRED'
  | 'SEMANTIC_CONTRACT_CHANGE';

export interface OfficialSourceHealthResult {
  sourceId: string;
  exchange: 'NSE' | 'BSE';
  role: string;
  requestUrl: string;
  finalUrl: string | null;
  provenanceStatus: OfficialSourceCheckStatus;
  transportStatus: OfficialSourceCheckStatus;
  httpStatus: number | null;
  contentBytes: number | null;
  contentSha256: string | null;
  formatStatus: OfficialSourceCheckStatus;
  populationStatus: OfficialSourceCheckStatus;
  populationCount: number | null;
  freshnessStatus: OfficialSourceCheckStatus;
  driftClass: OfficialSourceDriftClass | null;
  reason: string;
}

export interface OfficialSourceHealthReport {
  assessedAtUtc: string;
  results: OfficialSourceHealthResult[];
}
```

No separate NSE/BSE result families are allowed unless a later authority proves the common contract insufficient.

## 4. Health semantics

A source check is healthy when every applicable mandatory gate for that source passes.

Status fields are orthogonal:

- `provenanceStatus`: configured/request/final URL authority
- `transportStatus`: request completion + HTTP success
- `formatStatus`: frozen parser/semantic contract
- `populationStatus`: minimum population where defined
- `freshnessStatus`: local saved-source freshness where defined

`NOT_APPLICABLE` is used when a gate does not semantically apply to a source.

`NOT_EVALUATED` is used when an earlier failure prevents the later gate from being evaluated.

## 5. Drift semantics

The frozen drift classes remain:

```text
COMPATIBLE
ADAPTER_REQUIRED
SEMANTIC_CONTRACT_CHANGE
```

Rules:

1. `COMPATIBLE` may be emitted when the frozen source/format semantics pass.
2. Transport/provenance failure never receives a drift class.
3. Parser failure alone does **not** prove `ADAPTER_REQUIRED`.
4. Parser failure alone does **not** prove `SEMANTIC_CONTRACT_CHANGE`.
5. `ADAPTER_REQUIRED` may be emitted only when deterministic evidence proves the provider meaning is unchanged but a known structural adapter is required.
6. `SEMANTIC_CONTRACT_CHANGE` may be emitted only when deterministic evidence proves a required semantic meaning changed or disappeared.
7. When the evidence is insufficient, `driftClass = null` and `reason` explains why classification is not safe.

Initial ER1 implementation therefore prioritizes truth over forced classification.

## 6. Logical source IDs

The assessor returns eleven logical results:

### NSE

1. `NSE_SECURITIES_AVAILABLE_LANDING`
2. `NSE_EQUITY_MASTER`
3. `NSE_SME_MASTER`
4. `NSE_SYMBOL_CHANGE`
5. `NSE_COMPANY_NAME_CHANGE`
6. `NSE_DELISTED_LANDING`
7. `NSE_DELISTED_WORKBOOK`

### BSE

8. `BSE_LIST_SCRIPS_REFERER`
9. `BSE_LIST_SCRIPS_ACTIVE`
10. `BSE_LIST_SCRIPS_DELISTED`
11. `BSE_LIST_SCRIPS_SUSPENDED`

The nine configured URL fields remain unchanged. BSE’s one API prefix produces three logical lifecycle requests.

## 7. Source assessment matrix

| Source ID | Transport / provenance | Frozen format/semantic reuse | Population | Drift on clean pass |
|---|---|---|---|---|
| NSE_SECURITIES_AVAILABLE_LANDING | NSE HTTPS + redirect + final URL | non-empty HTML landing evidence | N/A | `null` |
| NSE_EQUITY_MASTER | NSE provenance; securities landing as referer/session | existing security-master parser + supported-series filter | **>=1000 supported symbols** | `COMPATIBLE` |
| NSE_SME_MASTER | NSE provenance; securities landing as referer/session | existing security-master parser | N/A | `COMPATIBLE` |
| NSE_SYMBOL_CHANGE | NSE provenance | existing symbol-change parser | N/A | `COMPATIBLE` |
| NSE_COMPANY_NAME_CHANGE | NSE provenance | existing I4 name-change parser | N/A | `COMPATIBLE` |
| NSE_DELISTED_LANDING | NSE provenance | semantic discovery of actual-delisted workbook vs proposed/status links | N/A | `COMPATIBLE` when valid actual-delisted semantics are discoverable; otherwise `null` unless deterministic semantic change is proven |
| NSE_DELISTED_WORKBOOK | NSE provenance | existing XLSX symbol-column parser | non-empty symbol set | `COMPATIBLE` |
| BSE_LIST_SCRIPS_REFERER | BSE provenance | non-empty HTML landing evidence | N/A | `null` |
| BSE_LIST_SCRIPS_ACTIVE | BSE provenance | existing five-group BSE source-contract parser | **>=1000 Active symbols** | `COMPATIBLE` |
| BSE_LIST_SCRIPS_DELISTED | BSE provenance | existing five-group BSE source-contract parser | no minimum | `COMPATIBLE` |
| BSE_LIST_SCRIPS_SUSPENDED | BSE provenance | existing five-group BSE source-contract parser | no minimum | `COMPATIBLE` |

BSE Delisted/Suspended must never compensate for an Active count below 1000.

## 8. Freshness treatment

The existing 14-day NSE current-master rule governs **saved-source reuse**, not the freshness of a newly fetched network response.

Therefore:

- live network result: `freshnessStatus = NOT_APPLICABLE`;
- UI may separately surface the existing saved-master freshness failure when the operator chooses Preview Saved Sources;
- ER1 does not invent a timestamp freshness rule for BSE or for live responses.

This preserves current semantics instead of conflating source availability with local cache age.

## 9. Backend architecture

Create one new module:

`src-tauri-shell/src/database/official_source_health.rs`

Responsibilities:

1. load the current `OfficialSourceUrls` using the existing active-database settings read;
2. perform network requests **in memory only**;
3. use existing `validate_nse_official_source_url`, `validate_bse_official_source_url`, and redirect policies;
4. capture request URL, final URL, HTTP status, response bytes, and SHA-256;
5. pass bytes to existing source-specific parser/validator functions;
6. return one `OfficialSourceHealthReport`;
7. perform no managed-file write and no Identity Apply.

### Command

```rust
#[tauri::command]
pub async fn assess_identity_official_source_health(
    app: AppHandle,
) -> AppResult<OfficialSourceHealthReport>
```

This command may read the active database only to resolve `officialSourceUrls.v1`. It may not mutate SQLite.

### Existing source modules

Minimal visibility changes are permitted only where required to reuse pure validators/parsers. Do not fork or duplicate parser logic.

Expected reuse points include:

NSE:
- `validate_nse_current_population_sanity`
- `load_security_master_rows_from_bytes`
- `load_symbol_change_rows_from_bytes`
- `validate_nse_company_name_change_download`
- `discover_nse_delisted_workbook_url`
- `parse_nse_delisted_workbook`

BSE:
- `load_bse_master_rows_from_bytes`
- `validate_bse_current_population_sanity`
- existing BSE source-contract validation through the parser

Official provenance:
- `validate_nse_official_source_url`
- `validate_bse_official_source_url`
- `nse_official_redirect_policy`
- `bse_official_redirect_policy`

Current download/apply functions remain authoritative and are not replaced by ER1.

## 10. Frontend seam

Add one desktop API method:

```ts
assessIdentityOfficialSourceHealth(): Promise<OfficialSourceHealthReport>
```

Wire it through:

- `src/types/desktop.ts`
- `src/platform/types.ts`
- `src/platform/tauriDesktop.ts`

No separate frontend networking.

## 11. Operator UI

In Official Identity mode, add one clearly read-only action near the existing source controls:

```text
Check Source Health
```

The action:

- performs the ER1 read-only assessment;
- does not invoke Refresh & Preview;
- does not write managed source files;
- displays the eleven logical results in a compact table;
- shows source, health gates, drift class, bytes/hash, and reason;
- keeps existing Preview/Apply controls unchanged.

A health failure never disables Manual fallback and never grants Apply authority.

## 12. Recovery Brief integration

Existing Recovery & AI Handoff documents remain provider-neutral static resources.

When the latest ER1 health report exists in renderer state:

- `Export Source Recovery Brief` appends a deterministic `## Latest ER1 Source Health Evidence` section;
- the appendix is generated from `OfficialSourceHealthReport`;
- no database or network call occurs during export;
- the Identity Investigation Brief and Recovery Guide remain unchanged;
- no AI provider/API is added.

Suggested focused helper:

`src/features/identityRecovery/officialSourceHealthExport.ts`

```ts
export function formatOfficialSourceHealthMarkdown(
  report: OfficialSourceHealthReport,
): string
```

## 13. Fail-closed invariants

The following are immutable ER1 invariants:

```text
health check != download
health check != managed-file write
health check != Preview
health check != Apply
health check != URL rewrite
health check != adapter installation
health check != AI authority
```

## 14. Validation architecture

Offline implementation validation:

- pure fixture tests for every logical source family;
- provenance regression;
- F1/F2/F3/F4/F5 regressions;
- full NSE Identity tests;
- full BSE Identity tests;
- frontend focused health/recovery tests;
- renderer typecheck;
- `cargo check --offline`.

Real-network validation is a separate ER1-F gate and must remain read-only.

## 15. Accelerated stages

```text
ER1-A  COMPLETE DESIGN FREEZE              ← this document
ER1-B  ONE TDD RED
ER1-C  BACKEND ASSESSOR + NSE + BSE
ER1-D  UI + RECOVERY BRIEF EVIDENCE
ER1-E  FULL OFFLINE VALIDATION
ER1-F  CONTROLLED REAL-NETWORK READ-ONLY VERIFICATION
ER1-G  CURRENT-AUTHORITY CLOSEOUT
```

This acceleration removes redundant review rounds, not substantive safeguards.
