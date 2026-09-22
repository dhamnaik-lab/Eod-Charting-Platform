# Rust Warning Hygiene W1.1

Scope: source-only cleanup of reproducible Rust warnings identified after Corporate Action V1.9.2.3.

- Removes unused post-validation fields from the V1.9.2 internal candidate/live-evidence structs while preserving CSV parsing, live gates, fingerprinting, tuple planning, Apply behavior, and reports.
- Removes two unnecessary `mut` bindings.
- Keeps NSE delisted-workbook discovery helpers in production and adds direct tests for encoded URL discovery and fallback behavior.
- Makes the NSE network-free test branch explicitly consume its URL configuration parameter.
- No database operation, Corporate Action mutation, renderer change, or bundle optimization is part of W1.1.
