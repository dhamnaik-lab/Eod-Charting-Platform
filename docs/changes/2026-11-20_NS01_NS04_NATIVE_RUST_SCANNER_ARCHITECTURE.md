# NS-01 → NS-04 — Opt-in Native Rust EOD Scanner Architecture

- **IST timestamp:** 2026-11-20 03:03 IST (implementation); record written 2026-11-20 03:05 IST (UTC+05:30)
- **Active workstream:** EOD Charting Platform (repository `dhamnaik-lab/Eod-Charting-Platform`)
- **Branch:** `arena/1a89772f-eod-charting-platform`
- **Base (verified accepted `main`):** `717eb6f00af96d8f717929eab2fc2d57cd7e5b6f` — "Merge pull request #123 from dhamnaik-lab/feature/rsc06-exhaustion-gap-20261120"
- **Gate status:** **NS-01, NS-02, NS-03 and NS-04 implemented. TypeScript gates PASS. `rustfmt --edition 2021 --check` PASS on all 10 native modules via hosted CI. `cargo check`/`cargo test`, Windows Tauri/portable and live UI acceptance are still BLOCKED/UNTESTED — see §7.**
- **Native default:** **OFF.** No production behaviour changes for a user who never opts in.

## 1. Objective

Complete the approved 18 November 2026 Native Rust Scanner architecture (NS-01 native core, NS-02 adjusted-price semantics, NS-03 job manager/IPC, NS-04 opt-in UI) as one reviewable branch, without changing the accepted TypeScript scanner default, alert behaviour, chart-pattern worker, the 54 chart-pattern definitions, or any user database / `.eod` file.

## 2. Authority verification (pre-edit)

- Repository root used for the work: repository checkout of `dhamnaik-lab/Eod-Charting-Platform` (the Windows root `E:\TA Projects\EOD Charting Platform` is not present in this environment).
- `git rev-parse HEAD` → `717eb6f00af96d8f717929eab2fc2d57cd7e5b6f`; branch `arena/1a89772f-eod-charting-platform`; working tree **clean** before edits.
- RSC-06 presence verified in the accepted base: `src-tauri-shell/src/scanner_exhaustion_gap.rs` exists (24,706 bytes), declared in `src-tauri-shell/src/main.rs`, merged by PR #123. `chart_exhaustion_gap` is therefore part of the native pattern set.
- Protected files: the four local-only audit/plan documents under `docs/audits/18-11-2026 Audit and Upgrade/`, the two modified generated files, and `docs/changes/2026-11-18_0356_IST_CA01_BSE_T0_CORPORATE_ACTION_ISOLATION.md` **do not exist in this checkout**; `.git/info/attributes` is also absent. Nothing matching those paths was created, modified or staged (verified by `git status`).
- Pre-edit hashes recorded in `tmp/fixtures/native_scan_ns01_ns04/pre-edit-hashes.txt` (see §6).

## 3. Files created / modified

### Created — TypeScript (contract, compiler, fixtures, tests, UI wiring)

| Path | Purpose |
| --- | --- |
| `src/features/scanner/nativeScanContract.ts` | Versioned (`v1`) transport contract, bounded validation (depth/nodes/rules/period/lookbacks/targets), capability descriptor, supported-pattern and pure-math helpers. No I/O. |
| `src/features/scanner/nativeScanAst.ts` | Scanner-only compiler (`Close[0]`, `ref(field, k)`, `sma/ema/rsi/atr/volumeSma`, `crossover/crossunder`, arithmetic/comparison/logical, pattern calls) producing strict JSON AST; reference evaluator that mirrors the existing formula engine; minimum-bar accounting; engine cross-check. |
| `src/features/scanner/__tests__/nativeScannerFixtureGenerator.ts` | Committed generator for the parity bundle; every engine-equivalent case is cross-checked against `evaluateCustomFormulaDefinition` before being written. |
| `src/features/scanner/fixtures/nativeScannerParityFixtures.v1.json` | Generated parity bundle: 3 bar sets, **15 numeric cases**, **11 compile cases**, **10 contract cases** — consumed by both TypeScript and Rust tests. |
| `src/features/scanner/__tests__/nativeScannerParityNS01.test.ts` | NS-01 TS gate: fixture reproducibility, numeric parity, compile diagnostics, contract validation, no-look-ahead, warm-up accounting (56 tests). |
| `src/platform/nativeScannerBridge.ts` | NS-04 platform boundary: capability read, `start_native_eod_scan`, `cancel_native_eod_scan`, run-scoped event subscription with `runId` + `sequence` guards. |
| `src/plugins/scanner/nativeScannerRun.ts` | NS-04 opt-in run adapter: native-only when every selected scanner is supported and no alert rules are configured; otherwise the whole run falls back to the preserved TypeScript runner. |
| `src/plugins/scanner/__tests__/nativeScannerRunNS04.test.ts` | NS-04 gate: gating, mixed/unsupported fallback, alert preservation, start-failure and error fallback, deduplicated ordering, honest status text (11 tests). |

