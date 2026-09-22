# Source Snapshot V3 - Complete Docs Tree

**IST timestamp:** 2026-09-14 10:06:51 IST

## Objective
Make EOD source snapshots self-contained for development continuity by including the complete docs tree, including docs\superpowers specs/plans/handoffs as well as docs\changes.

## Previous limitation
Snapshot V3 included only docs\changes plus selected root Markdown and three explicit runtime Markdown resources. Authoritative docs\superpowers design/spec/handoff files were omitted from fresh source snapshots.

## Files changed
- scripts\Create-EOD-Source-Code-Snapshot-v3.ps1

## Final implementation
- Complete docs tree copied recursively.
- Markdown allowed throughout docs.
- Existing exclusions for binaries, archives, databases, logs, caches, build output and secrets retained.
- Required root documentation retained.
- Three runtime/build Markdown resources under src retained explicitly.
- Expected-file/path/hash verification now includes the complete filtered docs tree.
- Three pre-existing alternate branches converted to separate if blocks with behavior preserved.

## Behaviour preserved
- Source-directory selection.
- Build/dependency/output exclusions.
- No nested archives/executables/databases/logs/secrets.
- Interactive COPY confirmation.
- Full missing/unexpected/hash-mismatch verification.
- SkipHashVerification switch behavior.

## Validation
- Exact preimage SHA: E781E2F9740FF901C29E4CF1F7A8DCEA9E8DA8EDD4DFF71AE62CB862905997A9
- Updated script SHA: BB2DBC52492EC1108EE471C7D29523816EEB0F8C9231DA31108123EF53DA685A
- Windows PowerShell parser: PASS
- Static RED: previous docs\changes-only policy proved
- Static GREEN: complete docs contract PASS
- PowerShell forbidden alternate-branch keywords: 0

## Untested item
A fresh runtime snapshot must now be generated with the updated script and independently verified to contain docs\superpowers and the complete expected docs tree.

## Rollback
Restore scripts\Create-EOD-Source-Code-Snapshot-v3.ps1 to SHA-256 E781E2F9740FF901C29E4CF1F7A8DCEA9E8DA8EDD4DFF71AE62CB862905997A9.
