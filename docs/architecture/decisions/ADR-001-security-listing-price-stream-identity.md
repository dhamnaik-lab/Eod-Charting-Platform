# ADR-001 — Security / Listing / Price-Stream Identity

**Status:** Accepted for V2 future architecture; implementation not started.

## Context

V1 keys canonical prices and binary state largely by exchange+symbol. R3 proves the same symbol can represent multiple securities (IMC1 N1/N2/N3) and one security can have coexisting normal/block market streams (APOLLOTYRE EQ/BL).

## Decision

Introduce immutable internal `security_id`, `listing_id`, and `price_stream_id`. Security identifies the economic security; Listing identifies its exchange listing; Price Stream identifies an independently maintained price history.

## Rejected alternatives

- Keep exchange+symbol and choose one duplicate row: loses/contaminates official data.
- Use exchange+symbol+series as complete identity: fragments normal lifecycle transitions and does not model cross-exchange/security identity correctly.
- Use current ISIN as the database primary key: does not safely model dated identifier transitions.

## Consequences

Charts/storage ultimately bind to Price Stream; Corporate Actions bind to Security; migration and legacy reference resolution are required.
