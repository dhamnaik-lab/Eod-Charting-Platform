# Corporate Action Phase 1 — V1.13B-1.2 CSV Reporting Projection Fix

Date: 2026-08-18

## Reproduced failure

Focused Rust validation reached 15 V1.13B-1 tests: 14 passed and
`v113b1_write_outputs_are_filesystem_only` failed with:

`CSV write error: cannot serialize sequence container inside struct when writing headers from structs`

## Root cause

The canonical `MutationPlanRow` intentionally contains two arrays:

- `authorized_import_ids: Vec<i64>`
- `evidence_source_ids: Vec<String>`

The Rust `csv` serializer cannot serialize nested sequence containers while generating struct headers.

## Correction

`MutationPlanRow` remains unchanged for JSON and fingerprint semantics.

A CSV-only `MutationPlanCsvRow` projection is added. It serializes the two array fields as semicolon-delimited scalar strings. The ready-manifest JSON continues to preserve both fields as arrays.

The regression now verifies both JSON-array preservation and six CSV rows with the frozen first row `12841 / V112-EVID-0001`.

## Hash authority

Before: `5ed0eab3a57a7c15c5b15a02a553bde23d3514c2d6d69d6ba9a7d18c96936ab9`  
After: `a6b06af6ec05fff82e51d49c536a1699a248379c58a5535df65ddb3aeffbb444`

## Safety

No live database operation, Corporate Action Apply, Quick Resolve, status promotion, identity-history write, or Git operation is introduced.
