# ADR-003 — Index Series Is Not Applicable

**Status:** Accepted for V2 future architecture; implementation not started.

## Context

Current Sidebar logic can represent null Series as `No series`, while index rows are conceptually displayed as Index. This lets ordinary Series filtering accidentally affect NSE_INDEX/BSE_INDEX visibility.

## Decision

Indexes are `security_type=INDEX`, `series=NULL`, `series_applicability=NOT_APPLICABLE`, `stream_class=NOT_APPLICABLE`. Index visibility is controlled by Security Type/exchange-family filters, not Series/Group selection.

## Consequences

`No series` cannot be a generic substitute for Index. Missing classification on a normal security remains a distinct UNKNOWN/data-quality condition.
