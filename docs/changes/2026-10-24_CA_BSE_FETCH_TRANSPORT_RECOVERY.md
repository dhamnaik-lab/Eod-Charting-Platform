# BSE Corporate Actions transport and recovery — 24 October 2026

## Scope and evidence

The reported combined fetch completed NSE (43,839 read, 126 added, 43,713 duplicates,
26 unresolved) and failed opening the BSE session page. The generic reqwest error
did not include its underlying cause. Current direct HTTP probes reached the BSE
page but received HTTP 403 from both its JSON and CSV endpoints, including with
the official YYYYMMDD date format. The real browser page displayed action rows;
its observed resources confirmed it still calls the configured DefaultData API.
That establishes a difference between browser and direct HTTP access, not the
exact cause of the screenshot's earlier transport failure.

## Changes

- `src-tauri-shell/src/database/corporate_action_imports.rs`: current BSE page URL;
  BSE-specific HTTP/1.1 client with bounded connection pooling/timeouts; one retry
  for transport/body failures; causal error details; explicit HTTP 403 recovery.
  Ordinary and scrip-scoped BSE requests use the same helper. HTTP failures return
  errors before source parsing/storage and fetch-coverage recording.
- `src/components/DatabaseToolsDialogs.tsx`: after a BSE failure, show official-page
  and BSE-only selection buttons, select BSE for the existing CSV importer, and
  explain that completed NSE results remain saved. Recovery resets on a new fetch
  or database change. All-selected success checkpoint semantics are unchanged.

Backup: `backups/pre_opencode_changes_20261024_111614_bse_ca_transport`.
Existing dirty changes were retained. No database, financial approval, raw EOD,
or NSE transport changes; no build, packaging, commit, or push.

## Validation

- PASS — `cargo test --manifest-path src-tauri-shell/Cargo.toml bse_action_transport --offline -- --nocapture`:
  three local HTTP tests pass (JSON success, no retry on 403, interrupted-body retry);
  the live test is ignored by default. Compile/link took 32 seconds on the final run.
- FAIL (external access) — explicit `bse_action_transport_live_probe --offline -- --ignored --nocapture`:
  the updated Rust client successfully warmed the current BSE page; its dated JSON
  request returned HTTP 403 with the new recovery diagnostic. No database was opened.
- PASS — `scripts/validate-change.ps1 -Profile renderer -Paths src/components/DatabaseToolsDialogs.tsx`:
  renderer typecheck and scoped whitespace. Initial typecheck identified that
  external URL opening belongs to DesktopShellApi; the button now uses that
  existing platform bridge, and the final check passed.
- PASS — focused Vitest `corporateActionLegacyOfficialFetchImprovements` and
  `corporateActionPostR1BIndependentWindowsFetch`, excluding `tmp/**`: 11/11 tests.

The first local test run caught truncated-body errors classified by reqwest as
decode errors; the retry predicate was corrected. A second run exposed the test
server closing before consuming all request headers, causing Windows socket
resets. Reading the complete header fixed that fixture; the final local run passed.

## Acceptance boundary

Transport hardening does not grant access when BSE refuses a direct request.
Automatic BSE fetch remains blocked by the observed API refusal. The official
page exposes CSV recovery, but a successful download/import has not been proven.
Follow-up inspection found that its download button also uses the API host;
the browser attempt failed with ERR_RESPONSE_HEADERS_MULTIPLE_CONTENT_DISPOSITION.
No server access bypass was added. See `outputs/BSE_CA_AUTOMATIC_FETCH_FINDINGS.md`.
The running executable needs a rebuild to receive these source changes. Native
recovery-button and full downloaded-CSV import acceptance remain unverified.
