# Source Snapshot ZIP-Only Upgrade

**Timestamp:** 23 October 2026, 17:48 IST  
**Scope:** bounded source-snapshot workflow maintenance only  
**Result:** implemented and verified

## Objective and original limitation

`scripts\Create-EOD-Source-Code-Snapshot-v3.ps1` previously used Robocopy to build and verify a persistent timestamped source directory. An operator then had to compress that directory manually. The upgrade makes the script produce one verified Windows-compatible ZIP directly, without a copied source directory or sidecar manifest.

## Verified source authority

- Authorized live root: `E:\TA Projects\EOD Charting Platform`.
- Authorized snapshot destination: `E:\TA Projects\EOD Charting Platform Source Audit`.
- The live `AGENTS.md`, task-relevant `HANDOFF.md`, current snapshot script, backup helper, snapshot references, and `packages\eod-plugin-sdk` were inspected before editing.
- The separate example from another project was not accessed or copied.
- `packages\eod-plugin-sdk` exists and contains three authoritative files: `package.json`, `index.js`, and `index.d.ts`. No SDK development examples are present in the live SDK directory.
- No `.github` CI configuration exists in the live project.

## Files inspected

- `AGENTS.md`
- `HANDOFF.md` task-relevant sections
- `scripts\Create-EOD-Source-Code-Snapshot-v3.ps1`
- `scripts\create-project-backup.ps1`
- `packages\eod-plugin-sdk\package.json`
- `packages\eod-plugin-sdk\index.js`
- `packages\eod-plugin-sdk\index.d.ts`
- `docs\CURRENT_WORK_STATUS.md` snapshot-continuity section
- Snapshot references in `README.md`, `FILE_INVENTORY.md`, `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`, `HANDOFF.md`, `docs`, and `scripts`

## Files modified and created

Modified:

- `scripts\Create-EOD-Source-Code-Snapshot-v3.ps1`

Created:

- `scripts\Test-EOD-Source-Code-Snapshot-v3.ps1`
- `docs\changes\2026-10-23_1748_IST_SOURCE_SNAPSHOT_ZIP_ONLY.md`

No React, TypeScript application, Rust backend, database, market-data, portable-packaging, or unrelated project files were modified.

## Old versus new behavior

| Before | After |
|---|---|
| Robocopy created a persistent source folder. | Source files stream directly into a .NET `ZipArchive`. |
| The copied folder was verified. | The temporary ZIP is reopened and every entry is read before publication. |
| Manual compression was required. | A verified timestamped ZIP is published directly. |
| Plugin SDK was not selected. | Only `packages\eod-plugin-sdk` is selected when present. |
| Persistent intermediate folder remained. | No intermediate snapshot directory is created. |

Creation uses a unique `.partial` file in the authorized audit destination. The final `.zip` name appears only after verification succeeds. Failure removes only the partial file owned by that execution and preserves completed snapshots.

## Inclusion and exclusion contract

Preserved inclusions:

- React/TypeScript frontend and Tauri/Rust backend source.
- Existing public resources, scripts, tests, tools, fixtures, configuration, manifests, and lockfiles.
- Eight required root Markdown documents.
- Complete eligible `docs` tree.
- Required `.cargo\config.toml`.
- Three required runtime Markdown resources.
- Exact plugin SDK subtree when present.

Preserved or strengthened exclusions:

- Dependencies and generated output, including `node_modules`, `target`, `dist`, build, release, portable, installer, coverage, and artifact directories.
- Executables, libraries, installers, object/debug output, archives, maps, logs, temporary files, databases, SQLite files, and `.eod` market data.
- Git metadata, caches, backup directories, local `.env` files, reparse points, junctions, and symlinks.
- Ordinary Markdown outside `docs`, the required root documents, and the three explicit runtime resources.
- Other `packages` content remains excluded; the SDK path is selected narrowly.

The command interface remains `-Source`, `-AuditRoot`, and `-SkipHashVerification`, with exact interactive `COPY` confirmation and IST timestamp naming.

## ZIP integrity verification

Before publication the script verifies:

1. The ZIP reopens and every compressed entry can be read.
2. Expected and actual entry sets and counts match.
3. Entry paths are unique case-insensitively.
4. Entry paths are relative, traversal-free, and under one expected archive root.
5. Each entry length matches the selected source.
6. Default runs compare source and entry SHA-256 hashes.
7. Source length and last-write metadata remain stable during creation, hashing, and the final pre-publication sweep.
8. The completed archive receives a SHA-256 digest before atomic publication.

