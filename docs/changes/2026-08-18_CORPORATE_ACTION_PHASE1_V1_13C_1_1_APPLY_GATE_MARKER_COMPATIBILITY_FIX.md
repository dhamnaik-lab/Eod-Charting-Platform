# Corporate Action Phase 1 — V1.13C-1.1 Apply-Gate Marker Compatibility Fix

Date: 2026-08-18

## Scope

Readiness-marker compatibility only.

The V1.13B-1 Controlled Apply wrapper requires the installed V1.13C-1 readiness marker to contain:

- `version = "V1.13C-1"`
- `ready = true`
- `mutationSetFingerprint = "60b411e1bbc564fcdd28870f0eb4dd3b273df87c13297548fe2621a7834c6fa7"`
- `authorizationTrancheFingerprint = "4289fd6be38777fafac3af253d1e201b976b79cdf8f9cc1c1f8ccef5a0f44ef7"`

The original V1.13C-1 readiness installer emitted `status = "POST_AUDIT_TOOL_READY"` and the mutation/apply-plan fingerprints, but omitted `ready` and `authorizationTrancheFingerprint`.

## Correction

This package preserves all existing V1.13C-1 readiness metadata and adds exactly:

```json
"ready": true,
"authorizationTrancheFingerprint": "4289fd6be38777fafac3af253d1e201b976b79cdf8f9cc1c1f8ccef5a0f44ef7"
```

It also verifies the exact accepted V1.13B-1 Controlled Apply wrapper SHA-256:

`45745CE18B96DF05479DD8CDBAD1B8A3075FE86E1BCC9EEE31D9DD413EF80319`

and verifies that the wrapper still gates on both required fields.

## Safety

- production Rust/source edits: 0
- live SQLite opens: 0
- database writes: 0
- Corporate Action writes: 0
- Quick Resolves: 0
- Git operations: 0

This package does not execute the Controlled Apply.
