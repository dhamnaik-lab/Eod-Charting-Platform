# EOD Charting Platform UX audit completion candidate

17 November 2026 IST. **MANUAL_VISUAL_ACCEPTANCE=PENDING**.

## Source authority and preservation

- The GitHub connector's compare endpoint returned `identical` for [the pinned merge](https://github.com/dhamnaik-lab/Eod-Charting-Platform/commit/3950985f7c47bc60ff87728a60245a3cc62bf55d) and current `main`. The merge tree matches local F-58 branch head `3feb494319302700bf10ecad70984c78d3c72b66`. The package's original audit used `ca1cd936350faaa2e8eb23ea6d1de08c0dd979ae`.
- Candidate worktree `E:\TA Projects\EOD Charting Platform\tmp\UX_Audit_Completion_20261117_IST`, branch `codex/ux-audit-completion-20261117`. The pinned SHA identifies the base. The release is built from the local uncommitted changes, identified by [source file hashes](SOURCE_SHA256.csv).
- Package SHA-256 `109c6b35a651fe33fc44afe7be04545db9d7738e94319677d82312ae07bc7c2d`. All nine ZIP manifest entries matched their hashes and lengths. The 76 audit HTML IDs match the tracker IDs.
- Four pre-existing local documentation modifications were verified byte-for-byte against `backups/pre_opencode_changes_20261117_113744_ux_audit_original_local_docs/UX_AUDIT_SHA256.txt` in the primary checkout. The primary checkout remains on the F-58 branch. This candidate contains no new commit, PR, GitHub CI run or merge.
- The local renderer dependency directory and project-root Cargo artifacts were reused. The exact shared Cargo wrapper requires the primary checkout path, so the candidate validation uses its own manifest with `CARGO_TARGET_DIR` pinned to the same physical project-root target. The candidate has its own dist and release staging paths. Production data and database configuration were outside the run.

## Findings

| Disposition | Count |
|---|---:|
| Fixed and validated | 21 |
| Already fixed and verified | 13 |
| Not applicable with evidence | 2 |
| Architecture approval pending | 24 |
| Deferred with reason | 16 |
| Blocked with reason | 0 |
| **Total** | **76** |

The [finding tracker](FINDINGS_TRACKER.csv) records current source locations, the unchanged original finding text, and focused evidence. Five deferred findings have bounded improvements in this candidate. F-27 adds commands, F-29 removes an unused subscription, F-30 adds the Volume Surge view and exchange selection, F-63 adds targeted contrast checks, and F-74 improves names and reduced motion for favorite tools. Each tracker row names its remaining gap. The preclassified gates include proposed contracts and compatibility/rollback notes. FT-01 through FT-26 remain a separate feature inventory.

## Validation

Logs are under `tmp/ux-audit-evidence` in the candidate worktree. All times in change records are IST.

| Command | Baseline | Final candidate | Evidence |
|---|---|---|---|
| `npm.cmd test` | PASS · 1,862 passed, 1 skipped | PASS · 1,884 passed, 1 skipped, 0 failed across 273 files | `baseline-vitest.log`, `candidate-vitest.log` |
| `npm.cmd run typecheck:renderer` | PASS | PASS after JSX correction | `baseline-typecheck.log`, `corrected-typecheck-renderer.log` |
| `npm.cmd run build:renderer` | PASS | PASS after JSX correction | `baseline-renderer.log`, `corrected-build-renderer.log` |
| `npm.cmd run tauri:check` | — | PASS · one existing dead-code warning | `candidate-tauri-check.log` |
| `cargo test --offline --locked --manifest-path src-tauri-shell/Cargo.toml daily_market_snapshot::tests` | — | PASS · 3 passed, 0 failed, 0 ignored, 1,328 filtered | `candidate-cargo-movers.log` |
| `cargo test --offline --locked --manifest-path src-tauri-shell/Cargo.toml database_deletion::tests` | — | PASS · 11 passed, 0 failed, 0 ignored, 1,320 filtered | `candidate-cargo-deletion.log` |
| `npm.cmd run tauri:portable:win` | — | PASS · one build, 2 min 54 sec release compile, one existing Rust warning | `candidate-portable.log` |
| `scripts/validate-change.ps1 -Profile docs` | — | PASS after copying three referenced historical Markdown reports into the candidate's ignored `tmp` directory | `candidate-docs.log`, `candidate-docs-rerun.log` |

