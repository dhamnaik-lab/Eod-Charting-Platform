# Adjustment-mode chart reload race - 29 October 2026

## Request and confirmed cause

The user's WIPRO screenshots showed an Adj toggle followed by `Chart Load
Failure` / `Chart data request was superseded`, sometimes naming AARTIPHARM.
The user authorized a fix with a pre-edit backup.

The chart and header remained WIPRO. Adj is an existing workspace-wide setting,
so its reload queue also reads other open instrument tabs. That explains why a
background tab can be named in a global error notification.

The controller saved `default_price_mode` asynchronously and immediately started
hydration. All `set_setting` calls were treated as price mutations by the IPC
adapter, so the preference save could invalidate the reads that the toggle just
started. The adapter threw an ordinary Error, and current tab hydration reported
it as a load failure. The prior candles remained, while the toolbar announced
success immediately. The inspected Rust `database/settings.rs::set_setting`
only writes the preference; it does not mutate quotes or emit `db:changed`.

Rapid toggles also left older sequential reload queues running. During regression
testing, a canceled comparison read exposed another issue on this path:
comparison hydration swallowed the error and returned empty comparison history,
preventing recovery and hiding genuine comparison failures.

## Implementation

- `src/platform/tauriDesktop.ts`: exempt only `set_setting` for
  `default_price_mode` from price-cache invalidation. Preserve invalidation for
  every other existing mutation/setting and the database-changed event.
- `src/platform/chartRequestErrors.ts`: typed obsolete-read cancellation and a
  shared bounded recovery helper. A still-current request retries once, joining
  newer data rather than force-invalidating it. Obsolete contexts are discarded
  by the existing tab/database/mode guards. Repeated interruption is a visible,
  descriptive error; recovery cannot loop indefinitely.
- `chartInstrumentHydrationService.ts`, `compareOverlayService.ts`: distinguish
  invalidated reads from source errors. Comparison hydration propagates errors
  to its owner rather than silently succeeding with empty data; genuine errors
  name the comparison instrument.
- `chartSnapshotHydrationService.ts`, `chartInstrumentCompareController.ts`:
  apply bounded cancellation recovery to hydration/manual loading while retaining
  ownership checks, cache generation checks and real failure handling. Genuine
  errors for inactive tabs explicitly say `background chart tab`.
- `chartTabSessionController.ts`: revision/context checks stop superseded mode
  queues before further reads or confirmation. Prioritize the initiating active
  tab, skip tabs already loaded in the requested mode, then hydrate background
  tabs. Confirm only when the current open instrument tabs have matching loaded
  modes and usable histories.
- `chartStore.ts`, `Toolbar.tsx`: move success notification from the click handler
  to verified reload completion. If displayed data has not loaded in the selected
  capital-adjustment mode, the tooltip describes the mode as requested.

Preserved: global adjustment behavior, capital/dividend/rights adjustment rules,
raw prices, backend approval/rechecks, bar/drawing coordinates, database/cache
transition guards, and the existing responsive/background preference save.

## Backup and validation

Pre-edit source/test/HANDOFF backup:
`backups/pre_opencode_changes_20261029_163343_adjusted_mode_reload_race`.
Other dirty-worktree changes were preserved.

PASS: 37 tests across:

- `src/platform/__tests__/chartDataIntegrity.test.ts`
- `src/features/charts/__tests__/chartRequestConsistency.test.ts`
- `src/components/__tests__/ToolbarAdjustedControls.test.tsx`

Command: `npx vitest run --exclude 'tmp/**'` with those three explicit paths.
Coverage includes pending reads during preference save, preserved invalidation
for other mutations, active/background loading order, delayed confirmation,
rapid ON/OFF/ON queues, obsolete completion, duplicate instrument tabs sharing
history, cancellation recovery for base and comparison reads, bounded recovery,
real background/comparison failures, existing database/tab ownership guards,
binary integrity and toolbar controls.

One added comparison-cancellation test initially failed because of the swallowed
error described above. That path was corrected; all 37 final cases passed.

PASS: renderer validation profile for affected source/test paths: TypeScript and
scoped whitespace. PASS: documentation references and scoped whitespace.

No production read/write workflow or real preference save was executed during
validation; IPC and setting writes were mocked. No Rust source edit/compilation,
database operation, quote download, release build, commit or push was performed.

## Native follow-up - 29 October 2026

After the user's rebuild, their native screenshots show WIPRO retained with the
other instrument tabs open, Adj OFF / `Raw unadjusted prices loaded`, and Adj ON /
`Capital adjustments loaded (Splits & Bonuses)`. The earlier superseded-request
failure notification is absent in those captures. The reported visible reload
failure is closed on that evidence.

Both captures also showed temporary `Loading DB...` / blank range. The user then
checked after restart and reported that this settles after a few seconds. Their
later screenshot shows green `EOD DATABASE` and range `1991-01-02` to `2026-10-26`.
That observation requires no additional status-display change.

Rapid ON/OFF/ON stress, hidden-tab loaded-state assertions, database switching
during pending reads and injected comparison/source failures remain automated-only;
the screenshots do not independently establish those cases or numerical adjustment
correctness for every historical bar. See the
[native closeout and preserved screenshots](2026-10-29_CHART_NATIVE_ACCEPTANCE_CLOSEOUT.md).
