# Corporate Action Phase 1 — V1.14E.1 Implementation Plan Lock

**Date:** 2026-08-19 IST  
**Mode:** DOCUMENTATION / IMPLEMENTATION PLAN ONLY  
**Production source writes:** 0  
**Database operations:** 0  
**Mutation authorization:** NONE

## Fresh-source basis

```text
Snapshot : Eod Charting Platform Source Code 2026-08-19_022835_IST
ZIP SHA  : b60049ced542227f0c2fa66d7adbd6eaa2bc9756e4373523ae4ce6706dbf0299
Files    : 820
```

The plan was built after inspecting the current schema owner, Corporate Action import loader,
Quick Resolve path, scanner candidate path, pre-Tauri maintenance dispatch, Rust/Tauri types,
renderer bridge, and Corporate Actions UI.

## Key current-source decision

The first V1.14E tranche must **not** add
`corporate_action_event_identity_resolutions` to the normal automatic
`bootstrap.rs::run_migrations` path.

Reason: an ordinary application launch after source installation would otherwise create live
database schema before the separately authorized V1.14E controlled Apply.

Instead:

```text
table absent -> read paths fall back to raw event identity
controlled Apply -> creates table + exact authorized rows inside one transaction
post-Apply app startup -> table already exists
```

## First-tranche workflow decision

The current `apply_import_row_resolution()` rewrites raw identity/workflow fields, while Quick
Resolve requires exact event-date historical ISIN evidence and records a decision.

Therefore V1.14E first-tranche Apply will:

```text
insert event-identity resolution rows only
update corporate_action_imports: 0
insert corporate_action_import_decisions: 0
Quick Resolve: 0
approvals: 0
```

This is the smallest implementation that satisfies the approved design without weakening
existing ISIN safeguards.

## Authority

```text
Events                  : 184
Chains                  : 44
Dividends               : 180
Bonuses                 : 4
Candidate ID fingerprint: dafd118bd35acb11076296f24830d5722e3ef1b5715e829c7a1499910845961c
Candidate set fingerprint: 4ab5f8ca1625932e559f5207c1e7a4baa8a4fc84f766c5f449af7ba0cb6135ab
Design authority        : c1d118d3eaa6d4b75c32c3bfa5ed9e538fa2d25e0a84436957c708a8da181c6b
```

## Execution gate

This document authorizes planning only. Source implementation requires plan approval. Live
database Apply requires a later, separate explicit approval after read-only Preflight review.
