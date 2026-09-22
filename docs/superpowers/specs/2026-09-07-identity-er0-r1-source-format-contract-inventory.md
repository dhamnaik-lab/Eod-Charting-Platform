# Identity ER0-R1 — Official Source + Format Contract Inventory

**Status:** ER0-R1 DOCUMENTATION FREEZE CANDIDATE  
**Date:** 2026-09-07 IST  
**Project:** `E:\TA Projects\EOD Charting Platform`  
**Scope:** NSE/BSE Identity only  
**Behavioral change authorized:** NONE

## Authority basis

This inventory is derived from the exact current post-I4/post-Recovery source captured by:

`IDENTITY_ER0_R1_P0_SOURCE_FORMAT_CONTEXT_2026-09-07_130052_IST_evidence.zip`

SHA-256:

`8AC4C6D4CB7F0D0DDA076D79F26B5E3245537BCBDE19C5F21CEF47797562B651`

Current source hashes:

- `src-tauri-shell\src\database\official_source_urls.rs` — `931CF737CDB7D3C2275BFBFE5E8E101E3C1BB9FFEA522719E00BBBE39311332A`
- `src-tauri-shell\src\database\nse_identity_imports.rs` — `2E05EF2050179305223A95F10CD0B3B2DE894F9615A78991E2D93F6ADD7542AB`
- `src-tauri-shell\src\database\bse_identity_imports.rs` — `F7F5F8F753785E530EABA22126B84385E7395E24A1B4296751879F73CF0CEC1E`
- `src-tauri-shell\src\database.rs` — `C4CDD04147A5891D8D10A083E06B428F83AC44565477B21666BC4FFAED21E47D`
- `src\components\DatabaseToolsDialogs.tsx` — `F3886CE568B2726CDA93472B995A8643287C2B32FBC8422015093F7C1BFC681A`

## Core ER0 distinction

For every source ER0 freezes three separate things:

```text
PROVIDER-NATIVE FORMAT
        ↓
CURRENT APP PARSER ACCEPTANCE
        ↓
INTENDED SOURCE CONTRACT
```

Current parser tolerance is not automatically accepted as the desired future contract.

---

# NSE

## NSE-01 — Securities Available landing/referer page

**Purpose:** Official landing page and referer/bootstrap for NSE current Identity master downloads.

**Current configured URL**

`https://www.nseindia.com/static/market-data/securities-available-for-trading`

**Allowed official hosts for this contract**

- `www.nseindia.com`
- `nseindia.com`
- `nsearchives.nseindia.com`
- `archives.nseindia.com`

**Current app transport**

- GET landing page;
- browser-like User-Agent;
- cookies enabled for NSE master downloader;
- 45-second client timeout;
- landing request failure is ignored by the current master downloader before the direct CSV GET.

**Provider function**

The official page exposes links for Equity securities, SME securities, Changes in Company Names and Changes in Symbols.

**Intended contract**

The landing page is provenance/bootstrap evidence. It is not itself an Identity row source.

---

## NSE-02 — Current Equity Master

**Source ID:** `NSE_CURRENT_EQUITY_MASTER`

**Purpose:** Current NSE security master and primary current-universe Identity source.

**Current configured URL**

`https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv`

**Provider-native format observed**

CSV with current header:

```text
SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE
```

**Current app accepted format**

Container/delimiter:

- plain comma-delimited CSV;
- standard CSV quoting;
- variable record width accepted (`flexible(true)`);
- leading/trailing whitespace trimmed.

Header behavior:

- header order is not significant;
- header case/punctuation/space differences are normalized by removing non-alphanumeric characters and lowercasing;
- extra columns are ignored.

Fields consumed:

| Canonical field | Current parser header |
| --- | --- |
| symbol | `symbol` |
| company name | `nameofcompany` |
| series | `series` |
| ISIN | `isinnumber` |

Current requiredness:

- `symbol` is required for every retained row;
- `series` is effectively required when a series filter is active because rows without series are skipped;
- company name is optional;
- ISIN is optional;
- listing date, paid-up value, market lot and face value are ignored by Identity.

Current series acceptance for current-universe sync:

`EQ`, `BE`, `BZ`, `SM`, `ST`, `SZ`

Historical I4 master planning uses only `EQ` from the equity master.

Current fetch validation:

- HTTP status must succeed;
- response is rejected if its trimmed first characters look like HTML (`<`);
- downloaded Equity master must contain at least one retained supported current row;
- the app does not verify HTTP Content-Type;
- the app does not currently enforce a strong minimum row count, ISIN presence ratio, duplicate-identity ratio or official-host redirect boundary.

