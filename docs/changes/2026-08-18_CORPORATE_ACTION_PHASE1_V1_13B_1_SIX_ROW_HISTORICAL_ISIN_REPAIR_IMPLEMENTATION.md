# Corporate Action Phase 1 — V1.13B-1 Six-Row Historical ISIN Repair Implementation

Date: 2026-08-18

## Scope

Implements the approved V1.13B-1 six-row historical-ISIN repair architecture.

Authorized import IDs:

`12841, 19888, 23036, 24025, 24224, 42274`

Protected import IDs:

`819, 19896, 19973, 19977, 22969, 41025, 41574, 42863`

Controlling fingerprints:

- candidate set: `b4f61783db9a84958b3a278a0ff00d2687925463dea63a97bd39e46a28e504cf`
- disposition set: `f9254415fd96434f43a32b686d90519d30cc2b30210e913c57fe016283894f35`
- mutation set: `60b411e1bbc564fcdd28870f0eb4dd3b273df87c13297548fe2621a7834c6fa7`
- authorization tranche: `4289fd6be38777fafac3af253d1e201b976b79cdf8f9cc1c1f8ccef5a0f44ef7`

## Implementation

- Adds a dedicated V1.13B-1 maintenance module under `src-tauri-shell/src/database/corporate_action_imports/controlled_identity_repair.rs`.
- Adds an **additive** V1.13B-1 strict no-promotion historical-ISIN insertion primitive. The accepted V1.9.2 strict writer is not refactored.
- Adds explicit maintenance routing before normal Tauri startup.
- Adds read-only private-snapshot Preflight tooling.
- Adds an all-six-or-rollback Apply path limited to `instrument_isin_history`.
- Adds exact provenance-bound idempotency.
- Adds a committed-report-failure state distinct from rollback.
- Adds a mandatory V1.13C-1 readiness-marker gate in the PowerShell Apply wrapper.

## Safety boundary

The V1.13B-1 writer does not call Quick Resolve, Corporate Action decision recording, Corporate Action approval, ordinary historical-ISIN upsert/promotion, raw-EOD writers, or adjustment writers.

Only `instrument_isin_history` may be modified by Apply.

The six underlying Corporate Action imports must remain `PARSED / UNRESOLVED / unapproved`.

## Implementation-plan deviation

The approved plan proposed refactoring the V1.9.2 strict insertion internals into a shared helper. Implementation uses a lower-risk additive primitive instead, leaving the accepted V1.9.2 writer logic intact. This does not broaden the approved behavior; it reduces regression surface.

## Live-write gate

This implementation package does **not authorize** live Apply. The supplied Apply wrapper refuses to proceed unless a future V1.13C-1 post-audit readiness marker exists and matches the six-row authority.

The next phase after source validation is V1.13C-1 independent read-only post-audit tooling.
