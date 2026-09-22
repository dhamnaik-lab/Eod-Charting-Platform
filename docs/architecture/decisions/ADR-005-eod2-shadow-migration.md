# ADR-005 — EOD2 Parallel Shadow Migration

**Status:** Accepted for V2 future architecture; implementation not started.

## Context

Existing EOD1 files and Generation-6 state are production authority and some legacy files already contain identity/stream collisions that cannot be safely split from binary records alone.

## Decision

Introduce EOD2 and V2 sidecar/catalog in parallel (`eod_data_v2` / separate state authority). Never rewrite EOD1 in place during migration. Keep V1 immediately rollback-capable until explicit V2 promotion.

## Consequences

Migration needs classification, source-driven rebuild for ambiguous files, parity evidence, and explicit promotion gates.