Freshness:

- saved current master file must be no older than 14 days before Preview/Apply.

**Intended ER0 contract**

- provider meaning must remain one row representing an NSE listed/tradable security entry;
- `SYMBOL` and `SERIES` are mandatory;
- `NAME OF COMPANY` and `ISIN NUMBER` should be present for normal equity rows and material collapse in either field requires review;
- extra presentation columns may be added without breaking the contract;
- current-universe row population must remain plausibly exchange-scale; ER0 advisory minimum for the main/current NSE population is 1,000 retained rows;
- a large abrupt row-count collapse is `SEMANTIC_CONTRACT_CHANGE` until reviewed.

---

## NSE-03 — Current SME Master

**Source ID:** `NSE_CURRENT_SME_MASTER`

**Purpose:** Adds current NSE SME securities to the current-universe master.

**Current configured URL**

`https://nsearchives.nseindia.com/emerge/corporates/content/SME_EQUITY_L.csv`

**Provider-native format observed**

CSV with current header:

```text
SYMBOL,NAME_OF_COMPANY,SERIES,DATE_OF_LISTING,PAID_UP_VALUE,ISIN_NUMBER,FACE_VALUE,
```

The trailing empty column is tolerated by the current CSV reader.

**Current app accepted format**

Same master parser as NSE Equity.

The normalized headers `NAME_OF_COMPANY` and `ISIN_NUMBER` map to the same canonical parser keys as the spaced Equity headers.

The SME file itself is optional in local current-universe resolution. If present, its retained rows are merged by symbol after the Equity rows; the first symbol already present wins.

**Intended ER0 contract**

- plain CSV with `SYMBOL` and `SERIES`;
- expected SME series are within the current supported series set;
- if the provider source is fetched successfully, zero retained SME rows should be treated as suspicious rather than silently accepted;
- duplicate symbol collision with Equity requires deterministic review rather than provider-order guessing in future health logic.

---

## NSE-04 — Symbol Change History

**Source ID:** `NSE_SYMBOL_CHANGE_HISTORY`

**Purpose:** Historical symbol continuity evidence and Identity history.

**Current configured URL**

`https://nsearchives.nseindia.com/content/equities/symbolchange.csv`

**Provider-native format observed**

Headerless four-column CSV:

```text
company name,old symbol,new symbol,effective date
```

Current observed date form is `DD-MMM-YYYY`, for example `23-JAN-2023`.

**Current app accepted format**

Primary provider form:

- headerless;
- field 0 = optional company name;
- field 1 = old symbol;
- field 2 = new symbol;
- field 3 = effective date.

The parser also has a secondary headered mode, but it recognizes it only when header cells normalize to the literal concepts `old`, `new`, and `date`; `company` is optional. Therefore a future header such as `OLD SYMBOL,NEW SYMBOL` is **not** automatically guaranteed compatible by the present header detector.

Accepted Identity dates:

- `YYYY-MM-DD`
- `DD-MMM-YYYY`
- `DD-MMMM-YYYY`
- `DD/MM/YYYY`

Dates are normalized to `YYYY-MM-DD`.

Required semantic fields:

- old symbol;
- new symbol;
- effective date.

**Intended ER0 contract**

The directional meaning `old → new` and the effective-date meaning are semantic authority. Reversing column direction, changing row grain or replacing the effective date with another event date is a `SEMANTIC_CONTRACT_CHANGE`.

---

## NSE-05 — Company Name Change History

**Source ID:** `NSE_COMPANY_NAME_CHANGE_HISTORY`

**Purpose:** Historical company-name continuity evidence for I4 Manual historical Identity.

**Current app status**

A parser/consumer exists, but there is **no current official-source URL slot or automatic downloader** for this file.

Manual I4 expects:

`NSE\Identity\CompanyNameChanges\nse_identity_company_name_changes.csv`

The current NSE official Securities Available page does expose **Changes in Company Names (.csv)** at:

`https://nsearchives.nseindia.com/content/equities/namechange.csv`

That provider counterpart is official evidence, but it is not currently wired into `OfficialSourceUrls` or `Refresh & Preview`.

**Provider-native format observed**

Headered CSV:

```text
NCH_SYMBOL,NCH_PREV_NAME,NCH_NEW_NAME,NCH_DT
```

Presentation may contain spaces after delimiters; the parser trims them.