The first integrated renderer typecheck/build caught a missing JSX brace in F-37. The correction was followed by green typecheck/build and a fresh full Vitest run. The first F-05 regression included an implementation-specific assertion. It now checks that price overlays still format prices separately from volume panes. The focused logs also retain deliberate failure-before runs for the Eikon hierarchy, audited accent buttons and cursor anchoring. Waves 2 and 3 shared the intermediate renderer build and typecheck. Later waves used focused checks and the final combined regression. Wave 2 readout changes were revisited after the later wave review and included in the final regression.

Windows build **20261117.121028** is staged at `release/tauri-portable-win/EOD Chart Portable` within the candidate worktree. Executable SHA-256 is `FC018B18B14090BBEEF77C334C43A78314C084CBBCB9D682EDCCD88B1CE2AEE8`. All 32 staged renderer files matched `dist` by SHA-256. [Portable file hashes](PORTABLE_SHA256.csv).

The four original documents and both existing portable executables matched their pre-build hashes after staging. Cargo/Tauri regenerated metadata and rewrote line endings on three other build files in the candidate. These outputs are captured under `tmp/ux-audit-evidence/build-generated` and the four candidate source files were restored to the pinned base. The preserved portable has its own build number and verification manifest. See the [portable build record](../../changes/2026-11-17_1210_IST_UX_PORTABLE_CANDIDATE.md).

## Manual Windows checklist

Open `Launch Portable EOD Chart.cmd` from the candidate directory. The launcher uses its own portable state directory. The app-level profile can still default to `Documents/EOD Chart Profile`, so verify the selected profile before testing persistent settings. Record each observation before marking manual acceptance.

1. Check all seven themes. In Charcoal and Eikon, inspect dim/muted text, accented buttons, axis and crosshair labels, keyboard focus and reduced motion. Resize the window with Favorites near the bottom and right edge.
2. Check OHLCV on selected and last visible bars, zero and unavailable volume, signed compact pane values, collapsed studies and the View menu toggle. Expand studies on a chart with eight overlays and save a PNG. Check a shallow price pane for the overflow count.
3. Check Chart Settings Cancel, OK, Close and Escape. In Application Settings, Reset to Theme then Cancel, then repeat and Save. In the indicator picker navigate results by arrows, add with Enter and verify favorites still work.
4. Check Auto-Tile with one through six charts, active tile selection, maximize/restore and reopening a workspace. In an unpinned sidebar, use Market Movers filters/context menu and verify clicks inside the chart still collapse the sidebar. Check Full View price movers, Volume Surge, exchange change, result dates and open-in-new-tab behavior.
5. In a chart with 20+ years of daily bars, wheel zoom with the pointer left, center and right. Test pan inertia, the right-edge zoom buttons, first/last bounds and holiday gaps. Check pane-resize arrows, modal Escape, modeless window movement and fullscreen Commands.
6. Observe scanner and crosshair responsiveness on Windows. Native behavior and performance require operator observations. Give separate approval for work that would write to a database.

## Risks

- The remaining 24 architecture-gated findings and 16 deferrals keep the overall audit open. The native window/menu redesign, scanner worker unification, persisted layout changes and effective-dated universe data are still pending.
- Inertia and pane spacing affect canvas behavior which the renderer checks cover only indirectly. Full View retains its existing paging and the existing compact-only filters. Export row capacity depends on chart dimensions, legend state and available width.
- The package reports earlier F-58 native signoff while the current local handoff says it was pending. This candidate's native acceptance is pending regardless of the older result.

## Files changed

- [Source SHA-256 manifest](SOURCE_SHA256.csv) lists the modified and added renderer code and focused tests. [Finding tracker](FINDINGS_TRACKER.csv) maps exact paths to changes and preserves the original inventory.
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md` documents the Reset to Theme flow. Seven source records and one portable build record under `docs/changes` include IST timestamps, evidence and rollback. `HANDOFF.md` and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` in the candidate describe the resume point.

## Next steps

1. Complete the Windows checklist and record visual acceptance for this executable hash.
2. Review the local diff and choose which architecture gates to approve. Publication and merging into main are separate decisions.

