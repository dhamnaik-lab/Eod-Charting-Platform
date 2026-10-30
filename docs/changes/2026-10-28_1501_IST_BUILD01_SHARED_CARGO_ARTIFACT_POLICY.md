# BUILD-01 — Shared Cargo Artifact Policy

IST timestamp: 2026-10-28 15:01:58 +05:30

## Objective
Avoid new redundant Cargo target trees in tmp; default to the existing project-root target for routine Rust checks/tests/builds.

## Previous limitation
Four historical isolated Cargo target trees in tmp measured 10.766 GiB before DC-02 cleanup; their generating scripts were external/temporary and are not in the verified source snapshot.

## Files modified / created
- Modified: AGENTS.md — shared Cargo and bounded isolated-build policy.
- Created: scripts/Invoke-EOD-SharedCargo.ps1 — fail-closed shared target invocation for normal cargo check/test/build.
- Created: this change record.

## Final implementation and preserved behavior
- Existing .cargo/config.toml, Cargo.toml, package.json, validate-change.ps1 and Tauri build flow remain unchanged.
- Wrapper checks correct root, stable Cargo config, conflicting overrides, secondary target directories under tmp, and uses --target-dir root\target and --manifest-path src-tauri-shell\Cargo.toml.
- Runner does not override CARGO_INCREMENTAL, RUSTFLAGS, debug/test/release profile, feature flags or toolchain.
- No automatic deletion, source refactoring, data/database access, or portable rebuild.
- Direct cargo / npm / external runners are not automatically intercepted; procedural AGENTS.md policy and future agent adoption remain necessary.

## Validation commands / actual results
- Windows PowerShell AST parse of both scripts: PASS.
- Live anchor SHA-256 before/after: PASS.
- Installed wrapper -Mode Preview -CargoAction check: PASS.
- Negative control: custom --target-dir rejected: PASS.
- Actual Cargo check/test/build and reuse benchmark: NOT PERFORMED during Apply (intentional, requires separate run).

## Risks / limitations
- Cargo still legitimately creates distinct debug/release/features/toolchain fingerprints within shared target.
- Legacy/direct runners and tools can bypass the wrapper; these require a separate approved bounded task if discovered.
- Nested Cargo targets in tmp cause fail-closed policy preflight; approved exceptions require separately recorded rationale.
- Offline --locked policy requires dependencies already available locally.

## Rollback guidance
- Restore AGENTS.md from E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20261028_150158_BUILD01_SHARED_CARGO_POLICY\AGENTS.md after verifying its original SHA-256.
- Remove only scripts/Invoke-EOD-SharedCargo.ps1 after confirming its installed SHA-256 and no concurrent use.
- Retain this changelog/evidence as a historical record.

## Source authority / hashes
- Snapshot SHA-256: 97B174FFB5B74F799D27D0C741D6F986282DA934B618526108A3230BC2B56432
- Installed AGENTS.md SHA-256: 6B57E3FF747A3564D3C9FFCB05FB7FB5020F03DA0DDBFD319F7C832EC3715484
- Installed wrapper SHA-256: 0F37C5A53A93973F976A40589276ECB4998D893AA76092C0D3354827FC1E26D3
