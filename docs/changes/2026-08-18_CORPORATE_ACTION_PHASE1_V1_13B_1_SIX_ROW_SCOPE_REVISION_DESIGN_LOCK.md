# Corporate Action Phase 1 — V1.13B-1 Six-Row Scope Revision Design Lock

Date: 2026-08-18

## Decision

The original V1.13 14-row controlled-repair scope is formally revised after accepted V1.13A.2 Preview evidence.

V1.13A.2 produced:

- 14 SAFE candidates accounted for;
- 6 `READY_INSERT`;
- 0 already satisfied;
- 8 blocked;
- 6 unique future mutations;
- 97 non-SAFE rows excluded;
- database writes 0;
- Corporate Action writes 0;
- Quick Resolves 0.

Controlling fingerprints:

- candidate set: `b4f61783db9a84958b3a278a0ff00d2687925463dea63a97bd39e46a28e504cf`
- disposition set: `f9254415fd96434f43a32b686d90519d30cc2b30210e913c57fe016283894f35`
- mutation set: `60b411e1bbc564fcdd28870f0eb4dd3b273df87c13297548fe2621a7834c6fa7`
- six-row tranche authorization: `4289fd6be38777fafac3af253d1e201b976b79cdf8f9cc1c1f8ccef5a0f44ef7`

## Approved revision

V1.13B-1 is limited to six exact `instrument_isin_history` mutations for:

`12841, 19888, 23036, 24025, 24224, 42274`

The protected blocked set is:

`819, 19896, 19973, 19977, 22969, 41025, 41574, 42863`

The original 14-row authority remains reconciled exactly as:

`6 authorized + 8 protected = 14`

The 97 non-SAFE V1.12.1 rows remain excluded.

## Safety boundary

V1.13B-1 may not:

- write `instrument_identity_history`;
- update `instruments`;
- update Corporate Action imports/statuses;
- record Corporate Action decisions;
- Quick Resolve;
- approve Corporate Actions;
- modify raw EOD;
- modify factors/adjustments;
- infer the missing historical symbol for import 42863;
- model legal succession as ordinary symbol/name continuity.

## Implementation status

This document locks design scope only. No V1.13B-1 database writer has been applied by this documentation package.

The implementation must follow:

`docs/superpowers/specs/2026-08-18-corporate-action-v1-13b-1-six-row-historical-isin-repair-design.md`

and:

`docs/superpowers/plans/2026-08-18-corporate-action-v1-13b-1-six-row-historical-isin-repair-plan.md`
