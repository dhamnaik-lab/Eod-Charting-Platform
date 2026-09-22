# Corporate Actions V1.12.1 Canonical Documentation Reconciliation Implementation Plan

> **For agentic workers:** documentation-only execution. No production source, database, or Git operation is authorized.

**Goal:** Reconcile canonical project documentation from stale V1.9.2 resumption text to the accepted V1.12.1 read-only identity-audit closeout.

**Architecture:** Guard the six canonical root documents by SHA-256 from fresh source snapshot `Eod Charting Platform Source Code 2026-08-18_015700_IST`, back them up, install only documentation payloads, and verify exact output hashes and authority markers.

**Tech Stack:** Markdown, PowerShell 7, SHA-256.

## Global Constraints

- Documentation writes only.
- No production/runtime source changes.
- No database operation.
- No identity/history write.
- No Corporate Action approval or Quick Resolve.
- No raw EOD or factor mutation.
- No Git operation.
- Source ZIP SHA-256: `E761D587BFE0134EAB6F7940332B97092823AE88AC85845E756B3D5C1036574D`.
- Accepted authority: 111 total / 14 SAFE / 97 manual-unresolved.

---

### Task 1: Verify fresh-source documentation basis

- [ ] Verify all six canonical root documents exist.
- [ ] Verify each SHA-256 matches the fresh snapshot pre-state.
- [ ] Abort before any replacement if any guard fails.

### Task 2: Create verified documentation recovery copies

- [ ] Create a timestamped documentation backup directory.
- [ ] Copy the six guarded canonical documents.
- [ ] Verify every backup SHA-256.

### Task 3: Install documentation payload

- [ ] Copy only manifest-listed Markdown files.
- [ ] Reject a conflicting pre-existing new documentation file.
- [ ] Verify every installed payload SHA-256.

### Task 4: Validate closeout authority

- [ ] Confirm 111 / 14 / 97 authority markers.
- [ ] Confirm all four controlling fingerprints in the closeout record.
- [ ] Confirm V1.13 is described as not implemented.
- [ ] Confirm payload contains no production source path.
- [ ] Confirm installer contains no Git or database operation.