**Current app accepted format**

Required normalized headers:

- `nchsymbol`
- `nchprevname`
- `nchnewname`
- `nchdt`

Header order is irrelevant; extra columns are ignored.

All four semantic fields are required per row.

Date formats are the same four forms accepted for symbol changes.

**Intended ER0 contract**

- symbol;
- previous name;
- new name;
- effective date;
- directional previous-name → new-name meaning must remain unchanged.

A provider header rename outside the existing NCH normalized names is `ADAPTER_REQUIRED` unless explicitly promoted as an accepted alias.

---

## NSE-06 — Delisting landing page

**Source ID:** `NSE_DELISTED_LANDING_PAGE`

**Purpose:** Discover the current official NSE delisting workbook.

**Current configured URL**

`https://www.nseindia.com/static/list/list-of-companies-proposed-to-be-delisted`

**Current app behavior**

The downloader:

1. GETs the page;
2. percent-decodes the HTML;
3. searches for the first HTTPS URL ending in `.xlsx`;
4. falls back to the configured workbook URL if no `.xlsx` is found.

The current code does **not** bind the discovered workbook to an anchor caption such as `List of Companies Delisted from NSE`.

This creates the ER0-R1 risk recorded in the companion risk document.

---

## NSE-07 — Delisted Companies Workbook

**Source ID:** `NSE_DELISTED_COMPANIES_WORKBOOK`

**Purpose:** Classify absent NSE current-universe symbols as `DELISTED` rather than generic unknown inactive.

**Current fallback URL**

`https://nsearchives.nseindia.com/web/sites/default/files/inline-files/List%20of%20delisted%20Companies.xlsx`

**Current provider evidence**

The current NSE delisting landing page separately exposes:

- `List of Companies Proposed to be Delisted (.xlsx)`;
- `List of Companies Delisted from NSE (.xlsx)`.

The direct current delisted workbook behind the NSE page may be a dated `nsearchives.nseindia.com/web/mediaattachment/...xlsx` resource rather than the static fallback path.

**Current app accepted XLSX structure**

- file must be a ZIP-compatible XLSX;
- parser reads `xl/worksheets/sheet1.xml`;
- `xl/sharedStrings.xml` is optional;
- within the first 20 logical rows it searches for a column whose normalized header is one of:
  - `symbol`
  - `securitysymbol`
  - `symbolofcompany`
- rows in that column are normalized to uppercase symbols;
- at least one symbol containing an ASCII alphabetic character must be produced.

The parser ignores all other workbook columns and does not validate a delisted status/date semantic.

**Intended ER0 contract**

A workbook is valid for this purpose only when official provenance and page semantics prove it is **actually the list of companies delisted from NSE**, not merely proposed for delisting.

A different worksheet path/layout with the same semantics is `ADAPTER_REQUIRED`.

A proposed-delisting list substituted for an actually-delisted list is `SEMANTIC_CONTRACT_CHANGE`.

---

# BSE

## BSE-01 — List Of Securities landing/referer

**Source ID:** `BSE_LIST_SECURITIES_LANDING`

**Purpose:** Official landing/referer for BSE lifecycle master downloads.

**Current configured referer**

`https://www.bseindia.com/corporates/List_Scrips.html`

**Allowed official hosts**

- `www.bseindia.com`
- `bseindia.com`
- `api.bseindia.com`

The current BSE landing page exposes Equity status choices `Active`, `Suspended`, and `Delisted`.

Its current table schema is:

```text
Security Code
Issuer Name
Security Id
Security Name
Status
Group
Face Value
ISIN No
Industry
Market Capitalisation (Rs. Cr.)
```

---

## BSE-02/03/04 — Active / Delisted / Suspended List of Scrips CSV

**Source IDs**

- `BSE_ACTIVE_SECURITIES`
- `BSE_DELISTED_SECURITIES`
- `BSE_SUSPENDED_SECURITIES`

**Current URL pattern**

```text
https://api.bseindia.com/BseIndiaAPI/api/LitsOfScripCSVDownload/w?Group=&Scripcode=&segment=Equity&status=<Active|Delisted|Suspended>
```

**Current app transport**

- GET;
- 45-second timeout;
- `Accept: text/csv,*/*`;
- BSE List Scrips referer;
- browser-like User-Agent;
- successful HTTP status required.

The response text must, after BOM/leading whitespace trimming, start with:

`Security Code`

Otherwise the official download is rejected.

