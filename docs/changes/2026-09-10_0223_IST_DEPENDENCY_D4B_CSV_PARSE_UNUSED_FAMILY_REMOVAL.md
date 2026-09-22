# DEPENDENCY-D4B — csv-parse Unused-Family Removal

- IST timestamp: 2026-09-10 02:23:57 IST
- Objective: Promote the independently accepted D4A R1D CsvParseRemoveUnusedFamily result to the live EOD Charting Platform.
- Previous limitation: csv-parse@6.2.1 and @types/csv-parse@1.1.12 were direct dependencies with zero active source references; csv-parse owned advisory GHSA-8cw4-87c7-c6xx.

## Files / dependency state changed
- package.json — removed direct csv-parse and @types/csv-parse.
- package-lock.json — exact D4A R1D removal candidate promoted.
- node_modules/.package-lock.json — removed only the two corresponding package nodes.
- removed node_modules/csv-parse.
- removed node_modules/@types/csv-parse.
- this report added under docs/changes.

## Final implementation
No npm install/uninstall/update/audit-fix command was used. The exact D4A candidate package/lock was copied into place; only the two unused installed package directories and hidden-lock entries were removed.

## Behaviour preserved
- active source fingerprint unchanged: 490D8844A47767F16DC08470839823C613D93B3A93EA92C398635BD44F3C2836 (535 files).
- zero active csv-parse references before and after.
- Vite/Vitest/esbuild/axios/follow-redirects/form-data sentinels unchanged.
- Cargo.toml and Cargo.lock unchanged.
- no database access.
- no source-control action.

## Validation commands / results
- npm ls --all --json — PASS.
- npm audit --json — expected nonzero audit status due remaining advisories; exact remaining owner set PASS: @babel/core, baseline-browser-mapping, browserslist, nanoid, postcss.
- npm run typecheck:renderer — PASS.
- npm test -- --reporter=dot — PASS: 143/143 files, 790/790 tests.
- npm run build:renderer — PASS.
- cargo check --manifest-path src-tauri-shell/Cargo.toml --locked --offline — PASS using external target directory.

## Evidence / hashes
- D4A R1D evidence SHA-256: EE1BBBDF4AD0FB96A9C36969D5B283B9B26BF8D2099A8884480EA5C9F3091A03.
- preimage package SHA-256: 34BDA1F9650DE009A10D0484EE28F7730AD4D43C73E04483D462E4F84A86BCB0.
- postimage package SHA-256: 8C4BEBD7A534A3393939E4F99C4E3A28691D9FA7C8F85503F0565D4544C20E6F.
- preimage package-lock SHA-256: 03C639CD4FAF9698E2CE4D93B7CE442708B0F3662762CF1D41077B659B805A8D.
- postimage package-lock SHA-256: F8442A64C79A0B5B058F7FC95A5955980BB4E471ED922F34638EDCDEE9297BEB.
- postimage hidden lock SHA-256: 9DAA7798E1170A9039FE1B0843107DC860F36F4EE6CA657932F71E9B20AEF100.
- backup: E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_2026-09-10_022357_IST_dependency-d4b-csv-parse-unused-family.

## Risks / limitations
Five npm vulnerability owners remain and are intentionally out of D4B scope. Their remediation must be handled as later bounded dependency-family tasks.

## Rollback guidance
Restore package.json, package-lock.json, node_modules/.package-lock.json, node_modules/csv-parse, and node_modules/@types/csv-parse from E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_2026-09-10_022357_IST_dependency-d4b-csv-parse-unused-family. Verify the original three lock/package hashes and run npm ls --all --json.