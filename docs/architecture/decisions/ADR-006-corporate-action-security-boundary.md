# ADR-006 — Corporate Action Binds to Security, Not Price Stream

**Status:** Accepted for V2 future architecture; implementation not started.

## Context

One Security may have multiple exchange listings and multiple market streams. A split/dividend/bonus is an economic-security event, not a separate event for every stream.

## Decision

Corporate Action identity binds to `security_id`. Listing/stream relationships determine which price histories are affected. Existing current-master authority, dated identity-history evidence, approval/review boundaries, and conflict safeguards remain in force.

## Consequences

V2 CA integration occurs only after Security identity is stable and must regress same-symbol/conflicting-ISIN cases as non-equivalent unless official dated continuity evidence proves otherwise.