### Created — Rust (`src-tauri-shell/src/native_scanner/`)

| Path | Purpose |
| --- | --- |
| `mod.rs` | Module wiring + `CONTRACT_VERSION`. No command is re-exported here. |
| `ast.rs` | Strict AST parse from untrusted JSON (`schemaVersion`, unknown fields, finite numbers, bounds, duplicate rules, unsupported patterns) and native evaluation (SMA/EMA/RSI/ATR/volumeSma, comparisons, crosses, division-by-zero = `null`). |
| `reader.rs` | Bounded, read-only `.eod` reader: header magic/version/record size/price scale, exact file length, identity match, monotonic dates, `high >= low`, `< 5000` bar window, as-of binary search. |
| `universe.rs` | Canonical target enumeration from `instruments` (never raw filenames); `activeNseEq` is exactly `series = 'EQ'`, `activeBse` preserves security codes. |
| `scan.rs` | Bounded executor: per-target outcome (`match` / `no-match` / `skipped` / `error`), warm-up skip (never a false no-match), history endpoint cap, cancellation checks, deterministic ordering. |
| `database_source.rs` | Read-only database source (`mode=ro` + `query_only`), identity string for event scoping. |
| `job.rs` | NS-03 registry: single active run, per-run `Arc<AtomicBool>`, idempotent cancel, `cancel_all`, batched `scan:match`, throttled `scan:progress`, exactly one terminal event, `runId`/`sequence`/DB identity on every payload. |
| `ipc.rs` | Tauri commands `start_native_eod_scan`, `cancel_native_eod_scan`, `native_scanner_capabilities`; setup and scanning both run in `spawn_blocking`; shared-use permit retained for the run and released in one finalization path. |
| `parity.rs` | Rust consumption of the committed TypeScript fixture bundle (numeric values, endpoints, minimum bars, contract decisions, no-look-ahead). |
| `tests.rs` | Cross-module integration tests against synthetic disposable SQLite + `.eod` fixtures (binary read, Hybrid fallback, as-of, adjusted split projection, executor counts). |

### Modified

| Path | Change |
| --- | --- |
| `src-tauri-shell/src/main.rs` | `mod native_scanner;`; `.manage(NativeScanState::default())`; three commands registered; `CloseRequested` cancels native runs before exit. |
| `src-tauri-shell/src/database.rs` | Re-exports `read_scan_bars_for_folder`, `ScanPriceBar`. |
| `src-tauri-shell/src/database/eod_data.rs` | Added the read-only `read_scan_bars_for_folder` gateway + `ScanPriceBar`; reuses `resolve_instrument_context`, `load_unified_price_rows`, `apply_corporate_adjustments`, `guard_index_previous_close`. Existing code paths unchanged. |
| `src-platform` bridge (`src/platform/tauriDesktop.ts`) | Exports `getTauriCore` and a narrow `getNativeTauriEvent` so native `invoke`/`listen` stay inside the platform boundary. |
| `src/platform/index.ts` | Re-exports the native bridge. |
| `src/components/ScannerWindow.tsx` | Opt-in "Use native (Rust) backend" checkbox (default OFF), capability/fallback note, native routing through the adapter, fallback-aware status text. TypeScript branch retained verbatim. |
| `.github/workflows/rustfmt-ci.yml` | Also formats-check `src-tauri-shell/src/native_scanner/**/*.rs`; existing `scanner_*.rs` coverage unchanged. |
| `HANDOFF.md` | New resume entry (above) + removed three non-portable local `tmp/` and audit-plan path references that break `check-doc-references.ps1` on a clean clone. |

## 4. Design decisions (conservative resolution of the plan's open gates)

