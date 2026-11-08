# B06 — Prevent workspace autosave from invalidating EOD price cache

**IST timestamp:** 2026-11-08 10:13 IST (UTC+05:30)
**Active workstream:** EOD Charting Platform only
**Authorized Windows project root:** `E:\TA Projects\EOD Charting Platform` (not accessed; GitHub-only changes)
**Repository:** `dhamnaik-lab/Eod-Charting-Platform`
**Pinned baseline:** GitHub `main` `f43ed64e5b4bdc6a6866aca03ea9b927fdcfabda`, tree `92bfb4c7ea35994547f71c76a933f2baf0511c01`
**Tracking:** issue #35 (B06), master register #28, draft PR #76
**Branch:** `fix/b06-workspace-eod-cache-invalidation-20261108`
**First CI-tested commit:** `6dce5dcbbf47221120bbc90c32cb1c91ac72e7e9`

## Objective and verified previous defect

Chart-workspace autosave (`src/store/chartStore.ts` `scheduleWorkspaceAutosave`) calls `writeWorkspaceLayoutSetting`, which writes the exact `workspace.chartLayout.v1` setting via the desktop `set_setting` bridge. `src/platform/tauriDesktop.ts` previously treated **every** successful `set_setting` as an EOD data mutation except the existing `default_price_mode` preference. It ran `invalidateTauriEodDataCache()`, incrementing the price-cache generation and clearing cached and in-flight EOD requests. A pending chart-price read could therefore throw `ChartDataRequestSupersededError` when a layout autosave completed, even though the save never changed market prices.

## Confirmed source authority / files inspected

- `src/platform/tauriDesktop.ts`: exact command-classification Set, cache-generation and request-revision guards, force reload, binary decoding, request de-duplication and invalidation after successful Tauri writes.
- `src/features/workspace/workspaceService.ts`: persisted setting key and desktop `setSetting` call.
- `src/store/chartStore.ts`: debounced (260 ms) workspace autosave, serialized chart layout and explicit save path.
- `src/platform/__tests__/chartDataIntegrity.test.ts`: existing mocked Tauri IPC cache/force-reload/invalidation regression harness.
- `src/features/charts/__tests__/chartRequestConsistency.test.ts`, `src/features/workspace/__tests__/workspacePersistence.test.ts` and the chart runtime workspace context.
- `src-tauri-shell/src/database/settings.rs` read-only check: `set_setting` validates and writes a settings row; this command itself has no `db:changed` event emit in that function. No Rust source changed.
- Reverified newest GitHub `main` and open issue #35 prior to branching. The old issue baseline `44bbf212...` was **not** used as current authority.

## Bounded implementation / files changed

- **Created:** `src/platform/workspaceSettingKey.ts` — canonical `WORKSPACE_SETTING_KEY` constant with the unchanged value `workspace.chartLayout.v1`.
- **Modified:** `src/features/workspace/workspaceService.ts` — import that shared key for read/write and re-export it at the prior public module path for compatibility. The `getSetting`/`setSetting` calls and payloads are otherwise unchanged.
- **Modified:** `src/platform/tauriDesktop.ts` — allowlist only the existing `default_price_mode` and the shared workspace key as **non-price-mutating** setting writes. All other `MUTATING_EOD_COMMANDS`, including unknown settings, keep original invalidation semantics. The exemption is tested after successful `invoke` and does not affect write persistence, default-price preference behavior or any other commands.
- **Modified:** `src/platform/__tests__/chartDataIntegrity.test.ts` — seven added focused cases: repeated workspace autosave with a pending deduplicated EOD read; cached data after a workspace save; unrelated-setting, quotation-upsert, active-DB and corporate-action invalidation; and a workspace autosave followed by a quote deletion. The original default-price-mode, unknown-setting, binary decoding, cache and forced-read tests remain intact.
- **Created:** `docs/changes/2026-11-08_1013_IST_B06_WORKSPACE_EOD_CACHE_INVALIDATION.md` — this maintained change record.
- **Not changed:** Rust/Tauri settings persistence, EOD price algorithms, price adjustment calculations, chart request ownership, cache key/revision/limit, quote editor, corporate-action implementation, database code/data, imports, UI components, dependencies/lock files, other workstreams or B07.

