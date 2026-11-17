# EOD Charting Platform UX audit completion candidate

17 November 2026 IST. **MANUAL_VISUAL_ACCEPTANCE=PENDING**.

## Source authority and preservation

- The GitHub connector's compare endpoint returned `identical` for [the pinned merge](https://github.com/dhamnaik-lab/Eod-Charting-Platform/commit/3950985f7c47bc60ff87728a60245a3cc62bf55d) and current `main`. The merge tree matches local F-58 branch head `3feb494319302700bf10ecad70984c78d3c72b66`. The package's original audit used `ca1cd936350faaa2e8eb23ea6d1de08c0dd979ae`.
- Candidate worktree `E:\TA Projects\EOD Charting Platform\tmp\UX_Audit_Completion_20261117_IST`, branch `codex/ux-audit-completion-20261117`. The pinned SHA identifies the base. The release is built from the local uncommitted changes, identified by [source file hashes](SOURCE_SHA256.csv).
- Package SHA-256 `109c6b35a651fe33fc44afe7be04545db9d7738e94319677d82312ae07bc7c2d`. All nine ZIP manifest entries matched their hashes and lengths. The 76 audit HTML IDs match the tracker IDs.
- Four pre-existing local documentation modifications were verified byte-for-byte against `backups/pre_opencode_changes_20261117_113744_ux_audit_original_local_docs/UX_AUDIT_SHA256.txt` in the primary checkout. The primary checkout remains on the F-58 branch. The initial candidate was subsequently published as [draft PR #116](https://github.com/dhamnaik-lab/Eod-Charting-Platform/pull/116) at `a40bf6142f00cf0ce724cad2e98172b252595691`. The independent-audit corrections build on that commit.
- The local renderer dependency directory and project-root Cargo artifacts were reused. The exact shared Cargo wrapper requires the primary checkout path, so the candidate validation uses its own manifest with `CARGO_TARGET_DIR` pinned to the same physical project-root target. The candidate has its own dist and release staging paths. Production data and database configuration were outside the run.

## Findings

| Disposition | Count |
|---|---:|
| Fixed and validated | 21 |
| Already fixed and verified | 13 |
| Not applicable with evidence | 2 |
| Architecture approval pending | 25 |
| Deferred with reason | 15 |
| Blocked with reason | 0 |
| **Total** | **76** |

The [finding tracker](FINDINGS_TRACKER.csv) records current source locations, the unchanged original finding text, and focused evidence. Five deferred findings have bounded improvements in this candidate. F-27 adds commands, F-29 removes an unused subscription, F-30 adds the Volume Surge view and exchange selection, F-63 adds targeted contrast checks, and F-74 improves names and reduced motion for favorite tools. Each tracker row names its remaining gap. The preclassified gates include proposed contracts and compatibility/rollback notes. FT-01 through FT-26 remain a separate feature inventory.

**Post-merge F-11 update (17 November 2026 IST):** This table is the current tracker status after draft PR #117 retired the orphan `OhlcvBar`. The accepted PR #116 snapshot remains **20 fixed and validated, 16 deferred**; the F-11 follow-up changes the active totals to **21 fixed and validated, 15 deferred**, with all 76 findings reconciled. The active `ChartPriceLegendOverlay` and menu flag are unchanged. The new sub-₹1 reference-close regression was included in [Renderer CI run 44069641820](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44069641820), which passed 1,886 tests, 1 skipped, TypeScript and Vite build. This does not imply an F-11 native build or any change to the accepted PR #116 portable.


## Original candidate validation

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

## Independent-audit corrections

The pasted findings supplied the criteria. The standalone independent report was unavailable in the checked audit and Downloads locations.

- **IA-01 / F-05.** Compact volume labels remain. `measureDynamicAxisWidth` pools price and expanded-pane labels into a shared width. F-05 is partially resolved and recorded as `ARCHITECTURE_APPROVAL_PENDING`. Per-pane widths require approval for plot alignment, crosshair and hit testing, axis interactions, export and resize. The shared layout is the rollback baseline.
- **IA-02 / F-10.** The on-screen legend shows five items and the number omitted. The export snapshot retains all eight studies in the regression. The renderer still reserves an overflow row for a shallow pane. Settings, visibility and removal actions remain available on the displayed rows.
- **IA-03 / F-37.** The mounted test used the actual RootApp, Sidebar, Market Movers panel and DOM portals. Sidebar and main are React siblings. The portal events follow the Sidebar ancestry, outside main's capture handler. Filter editing, Cancel, Apply, the context-menu action and true main-content collapse passed. The test supplies fixture market data and stubs desktop initialization and instrument loading. The existing application event code was retained.
- **IA-04 / F-43.** Inertia can reuse a clean render state with matching dimensions. Cache invalidation or a size mismatch can rebuild state and remeasure the shared axis. Frame regressions passed. Native timing remains unmeasured and the implementation was retained.

### Follow-up validation

Logs are under `tmp/ux-audit-evidence` in the PR checkout. The [change record](../../changes/2026-11-17_1323_IST_PR116_INDEPENDENT_AUDIT.md) lists the focused commands. Full validation and packaging used a separate build worktree from the published head plus the five scoped source and test files.

| Check | Result | Log |
|---|---|---|
| Focused legend and export tests | 1 expected failure before the fix, 12 passed after it | `ia02-before.log`, `ia02-after.log` |
| Focused pane formatting, scheduling and scale tests | PASS · 17 passed | `ia01-ia04-focused.log` |
| Mounted Market Movers browser regression | PASS · 1 scenario including edit, Cancel, Apply, context menu and main-content collapse | `ia03-browser-fixture.log` |
| `npm.cmd test` | PASS · 1,885 passed, 1 skipped, 0 failed across 273 files | `ia-full-vitest.log` |
| `npm.cmd run typecheck:renderer` | PASS | `ia-renderer-typecheck.log` |
| `npm.cmd run build:renderer` | PASS | `ia-renderer-build.log` |
| `npm.cmd run tauri:check` | PASS · one existing dead-code warning | `ia-tauri-check.log` |
| `npm.cmd run tauri:portable:win` | PASS · 2 min 39 sec release compile, one existing dead-code warning | `ia-portable-build.log` |
| `scripts/validate-change.ps1 -Profile docs` | PASS | `ia-docs.log` |

The original targeted Rust results apply to the prior build. This follow-up changes renderer code and browser tests. All 42 source and test paths matched the build inputs after Git checkout line-ending normalization. Four previously added tests had line-ending-only differences. SHA-256 of the [source manifest](SOURCE_SHA256.csv) is `a397937f1af6042cd4bd06fbbf7d959eb822c98c3125a47a5588e4bf18a7d469`.

Windows build **20261117.132233** is in `E:\TA Projects\EOD Charting Platform\tmp\UX_Audit_PR116_IA_20261117_IST\release\tauri-portable-win\EOD Chart Portable`. Its executable SHA-256 is `FEFD9349999F130BEC6DB560F7F82C2AAEB89A2285F9EB558033D936514E5633`. All 32 staged renderer files matched the new `dist`. [New portable hashes](PORTABLE_IA_SHA256.csv).

The four original modified documents, the two primary-checkout portables, and the previous candidate portable matched their recorded hashes. The earlier portable and [its manifest](PORTABLE_SHA256.csv) remain available.

## Manual Windows checklist

Open `Launch Portable EOD Chart.cmd` from the new independent-audit portable directory. The launcher uses its own portable state directory. The app-level profile can still default to `Documents/EOD Chart Profile`, so verify the selected profile before testing persistent settings. Record each observation before marking manual acceptance.

1. Check all seven themes. In Charcoal and Eikon, inspect dim/muted text, accented buttons, axis and crosshair labels, keyboard focus and reduced motion. Resize the window with Favorites near the bottom and right edge.
2. Check OHLCV on selected and last visible bars, zero and unavailable volume, signed compact pane values, collapsed studies and the View menu toggle. Expand the legend on a chart with eight overlays, verify five on-screen rows and `+3 more`, and save a PNG with all eight rows in a tall price pane. Check a shallow pane for export overflow.
3. Check Chart Settings Cancel, OK, Close and Escape. In Application Settings, Reset to Theme then Cancel, then repeat and Save. In the indicator picker navigate results by arrows, add with Enter and verify favorites still work.
4. Check Auto-Tile with one through six charts, active tile selection, maximize/restore and reopening a workspace. In an unpinned sidebar, use Market Movers filters/context menu and verify clicks inside the chart still collapse the sidebar. Check Full View price movers, Volume Surge, exchange change, result dates and open-in-new-tab behavior.
5. In a chart with 20+ years of daily bars, wheel zoom with the pointer left, center and right. Test pan inertia over long history with several active studies. Repeat while resizing a pane and the app window, and check for hitching and axis-width jumps. Test the right-edge zoom buttons, first/last bounds and holiday gaps. Check pane-resize arrows, modal Escape, modeless window movement and fullscreen Commands.
6. Observe scanner and crosshair responsiveness on Windows. Native behavior and performance require operator observations. Give separate approval for work that would write to a database.

## Risks

- The remaining 25 architecture-gated findings and 16 deferrals keep the overall audit open. The native window/menu redesign, scanner worker unification, persisted layout changes and effective-dated universe data are still pending.
- Inertia and pane spacing affect canvas behavior which the renderer checks cover only indirectly. Full View retains its existing paging and the existing compact-only filters. Export row capacity depends on chart dimensions, legend state and available width.
- The package reports earlier F-58 native signoff while the current local handoff says it was pending. This candidate's native acceptance is pending regardless of the older result.

## Files changed

- [Source SHA-256 manifest](SOURCE_SHA256.csv) lists the modified and added renderer code and focused tests. [Finding tracker](FINDINGS_TRACKER.csv) maps exact paths to changes and preserves the original inventory.
- `ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md` documents the Reset to Theme flow. The original change records and the independent-audit record include IST timestamps, evidence and rollback. `HANDOFF.md` and `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` in the candidate describe the resume point.

## Next steps

1. Complete the Windows checklist and record visual acceptance for this executable hash.
2. Review the local diff and choose which architecture gates to approve. Publication and merging into main are separate decisions.