- **Instrument coverage (gate A):** the fast reader is used only when identity and file validity can be proven; all production reads go through the accepted resolver (`resolve_instrument_context` + `load_unified_price_rows`), so Hybrid SQLite-only series and BSE security codes are supported. Any target that cannot be read becomes an explicit `skipped`/`error`, never a silent non-match or a dropped target.
- **Rule set (gate B):** numeric literals, OHLCV fields with non-negative lookback, bounded arithmetic/comparison/logical operators, SMA/EMA/RSI/ATR/volumeSma, crossover/crossunder, plus the four parity-proven gap patterns (Breakaway, Common, Runaway, Exhaustion). The other 50 pattern definitions and all core/signal/plugin scanners stay on TypeScript and are reported as TypeScript-only in the UI note.
- **Bracket syntax (gate C):** `Close[0]` / `High[1]` exist only in the **scanner-side** compiler. They translate to field lookback on the completed-bar window (`Close[k]` ≡ `ref(close, k)`); the formula editor and `ref()` path are untouched. Negative lookbacks, non-integer indexes, unknown functions, unsupported patterns and `ref(<computed series>, k)` are rejected with actionable messages.
- **Price basis (gate D):** `raw` is the compatibility default (matching `adjusted: false`). `adjusted` reuses `apply_corporate_adjustments` (prior-bar factor division, conditional volume/OI multiplication, `LEGACY_MUTATED` filtering, dividend combination, previous-close recompute). Dividend/rights flags require `adjusted`; conflicting flags are rejected at the boundary.
- **CA-01 (HOLD preserved):** this change adds **no** approval, factor inference, merging of duplicate adjustment rows, or `.eod` rewrite. It calls the existing projection exactly as `get_eod_data` does, so any ambiguity that fails closed there also fails closed here — surfaced as a per-target `error` diagnostic rather than an adjusted parity claim.
- **Reader (gate E):** buffered fixed-stride reads with checked offsets; **no `memmap2`**, no new dependency, no new Cargo target.
- **Database safety (gate F):** read-only connection (`mode=ro`, `PRAGMA query_only`); one connection per scan; no `rusqlite::Connection` crosses a worker boundary (target enumeration completes before the scan starts); shared-use permit retained for the whole run and released on finalization, cancel-all and window close.
- **Concurrency/performance (gate G):** bounded window (`MAX_WINDOW_BARS = 5000`) and bounded history endpoints (`MAX_HISTORY_ENDPOINTS = 1000`); worker count clamped 1..8 (default 2). **No speedup is claimed** — 1/2/4-worker benchmarking is blocked until a Cargo-capable Windows environment runs it.
- **IPC/UI (gate H):** versioned commands/events with `runId`, strictly increasing `sequence` and database identity; a single active run prevents double scans; all-or-nothing TypeScript fallback; **native runs never emit alerts** (alert rules force a full TypeScript fallback so alert history cannot change or double-count); existing `Show on Chart`, historical display, ordering and cancellation boundaries are untouched.

## 5. Behaviour changed vs preserved

**Changed (opt-in only):** with the new checkbox enabled *and* only parity-supported scanners selected *and* no alert rules configured, the ScannerWindow routes the run through Rust and displays a native status line. If native start/finish fails, the run is retried once through the existing TypeScript runner and the status says so (`Used the TypeScript scanner backend. …`).

**Preserved:** the TypeScript scanner remains the default and the sole backend for every unsupported rule; the 54 chart-pattern definitions, chart-pattern worker, core/signal/custom-formula/market-snapshot/external-plugin scanning, alerts and alert history, historical scoring, one-click Show on Chart, ScannerWindow selection/progress/cancellation/results, workspace, NSE/BSE identities, quote/chart behaviour, `nseEquity` (EQ/BE/BZ/SM/ST/SZ) and all DB/CA semantics are unchanged. No data migration, no CA approval, no quote update, no `.eod` write.

## 6. Commands and results — executed in this environment

