# Future Identity Evidence Resolver / Official-Source Recovery Handoff

**Status:** FUTURE WORK HANDOFF / NOT IMPLEMENTED  
**Date:** 2026-09-06 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Read before future work

This future capability was documented after Identity I4 was fully closed.

It must not be confused with current production Identity authority.

## Current accepted baseline

Identity I4 current authority remains:

- Official NSE = routine primary Identity source.
- Manual NSE historical archive = fallback/recovery.
- I3 current-universe reviewed Preview → Apply preserved.
- I4 historical reviewed Preview → atomic Apply preserved.
- BSE historical/data-parity/production Apply acceptance deferred.

Do not modify those contracts merely because this future design exists.

## Future problem being solved

Two maintenance failures must remain recoverable after the application is stable:

### Identity mismatch

Example:

```text
local symbol / ISIN / name
does not safely reconcile with
current official symbol / ISIN / name
```

The app needs deterministic expert rules and official evidence, not an embedded LLM making database decisions.

### Official source moved/broke

Example:

```text
configured NSE URL
→ 404 / redirect / schema change / wrong content
```

The app needs enough source-contract information to validate a replacement, rather than depending on the user already knowing the new URL.

## Future architecture

```text
Identity Evidence Resolver
→ Official Evidence / Source Recovery
→ External-AI Handoff only if still unresolved
→ local candidate validation
→ human review
→ existing I3/I4 reviewed Apply
```

## Non-negotiable boundaries

- AI is not Identity authority.
- AI cannot directly Apply.
- AI cannot edit the database.
- AI cannot directly promote a new source URL.
- Third-party market sites cannot become exchange authority merely because an AI cited them.
- Source replacement must pass local contract validation.
- Ambiguous ISIN changes fail closed.
- Current I3/I4 reviewed authority remains the final write boundary.

## Key future files to read

Before implementing anything, read:

1. `docs\superpowers\specs\2026-09-06-identity-current-authority-after-i4-historical-reviewed-atomic-apply.md`
2. `docs\superpowers\specs\2026-09-06-identity-new-chat-handoff-after-i4.md`
3. `docs\superpowers\specs\2026-09-06-future-identity-evidence-resolver-source-recovery-design.md`
4. `docs\superpowers\specs\2026-09-06-future-identity-external-ai-handoff-contract.md`

## Suggested future phase order

```text
ER0  Source-contract inventory + authority freeze
ER1  Source health and validation diagnostics
ER2  Deterministic Identity resolver
ER3  Constrained official-domain discovery
ER4  Candidate URL review + version history
ER5  Export Identity Investigation Brief
ER6  Export Source Recovery Brief
ER7  Import/validate external candidate result
ER8  Audit/recovery hardening
```

Each phase is a separate bounded problem.

## First future implementation task

The recommended first implementation is **ER0 only**:

> Inventory existing Identity/Corporate Action official source definitions and freeze each source's purpose, URL, allowed official hosts, expected schema/content, freshness, and semantic validators.

ER0 should be read-only/design-first before any source-health or web-discovery code.

## What not to do

Do not begin by:

- embedding an AI SDK;
- creating a chatbot;
- giving the app unrestricted internet search;
- auto-discovering and auto-promoting URLs;
- adding autonomous Identity writes;
- redesigning I3/I4;
- implementing all ER0–ER8 together.

## Completion state of this documentation

This handoff preserves the idea only.

No production source, backend, database, network behavior, provider dependency, or UI behavior is authorized or changed by these documents.
