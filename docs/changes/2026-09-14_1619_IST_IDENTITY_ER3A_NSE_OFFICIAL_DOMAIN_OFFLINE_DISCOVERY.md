# Identity ER3-A â€” NSE Constrained Official-Domain Offline Discovery

**IST timestamp:** `2026-09-14 16:19:22 IST`  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Base source authority:** `Eod Charting Platform Source Code 2026-09-14_120113_IST.zip`  
**Base snapshot SHA-256:** `1E7D048C0F251873A0823DEAED9F4567373C9CC41FF95DD0ECF6DFD58CBAEEF8`

## Objective

Implement ER3-A only: an NSE-only deterministic offline discovery kernel that can extract and rank constrained official-domain replacement candidates from caller-supplied trusted NSE landing-page content. The output is discovery evidence only and has no promotion or Apply authority.

## Previous limitation

ER1 could assess already-configured official sources and the NSE delisted path had a narrow special-purpose workbook-link helper, but there was no general reusable NSE Identity source-recovery candidate-discovery contract. A moved official source therefore had no bounded deterministic offline candidate-discovery kernel.

## Files changed

Created:

- `src-tauri-shell\src\database\official_source_discovery.rs` â€” SHA-256 `590FCCBC807B0CEBAC791524F5ED24383E52C55BF437887E11A271E53C0AE452`
- `docs\superpowers\specs\2026-09-14-identity-er3a-nse-official-domain-offline-discovery-design.md` â€” SHA-256 `1FA8545ED2E6D670DA2927494C5C52E77C80678344D6C70949CA5B54B14A592F`
- `docs\superpowers\plans\2026-09-14-identity-er3a-nse-official-domain-offline-discovery-plan.md` â€” SHA-256 `52D1CE0C85540D651932C5F25D9AFB76A74241B35A91672D9EDF71989B61B8D5`
- this change record

Modified:

- `src-tauri-shell\src\database.rs` â€” SHA-256 `87B0C27676C8FEC0409648A451F63E5AA657F92A3DB516CEDAF566C184F01E41`

## Final implementation

- Reuses `validate_nse_official_source_url`; no second NSE host allowlist exists.
- Supports the five frozen ER0 NSE Identity source IDs only.
- Validates source ID/role and configured/landing-page NSE provenance before discovery.
- Extracts bounded `href` values from supplied page text with no network access.
- Resolves relative URLs against the trusted landing-page URL.
- Rejects non-HTTPS, lookalike, unapproved-subdomain, BSE, third-party, malformed, unchanged, duplicate and source-role-mismatched candidates.
- Removes URL fragments before de-duplication.
- Orders candidates deterministically by semantic score then lexical URL.
- Caps scans at 256 hrefs, accepted candidates at 25 and rejection diagnostics at 50.
- Marks every accepted candidate exactly `DISCOVERED_NOT_PROMOTED`.
- Adds no dependency, Tauri command, frontend contract, persistence, DB/config write or URL promotion.

## Behaviour preserved

- I3 reviewed Preview â†’ Apply authority unchanged.
- I4 reviewed Preview â†’ atomic Apply authority unchanged.
- ER1 source-health implementation unchanged.
- ER2-A/B/C1/C2 implementation unchanged.
- Existing narrow NSE delisted-workbook discovery implementation unchanged.
- Current official URLs and redirect policies unchanged.
- BSE unchanged.
- Deferred NSE symbol-change temp-staging concurrency issue untouched.
- No application/user database was opened. Existing regression tests may use isolated test-owned SQLite fixtures only.

## Validation commands and actual results

All Cargo commands used `--locked --offline`, with `CARGO_TARGET_DIR` under project `tmp`.

- RED sandbox ER3-A test cycle: **PASS â€” expected failure observed**, exit code `101`; failure text identified the intentionally absent ER3-A discovery contract. See `01-er3a-red.log`.
- GREEN focused `er3a_`: **PASS**, exit code 0. See `02-er3a-green.log`.
- Existing official-source provenance regression: **PASS**. See `03-official-source-provenance.log`.
- ER1 unit regression: **PASS**. See `04-er1.log`.
- Existing NSE delisted discovery regressions: **PASS**. See `05-delisted-discovery.log` and `06-delisted-fallback.log`.
- I3 reviewed-authority regression: **PASS**. See `07-i3.log`.
- I4 historical reviewed-authority regression: **PASS**. See `08-i4.log`.
- ER2-A regression: **PASS**. See `09-er2a.log`.
- ER2-B regression: **PASS**. See `10-er2b.log`.
- ER2-C1 regression: **PASS**. See `11-er2c1.log`.
- ER2-C2 regression: **PASS**. See `12-er2c2.log`.
- Rust type/build check: `cargo check --locked --offline` **PASS**. See `13-cargo-check.log`.
- Installed protected-source postflight: **542/542 exact** against `expected-protected-source-after.tsv`.

## Risks / limitations

- ER3-A discovers URL candidates only. It does not fetch or validate remote content, schema, population, semantics or freshness; that belongs to separately approved ER3-B work.
- The HTML link extractor is intentionally bounded and conservative, not a general browser/parser.
- Candidate semantic matching is intentionally limited to the frozen NSE Identity source contracts.
- Candidate discovery must not be interpreted as URL approval or promotion.

## Rollback guidance

Restore the pre-run `src-tauri-shell\src\database.rs` backup from the ER3-A evidence run and remove:

- `src-tauri-shell\src\database\official_source_discovery.rs`
- `docs\superpowers\specs\2026-09-14-identity-er3a-nse-official-domain-offline-discovery-design.md`
- `docs\superpowers\plans\2026-09-14-identity-er3a-nse-official-domain-offline-discovery-plan.md`
- this ER3-A change record

Then verify the accepted 541-file preflight manifest again. Do not use Git/source-control for rollback under this task.

## Evidence

Routine evidence is stored only under:

`E:\TA Projects\EOD Charting Platform\tmp`

The Source Audit directory is reserved for source-code snapshot evidence and was not used by this ER3-A runner.