## Exact changed behavior

- Successful writes of `workspace.chartLayout.v1` no longer advance the EOD IPC cache generation, evict a cached OHLC response, or supersede/de-duplicate pending chart-data requests. The serialized workspace is still written using the same Tauri command/payload.
- The previously exempt `default_price_mode` preference remains exempt.
- All **other** successful `set_setting` writes remain conservatively invalidating, including potentially price-related or unknown keys.
- Existing quote mutation, corporate-action apply, database switch, storage-related and other listed EOD mutation commands still invalidate prices and supersede pending requests. Subsequent fresh EOD reads can complete and cache successfully.
- `forceReload`, stale-response rejection, in-flight request ownership, cache size/binary data integrity and workspace save/load semantics remain unchanged.

## Actual validation — first full GitHub Actions run

**Run:** https://github.com/dhamnaik-lab/Eod-Charting-Platform/actions/runs/42447820182
**Exact tested head:** `6dce5dcbbf47221120bbc90c32cb1c91ac72e7e9`.

| Check | Confirmed first-run output |
|---|---|
| GitHub checkout / Node.js 24 / `npm ci` | **PASS** |
| `npm test` — complete Vitest | **PASS**: 226 files passed, 1 skipped; 1,513 tests passed, 1 skipped, 0 failed |
| `src/platform/__tests__/chartDataIntegrity.test.ts` | **PASS: 19/19** (602 ms) |
| Existing `chartRequestConsistency.test.ts` | **PASS: 23/23** (435 ms) |
| Existing `workspacePersistence.test.ts` | **PASS: 5/5** (8 ms) |
| `npm run typecheck:renderer` | **PASS** |
| `npm run build:renderer` | **PASS** (Vite built in 6.78 seconds) |
| Standalone focused invocation | **NOT RUN**; focused suites were run within complete Vitest |
| Windows portable/native, Rust tests, real database and installed chart reload/manual checkpoint | **NOT RUN** (GitHub renderer scope) |

**Final documentation-commit gate:** This change record adds another Git commit. Reverify GitHub Actions on the exact final PR head before recommending merge. Do not treat the first-run evidence above as testing the later documentation SHA.

## Risks, limitations and preservation

- This only corrects an EOD IPC invalidation classification. It does not add cache-generation instrumentation or modify the upper instrument data cache. Existing higher-layer request ownership and force-reload tests remain the safeguard.
- Tests use a mocked Tauri IPC bridge. Native Windows background concurrency, actual database timing, manual workspace reload and portable packaging were not tested; a user GUI acceptance checkpoint remains outstanding.
- `default_price_mode` remains separately defined in database settings code, with its existing exemption preserved. Other, possibly harmless, keys still invalidate conservatively; do not broaden the allowlist without separately tracing their effect on EOD prices.
- Sharing the workspace constant prevents the exemption from drifting if the specific persisted key is later renamed. The workspace service re-export keeps callers' imports intact.
- Neither failure response handling nor generic settings persistence was changed. No new dependencies, network retrieval, DB access or unrelated source cleanup occurred.
- The existing one skipped Vitest is unchanged.

## Rollback, acceptance and next step

Before merge, close draft PR #76 without altering GitHub `main`. If merged later, revert only this bounded B06 change through an approved reviewed PR, keeping newer unrelated commits intact. Guard source authority and CI on the final documentation commit. Issue #35 stays **OPEN** until explicit user merge approval and independent post-merge verification; update the master audit register with real outcomes. B07 is not part of the approved batch and has not started.