| # | Command | Result |
| --- | --- | --- |
| 1 | `npx vitest run --exclude 'tmp/**'` (after change) | **PASS** — 285 files / **2006 passed, 1 skipped (2007 tests)** (final full-suite re-run after the two opt-in safety tests were added); baseline before the change: 283 files / 1939 passed + 1 skipped (1940). |
| 2 | `npx vitest run src/features/scanner/__tests__/nativeScannerParityNS01.test.ts` | **PASS** — 56/56 |
| 3 | `npx vitest run src/plugins/scanner/__tests__/nativeScannerRunNS04.test.ts` | **PASS** — 11/11 |
| 4 | `npx tsc -p tsconfig.json --noEmit` (`typecheck:renderer`) | **PASS** — exit 0 |
| 5 | `npm run build:renderer` | **PASS** — `built in 7.67s` (exit 0) |
| 6 | Fixture regeneration (`npx vitest run --config tmp/disposable/native_scan_gen/vitest.config.ts`) | **PASS** — 1/1, bundle rewritten deterministically |
| 7 | Doc-reference mirror of `scripts/check-doc-references.ps1` (Python re-implementation: same required targets, stale-root and backticked-path rules) | **PASS** — no missing references (three pre-existing non-portable `tmp/` and audit-plan references in `HANDOFF.md` were removed in this change) |
| 8 | `git status` / `git diff --check` | **PASS** — no whitespace errors; changed-file list reviewed against §3 |

### Hosted CI evidence (executed, PR #124)

| Check | Run | Result |
| --- | --- | --- |
| Rustfmt (scanner and native scanner modules) | [run 44621737716](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44621737716) | **PASS** — 8s, hosted `ubuntu-latest`, `rustup stable rustfmt --edition 2021 --check` over the root `scanner_*.rs` modules **and all 10 `native_scanner/**/*.rs` files** |
| Renderer tests, typecheck, build | [run 44621737653](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44621737653) | **PASS** — 1m46s |

Two findings came out of this, both fixed on the branch:

1. **The CI-01 rustfmt gate was a false pass for nested modules.** `shopt -s nullglob` without `globstar` makes `src-tauri-shell/src/native_scanner/**/*.rs` expand to **zero** files, so the gate reported success while checking only the root-level `scanner_*.rs` modules. Fixed by adding `globstar` plus an explicit "nested module glob must not be empty" guard that fails the job. Verified locally: 0 files without `globstar`, 10 files with it.
2. **All 10 native modules were format-dirty.** rustfmt **parsed every file successfully** (it emitted formatting hunks, not syntax errors), which is the first evidence that the Rust sources are at least syntactically valid and macro-balanced. The exact patch was produced by stable rustfmt on the hosted runner and applied verbatim in commit "NS-01..NS-04: apply stable rustfmt to the native scanner modules" — formatting only (9 files, +271/−127, no logic, signature or behaviour change).

What this still does **not** prove: type checking, borrow checking, trait resolution, or that the tests pass. `rustfmt` does not compile code. Those remain in §7.

### Not executed here (and why)

| Command | Status |
| --- | --- |
| `rustfmt --edition 2021 --check src-tauri-shell/src/native_scanner/*.rs` | **PASS via hosted CI** ([run 44621737716](https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/44621737716)); not runnable inside this sandbox (no toolchain, `static.rust-lang.org`/`sh.rustup.rs` unreachable), so the authoritative result is the CI job. |
| `Invoke-EOD-SharedCargo.ps1 -Mode Preview/-Mode Run -CargoAction check` / `test -- native_scanner` | **BLOCKED** — requires the Windows root `E:\TA Projects\EOD Charting Platform`, a Rust toolchain, the msrv-locked offline registry and the shared root `target`. |
| Full Rust regression (`cargo test`) | **BLOCKED** — same reason. |
| `npm run tauri:check`, portable Windows build, live UI acceptance, disposable-DB validation | **BLOCKED/UNTESTED** — needs approved Windows hardware. **No agent-run smoke is claimed.** |
| PowerShell parser checks (`Invoke-EOD-SharedCargo.ps1`, `check-doc-references.ps1`, TMP lifecycle) | **BLOCKED** — PowerShell is unavailable; no PowerShell file was modified in this change, so the existing parsers are unaffected. |
| 1/2/4-worker benchmark | **BLOCKED** — requires the Windows corpus and a built binary; no performance number is published. |

## 7. Exact Windows validation steps (first action on approved hardware)

Run from `E:\TA Projects\EOD Charting Platform`, serially, after the branch is checked out:

