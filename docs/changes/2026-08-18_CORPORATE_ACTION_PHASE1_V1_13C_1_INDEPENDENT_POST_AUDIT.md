# Corporate Action Phase 1 — V1.13C-1 Independent Post-Audit Tooling

Date: 2026-08-18

This package installs and validates an independent read-only audit for the V1.13B-1 six-row historical-ISIN transaction. It is bound to the accepted 2026-08-18 14:46:46 IST preflight and does not perform the transaction itself.

The audit permits exactly one database-table delta: six provenance-bound additions to `instrument_isin_history`. Every other user table must remain semantically identical to the accepted preflight snapshot. Corporate Action imports, decisions, evidence, actions, instruments, identity history, EOD data, scan state, settings and watchlists are therefore protected by the comparison rather than by writer self-reporting.

The package also provides a readiness marker installer. Readiness means the audit tool is present and tested; it is not a post-audit success result.
