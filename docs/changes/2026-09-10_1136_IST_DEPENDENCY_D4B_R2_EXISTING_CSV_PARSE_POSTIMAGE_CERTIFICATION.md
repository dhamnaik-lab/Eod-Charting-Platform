# DEPENDENCY-D4B-R2 — Existing csv-parse Postimage Certification

- IST timestamp: 2026-09-10 11:36:27 IST
- Objective: Certify/adopt the already-materialized D4A-approved csv-parse unused-family removal without performing another dependency mutation.
- Provenance classification: EXISTING_POSTIMAGE_PROVENANCE_UNKNOWN.
- D4B-R1 finding: D4B_R1_DID_NOT_MUTATE; its evidence records mutationStarted=false and rollbackAttempted=false.

## Previous limitation
D4B-R1 expected the older D3B preimage but found package.json already equal to the exact D4A remove-family candidate. A follow-up read-only diagnostic confirmed the exact D4A package and package-lock postimage, absent csv-parse package directories, and a changed hidden npm lock. The originating process that materialized this state was not established from available evidence.

## Files changed by D4B-R2
- This documentation report only.
- No dependency file or installed package was changed by D4B-R2.

## Certified existing implementation
- package.json SHA-256: 8C4BEBD7A534A3393939E4F99C4E3A28691D9FA7C8F85503F0565D4544C20E6F
- package-lock.json SHA-256: F8442A64C79A0B5B058F7FC95A5955980BB4E471ED922F34638EDCDEE9297BEB
- node_modules/.package-lock.json SHA-256: 9DAA7798E1170A9039FE1B0843107DC860F36F4EE6CA657932F71E9B20AEF100
- node_modules/csv-parse: absent
- node_modules/@types/csv-parse: absent
- hidden-lock structural certification: PASS, no csv-parse family nodes or reverse references
- active source references to csv-parse: 0
- source fingerprint: 490D8844A47767F16DC08470839823C613D93B3A93EA92C398635BD44F3C2836 / 535 files

## Behaviour preserved
- Application source unchanged.
- Cargo.toml and Cargo.lock unchanged.
- Vite, Vitest, esbuild, axios, follow-redirects and form-data sentinels unchanged.
- No database access.
- No source-control command.
- D4B-R2 did not perform or repeat the dependency removal.

## Validation commands and actual results
- npm ls --all --json — PASS.
- npm ls csv-parse @types/csv-parse --all --json — PASS; targeted family absent.
- npm audit --json — expected nonzero vulnerability status; exact remaining owner set PASS: @babel/core, baseline-browser-mapping, browserslist, nanoid, postcss.
- npm run typecheck:renderer — PASS.
- npm test -- --reporter=dot — PASS: 143/143 files, 790/790 tests.
- npm run build:renderer — PASS.
- cargo check --manifest-path src-tauri-shell/Cargo.toml --locked --offline — PASS with external target output.

## Network
Only npm audit used intentional network access. No package install/update/removal command was run. Cargo validation was locked and offline.

## Risks / limitations
Five npm vulnerability owners remain and are outside D4B-R2 scope. Existing-postimage provenance is unknown; this certification establishes the state and validation result, not the identity of the process that first materialized it.

## Rollback guidance
D4B-R2 made no dependency mutation, so there is no dependency rollback for R2. If the certified removal itself must ever be reversed, use the separately preserved D3B preimage authority and a newly authorized rollback task rather than manually reinstalling packages.

## Evidence authorities
- D4A R1D evidence SHA-256: EE1BBBDF4AD0FB96A9C36969D5B283B9B26BF8D2099A8884480EA5C9F3091A03
- D4B R1 failure evidence SHA-256: 748B42F58BE4FA9F366200B1B4847F57185EC047D5FFD5EDA8AD1747D52439FA
- D4B-R2 evidence ZIP: recorded by runner after packaging.

## Next step
Independent D4B-R2 evidence review. D5 is not authorized until that review passes.