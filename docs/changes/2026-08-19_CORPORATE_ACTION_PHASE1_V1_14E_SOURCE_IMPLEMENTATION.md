# Corporate Action Phase 1 — V1.14E Historical Event Identity Resolution Source Implementation

**Date:** 2026-08-19 IST  
**Mode:** SOURCE IMPLEMENTATION + CONTROLLED MAINTENANCE INFRASTRUCTURE  
**Live database Apply:** NOT AUTHORIZED BY SOURCE INSTALLATION  
**Git operations:** NONE

## Basis

- Approved V1.14E design: `docs/superpowers/specs/2026-08-19-corporate-action-v1-14e-historical-event-identity-resolution-design.md`
- Approved V1.14E implementation plan: `docs/superpowers/plans/2026-08-19-corporate-action-v1-14e-historical-event-identity-resolution-implementation.md`
- Exact candidate authority: 184 Corporate Action imports / 44 NSE symbol-transition chains.
- V1.14D.1 raw NSE identity source SHA-256:
  `921bd8679e7dff909b12efd152fe64b91a26b124976e919f120a2de1db3221e6`
- Candidate-set fingerprint:
  `4ab5f8ca1625932e559f5207c1e7a4baa8a4fc84f766c5f449af7ba0cb6135ab`

## Source implementation

### Backend

Created:

- `event_identity_authority.rs`
- `v114e_event_identity_authority.json`
- `event_identity_resolution.rs`
- `event_identity_maintenance.rs`

The authority JSON is generated from the reviewed V1.14C event report and V1.14D.1 chain-verification report. It contains the exact import ID, raw/API symbol, retained ISIN, event date, event-time symbol, verified transition, raw NSE source line, source path, and raw source SHA for all 184 events.

The resolution store is deliberately absent from normal automatic database bootstrap. Table absence is a supported pre-Apply state.

The controlled table is:

`corporate_action_event_identity_resolutions`

and is created only inside the controlled V1.14E Apply transaction.

### Read projection

`load_effective_event_identity()` returns:

- raw source symbol/ISIN;
- effective historical event symbol/ISIN;
- resolution provenance when present.

Before V1.14E Apply the result falls back to raw identity.

The first tranche never fabricates `event_isin`. Stored resolved rows have nullable historical event ISIN.

### Scanner

Split/Bonus scan candidates now project their effective event-time symbol through the centralized event-identity resolver. Same-date compound grouping resolves each candidate through the same path before grouping. Price-validation currentness also compares against the effective event symbol.

Factor computation, price-validation policy, and approval policy are unchanged.

### Tauri / renderer

Added read-only command:

`list_corporate_action_event_identities`

The command opens the active database read-only and never invokes normal database preparation/migrations.

Renderer types and Tauri bridge expose the same structured projection.

Official Imports / Review Issues keep the raw source identity as the primary display and add the event-time identity as a separate hint. Review Identity adds a dedicated Historical Event Identity card.

### Controlled maintenance

A pre-Tauri maintenance flag is added:

`--maintenance-corporate-action-v114e`

Supported modes:

- `preflight`
- `apply`

Preflight reads the exact embedded authority and produces a deterministic candidate/apply-plan fingerprint without database writes.

Apply requires the exact READY Preflight manifest plus a verified backup manifest, revalidates all 184 imports inside one transaction, creates the resolution table if needed, inserts/matches exact authorized rows, verifies raw import state unchanged, and commits once.

First-tranche Apply explicitly performs:

- `corporate_action_imports` updates: 0
- decision rows: 0
- Corporate Action writes: 0
- Quick Resolves: 0
- approvals: 0
- identity-history writes: 0
- ISIN-history writes: 0
- raw EOD writes: 0

The result is `COMMITTED_PENDING_POST_AUDIT`, never immediate FULL_SUCCESS.

## Authority compatibility note

The frozen V1.14E.1 candidate-set fingerprint includes the verified NSE raw-source security/company name in addition to the fields explicitly listed in the original Task 1 interface sketch. The source authority struct therefore retains `rawIdentitySecurityName` so it can reproduce the already-approved candidate-set fingerprint exactly. This does not change the V1.14E data model or writable table.

## Validation boundary

The implementation package performs source/static/package validation before installation and runs focused Rust/renderer/Tauri checks on the operator machine when `-RunValidation` is supplied.

No live Corporate Action database Preflight or Apply is performed during source implementation validation.

## Live-operation gates

1. Source implementation and focused validation.
2. Explicit user approval for read-only V1.14E Preflight.
3. Review exact Preflight reports.
4. Separate explicit user approval for live database Apply.
5. Atomic Apply.
6. Independent post-audit.
7. Only a passing independent post-audit can establish V1.14E FULL_SUCCESS.