The three provider CSVs are combined into one local CSV. The first source header is retained and the app appends:

`Lifecycle Status`

with canonical values:

- Active → `CURRENT`
- Delisted → `DELISTED`
- Suspended → `SUSPENDED`

**Current app parser acceptance**

Header normalization removes punctuation/spaces and lowercases.

Canonical symbol aliases:

- `securityid`
- `scripid`
- `securitysymbol`
- `symbol`
- `scripname`

Security code aliases:

- `securitycode`
- `scripcode`
- `code`

Name aliases:

- `securityname`
- `issuername`
- `nameofcompany`
- `companyname`
- `name`

Series/group aliases:

- `group`
- `groupname`
- `groupcode`
- `series`

ISIN aliases:

- `isin`
- `isinno`
- `isinnumber`

Status aliases:

- `lifecyclestatus`
- `status`
- `listingstatus`
- `scripstatus`

Only the symbol/ID field is currently hard-required by the parser.

Current status classification:

| Input | Canonical |
| --- | --- |
| missing / blank | `CURRENT` |
| `A` | `CURRENT` |
| `ACTIVE` | `CURRENT` |
| `LISTED` | `CURRENT` |
| `EQUITY` | `CURRENT` |
| `DELISTED` / `DE-LISTED` | `DELISTED` |
| `SUSPENDED` | `SUSPENDED` |
| anything else | `UNKNOWN_INACTIVE` |

When duplicate symbols occur, current lifecycle rank wins in this order:

`CURRENT` → `DELISTED` → `SUSPENDED` → other.

**Important current-parser/UI difference**

The UI describes a manual BSE CSV as containing Security Id/Scrip Id, Security Code, Security Name, Group, ISIN and optional Status.

The actual parser is more permissive: only the symbol/ID alias is mandatory. Security Code, Name, Group and ISIN can all be absent.

ER0 freezes the UI description as the **intended manual source contract**, not the accidental broader parser tolerance.

**Intended ER0 BSE contract**

Required semantic fields for normal manual/official current Identity:

- Security Id/Scrip Id (canonical BSE symbol);
- Security Code;
- Security Name;
- Group;
- ISIN for rows where BSE publishes one;
- lifecycle status/provenance sufficient to distinguish current, delisted and suspended populations.

Advisory population sanity:

- Active Equity should remain exchange-scale; ER0 advisory minimum = 1,000 current rows.
- Delisted/Suspended may legitimately be much smaller or occasionally sparse; abrupt population collapse versus a previous successful fetch requires review.
- zero Active rows is invalid; the current official downloader already rejects this.

---

# Cross-source format rules

## Presentation changes that are intended to be compatible

Provided semantic identity remains unchanged:

- column reordering;
- added unused columns;
- case changes in headers already covered by normalization;
- spaces, underscores, hyphens or punctuation changes that normalize to an already accepted header key;
- leading/trailing field whitespace;
- normal CSV quoting;
- NSE historical dates that remain within the explicitly accepted date formats.

## Presentation changes that require an adapter/review

- CSV → XLSX/JSON/ZIP for sources currently parsed as CSV;
- delimiter changes away from comma;
- non-UTF-8-compatible textual encoding;
- renamed columns not covered by the current normalized key/alias set;
- NSE delisted workbook moves away from `xl/worksheets/sheet1.xml`;
- structured JSON/API response replacing the BSE CSV body while preserving semantics.

## Semantic contract changes

- symbol/security-id meaning changes;
- ISIN meaning or granularity changes;
- one security becomes multiple rows without a defined canonical grain;
- series/group semantics change;
- status values change meaning;
- old/new symbol or old/new company-name direction changes;
- effective date changes meaning;
- proposed-to-be-delisted evidence is substituted for actually-delisted evidence;
- source population changes from the intended market/segment.

---

# Current gaps frozen by ER0-R1

1. No runtime allowed-host enforcement exists for user-overridden official URLs.
2. NSE official auto-refresh does not fetch the official company-name-change CSV.
3. Current NSE delisted workbook discovery is caption-blind and can select the wrong `.xlsx` semantics.
4. Current NSE manual current-master parser has no strong minimum-population gate before plan construction.
5. Current BSE manual parser accepts materially less metadata than the UI-described intended contract.
6. BSE has no I3-style reviewed-plan SHA binding; this remains outside ER0-R1 and BSE production Apply acceptance remains deferred.
7. BSE historical Identity source/parity is not implemented and remains deferred.

No item above is authorized for code change by ER0-R1.
