# Portable build metadata

28 November 2026, IST

The operator's standard `npm run tauri:portable:win` finished Vite and failed compiling `src-tauri-shell/src/main.rs` because `EOD_BUILD_INFO_FILE` was undefined. The shared release target retained build-script output from before the metadata environment directive.

Standard builds now embed `src-tauri-shell/gen/build-info.json` directly. The build script activates a separately validated compile-time path for `EOD_CANDIDATE_BUILD_INFO`. If candidate metadata was requested and the build script failed to activate it, compilation reports that failure before a candidate can be mislabeled.

Canonical Rustfmt and shared Cargo release-profile checks passed for both candidate and default metadata. The candidate check emitted the exact fixture path and activation flag. The subsequent default check cleared both. The operator's generated metadata and existing portable executable hashes matched before and after. No release executable or package was built during this repair. Resume with the standard portable command.

Logs are under `tmp/fixtures/portable-build-metadata-fallback`. The pre-edit backup is `backups/pre_opencode_changes_20261128_155928_portable-build-metadata-fallback`.

## Candidate executable verification

29 November 2026, IST

When packaging from a candidate root, pass the expected SHA-256 recorded at the end of that specific candidate build. Use the digest retained with the candidate's build evidence. Re-hashing the current shared release EXE at packaging time would allow a later unrelated build to pass.

```powershell
.\scripts\prepare-tauri-portable.ps1 -CandidateRoot $candidateRoot -ExpectedCandidateExeSha256 $recordedBuildHash
```

The packager checks the shared source EXE against the recorded digest before creating candidate output. It checks the staged copy against that verified digest before finalizing the portable folder. A source mismatch stops before staging. A mismatch during copying stops before finalization. The standard invocation uses its existing source-to-copy verification.

PowerShell parser and fixture checks passed for a missing or malformed digest, a digest supplied without candidate mode, an unrelated source executable, a correct digest, a source replaced after preflight, and standard staging. The fixture redirected the shared source path to a small test file. No Rust compilation ran.

The approved isolated restaging used archived build `20261128.111618-bhav-boundary-01` and its SHA-256 recorded in the historical-date change record. The test redirected only the shared EXE input lookup. The packager rejected the current standard EXE before creating any output, then finalized the archived candidate with an exact EXE hash match. All 32 renderer files matched their recorded input files, the README reported the candidate build number, and the launcher was present. The archives and standard package were preserved. The shared release EXE remained absent. No new release build or native launch ran.

Evidence is at `tmp/fixtures/portable-real-candidate-sha256_98e4221900574da79982c6e5290f2af7/verification.json`. Documentation backup before recording this proof is `backups/pre_opencode_changes_20261129_011211_portable-real-candidate-proof`.

Pre-edit backups at `backups/pre_opencode_changes_20261129_010029_candidate-portable-exe-sha256` and `backups/pre_opencode_changes_20261129_010048_candidate-exe-recovery-record`.