```powershell
# 1. Format gate (must pass before publication review)
rustfmt --edition 2021 --check `
  src-tauri-shell\src\native_scanner\mod.rs `
  src-tauri-shell\src\native_scanner\ast.rs `
  src-tauri-shell\src\native_scanner\reader.rs `
  src-tauri-shell\src\native_scanner\universe.rs `
  src-tauri-shell\src\native_scanner\scan.rs `
  src-tauri-shell\src\native_scanner\database_source.rs `
  src-tauri-shell\src\native_scanner\job.rs `
  src-tauri-shell\src\native_scanner\ipc.rs `
  src-tauri-shell\src\native_scanner\parity.rs `
  src-tauri-shell\src\native_scanner\tests.rs

# 2. BUILD-01 shared Cargo, preview then run
.\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Preview -CargoAction check
.\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run     -CargoAction check
.\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Preview -CargoAction test -CargoArguments @('native_scanner')
.\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run     -CargoAction test -CargoArguments @('native_scanner')
.\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Preview -CargoAction test
.\scripts\Invoke-EOD-SharedCargo.ps1 -Mode Run     -CargoAction test

# 3. Renderer gates
npm.cmd run typecheck:renderer
npm.cmd test
npm.cmd run build:renderer

# 4. Native/Windows shell checks
npm.cmd run tauri:check
```

Expected first-run risks (documented, not hidden):

- `parity.rs` reads the committed bundle with `#[serde(rename_all = "camelCase")]`; any field rename in the generator must be mirrored there.
- `tests.rs` builds a minimal schema (`instruments`, `eod_prices`, `settings`, `corporate_actions`, `instrument_identity_history`) that must match the columns the shared `eod_data` resolver reads.
- `eod_data.rs`'s `ScanPriceBar`/`read_scan_bars_for_folder` are new public items; if the crate treats `pub` re-exports as dead code, add `#[allow(dead_code)]` at the re-export rather than removing the item.

## 8. Disposable evidence and integrity

- Evidence workspace (TMP-01, intentionally **not** committed): `tmp/fixtures/native_scan_ns01_ns04/` containing `base-head.txt`, `pre-status.txt`, `pre-edit-hashes.txt`; fixture generator config in `tmp/disposable/native_scan_gen/`.
- No production/user database was opened; **no** `.eod` file, DB, or corporate-action row was created or modified by this change. All Rust integration tests create their own synthetic SQLite/`.eod` fixtures under the OS temp directory and delete them on drop.
- Pre-edit SHA-256 (unchanged by this change): `gaps.ts` `f343d977…8cca`, `scanner_breakaway_gap.rs` `6f5ad219…c8a4f`, `src-tauri-shell/Cargo.lock` `fb8f12ed…f499`, `package-lock.json` `08a6f8c5…c66d`, `ScannerWindow.tsx` `9c034357…f98` (full values in `tmp/fixtures/native_scan_ns01_ns04/pre-edit-hashes.txt`). `Cargo.toml`/`Cargo.lock` were **not** touched: no dependency was added (`rayon`, `memmap2` remain absent).

## 9. Dependencies and approvals

- **No new dependency.** No `rayon`: the executor uses a bounded sequential loop with per-run cancellation, which is safe, deterministic and leaves migration to a pool an explicit follow-up requiring approval plus Windows benchmarks. No `memmap2`. No Cargo network retrieval needed (`--offline --locked` unchanged).
- No approval-bypass, no CA change, no binary chart IPC, no Canvas/renderer work, no plugin-loader redesign.

## 10. Risks and rollback

- **Risk:** Rust code is uncompiled here; compile/format/test failures are possible on first Windows run. Mitigation: strict typing, exhaustive in-module tests, fixture parity, and the explicit step list in §7.
- **Risk:** the native reader/gateway reads production EOD data read-only; a defect could misreport a match. Mitigation: identity/length/monotonic-date validation, explicit `skipped`/`error` classification, all-or-nothing fallback, and no alert emission from the native path.
- **Rollback:** revert the branch (single squashed revert). The TypeScript path is untouched and native is OFF by default, so reverting restores byte-identical default behaviour even while the branch is checked out.

## 11. Next steps

1. Run §7 on approved Windows hardware; fix any compiler/format/test findings.
2. Disposable-DB validation: create `tmp/disposable/native_scan_ns01_ns04_<timestamp>/`, copy a synthetic DB, run a native scan with only gap patterns selected, verify counts (`match`/`no-match`/`skipped`/`error`), ordering, cancellation and that a mixed selection falls back with a visible notice.
3. Benchmark 1/2/4 workers on the synthetic corpus before any performance claim.
4. Only after acceptance, consider moving the executor to a bounded worker pool and widening the native rule set — both need separate approval.
