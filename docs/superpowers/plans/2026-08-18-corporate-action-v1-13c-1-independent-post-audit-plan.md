# Corporate Action V1.13C-1 Independent Post-Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent read-only audit that can prove the future V1.13B-1 transaction changed exactly six historical-ISIN rows and nothing else.

**Architecture:** A standalone Python audit compares the accepted preflight snapshot with a post-Apply private DB/WAL/SHM snapshot. A PowerShell wrapper performs live-family hash/copy proof and writes FULL_SUCCESS only after the Python semantic audit and post-audit live-family rehash both pass.

**Tech Stack:** Python 3 `sqlite3`, PowerShell 7, JSON/CSV, SHA-256.

**Spec:** `docs/superpowers/specs/2026-08-18-corporate-action-v1-13c-1-independent-post-audit-design.md`

## Global Constraints

- No production Rust/source change.
- No live SQLite open.
- No database write.
- No Corporate Action approval or Quick Resolve.
- No Git operation.
- Exact V1.13B-1 mutation fingerprint: `60b411e1bbc564fcdd28870f0eb4dd3b273df87c13297548fe2621a7834c6fa7`.
- Exact V1.13B-1 apply-plan fingerprint: `62faae5fb5f7dc106ec3ecb986b11250c50e82071bfff36a6d2c0e9b27f421f3`.

---

### Task 1: Freeze the accepted preflight authority

**Files:**
- Create: `authority/v1-13c-1-preflight-binding.json`

- [ ] Verify the accepted ready manifest is `READY` with 6 inserts, 0 satisfied and 0 blocked.
- [ ] Record exact SHA-256 hashes for all preflight report files.
- [ ] Record the six authorized IDs, eight protected IDs, mutation fingerprint, apply-plan fingerprint and DB-family hashes.

### Task 2: Implement the independent SQLite comparator

**Files:**
- Create: `audit/v113c1/post_audit.py`
- Test: `audit/tests/test_post_audit.py`

- [ ] Add a failing fixture test for an exact +6 authorized delta.
- [ ] Implement read-only connections with `PRAGMA query_only=ON`.
- [ ] Compare all user-table schemas and row multisets.
- [ ] Permit changes only in `instrument_isin_history`.
- [ ] Require all pre-existing history rows unchanged and exactly six authorized new rows.
- [ ] Require six authorized imports and eight protected imports remain unresolved/unapproved.
- [ ] Emit JSON and CSV evidence.
- [ ] Add negative tests for forbidden table change, seventh history row and status promotion.

### Task 3: Wrap private-snapshot post-audit execution

**Files:**
- Create: `Run-V1-13C-1-Post-Audit.ps1`

- [ ] Verify the package and exact preflight report hashes.
- [ ] Hash/copy the live DB/WAL/SHM family without opening SQLite.
- [ ] Copy the preflight snapshot family into the audit workspace.
- [ ] Run Python only against private copies.
- [ ] Rehash the live DB/WAL/SHM family and fail if any changed during audit.
- [ ] Write `FULL_SUCCESS` only after every semantic and live-family gate passes.

### Task 4: Install and bind post-audit readiness

**Files:**
- Create: `Install-V1-13C-1-Post-Audit-Readiness.ps1`
- Create: `v1-13c-1-post-audit-ready.template.json`

- [ ] Run package tests.
- [ ] Install spec/plan/change documentation only.
- [ ] Locate the existing V1.13B-1 Controlled Apply wrapper and resolve its readiness-marker path fail-closed.
- [ ] Write a hash-bound readiness marker only after validation succeeds.
- [ ] Do not run the writer.

### Task 5: Verify package and synthetic end-to-end behavior

- [ ] Run four Python unit tests.
- [ ] Run the comparator against a private copy of the real accepted preflight snapshot plus exactly six synthetic authorized inserts; expect `AUDIT_SUCCESS`.
- [ ] Tamper a forbidden table in a separate private fixture; expect failure.
- [ ] Verify package payload hashes and ZIP round-trip.
- [ ] Stop before any live Apply.