`-SkipHashVerification` skips only per-file content hashes and reports that fact. Structural, completeness, path-safety, decompression-read, source-stability, and whole-ZIP digest checks still run.

## Validation commands and actual results

1. Windows PowerShell 5.1 parser for both snapshot scripts: **PASS**, zero parser errors.
2. Forbidden-branch and legacy-copy scan (`else`, `elseif`, Robocopy, folder `Copy-Item`): **PASS**, no matches in the production script.
3. `powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File .\scripts\Test-EOD-Source-Code-Snapshot-v3.ps1`: **PASS, 21/21**.
   - Covered successful creation, single-output behavior, internal root, exact expected entries, exclusions, runtime Markdown, SDK present/absent, source/entry hashes, extraction, unchanged sources, skip-hash compatibility, destination collision, missing required file, locked-source failure cleanup, altered entry, truncated ZIP, traversal entry, duplicate entry, and absence of intermediate snapshot directories.
4. Live project execution with default hash verification against the authorized audit destination: **PASS**.
   - Source files: 1,509.
   - Source size: 23.45 MB.
   - ZIP bytes: 8,791,940 (8.38 MB displayed).
   - Missing: 0; unexpected: 0; hash mismatches: 0.
   - Partial ZIPs before/after: 0/0.
5. Independent post-publication `.NET ZipFile` inspection: **PASS**.
   - Entries: 1,509; archive roots: 1; SDK entries: 3; runtime Markdown entries: 3; unsafe paths: 0.
   - Matching intermediate directory: absent.
6. Synthetic Windows `Expand-Archive` extraction and file-by-file SHA-256 comparison: **PASS**.
7. `powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-change.ps1 -Profile docs`: **FAIL (unrelated pre-existing reference)**.
   - `FILE_INVENTORY.md` uses the shorthand reference `2026-10-23_CA_CLASSIC_UI_DESIGN_QA.md`, which the checker resolves as missing; the actual file exists under `docs\changes`.
   - This bounded task did not create or change that reference-format issue, so it was left untouched.

Full frontend builds, Cargo builds/tests, portable builds, installers, and database checks were not run because this bounded change affects only PowerShell source snapshot creation.

## Backup and hashes

Pre-edit backup:

`E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20261023_173857_snapshot_zip_only`

| Artifact | SHA-256 |
|---|---|
| Pre-edit snapshot script | `BB2DBC52492EC1108EE471C7D29523816EEB0F8C9231DA31108123EF53DA685A` |
| Updated snapshot script | `92873BAD119854C2C314F0A2A7D24DE64D3B8E10B59D350F9D85B4EEE9A40603` |
| Focused test script | `8FCF43363800D47BE9E049254F61E085D745F062A00AC29C324FAE89DE5750A9` |
| Backup manifest | `49B123AD3F64558AA615E0D462E8DBD1D3FBA442A9BA2C4F4322DC740459728B` |
| Verified live snapshot ZIP | `8F75F5B05644EE567E9B19ADE3690E1E2A2E276AB932E6FE0C1A6B73C88A64AF` |

Live snapshot:

`E:\TA Projects\EOD Charting Platform Source Audit\Eod Charting Platform Source Code 2026-10-23_174810_IST.zip`

## Risks and limitations

- The SDK currently has no development examples to include; none were fabricated.
- `-SkipHashVerification` intentionally provides weaker content assurance and must be used only when explicitly chosen.
- The regression test uses Windows `Expand-Archive` as the extraction compatibility check; a manual Explorer GUI extraction was not necessary.
- The dated report was written after the live ZIP so it could record the ZIP's final digest. It is therefore not inside that already-verified archive; embedding an archive's own final digest inside itself is not possible without changing the digest.
- The archive is a verified point-in-time snapshot. Later source changes are intentionally not reflected in it.

## Rollback

With explicit approval, restore only `scripts\Create-EOD-Source-Code-Snapshot-v3.ps1` from the pre-edit backup, then remove the newly added focused test and this report. The verified ZIP may be retained as immutable evidence. No application-data or database rollback is required.
