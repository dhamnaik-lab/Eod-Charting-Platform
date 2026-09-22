# ADR-002 — NSE and BSE Exchange-Specific Classification

**Status:** Accepted for V2 future architecture; implementation not started.

## Context

NSE exposes Series semantics; BSE exposes security code and Group/classification semantics. V1 currently stores BSE group metadata in a field named `series`, which is convenient but semantically overloaded.

## Decision

NSE and BSE share the common Security/Listing/Price-Stream architecture but preserve exchange-specific raw classification. NSE Series and BSE Group are never interpreted through one shared code taxonomy. BSE security code remains first-class Listing evidence.

## Consequences

UI and resolver logic must be exchange-aware. Cross-exchange equivalence is a separate evidence-driven step, not an importer side effect.
