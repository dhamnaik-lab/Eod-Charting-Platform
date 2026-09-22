# ADR-004 — Classification History vs Independent Price Stream

**Status:** Accepted for V2 future architecture; implementation not started.

## Context

Raw Series/Group can change over time without creating a new economic security or discontinuous normal chart, while special channels such as block deals can coexist with normal trading on the same date.

## Decision

Store ordinary Series/Group changes as effective-dated classification history when they represent lifecycle transitions. Create separate Price Streams only for independently coexisting market channels or otherwise distinct price histories.

Examples: `EQ -> BE -> EQ` may remain one NORMAL stream; `EQ + BL` same date is NORMAL plus BLOCK_DEAL streams.

## Consequences

Resolver logic must distinguish transition from coexistence and must fail closed when evidence is insufficient.
