# Application design audit architecture review

Update, 15 November 2026: the [bounded pass](../changes/2026-11-15_2019_IST_AUDIT_BOUNDED_UI_PERFORMANCE.md) implements transient hover, modal/tab/window fixes, demand-driven frames, indicator-bundle reuse and blocking-worker symbol dispatch. Automated and isolated-browser checks passed; rebuilt-portable acceptance remains open. ISSUE-08 and ISSUE-10 decisions below are unchanged.

## ISSUE-03 and ISSUE-07 · Tile state and frame scheduling

Tile rendering now reads its assigned tab's display settings. The [chart engine event handlers](../../src/components/ChartCanvas.tsx) pass tab IDs for hover, viewport, drawing, and pane changes. Toolbar and menu callers retain active-tab defaults. The [app root](../../src/RootApp.tsx) owns startup discovery and serializes its settings-driven enablement updates. Complete a two-tile acceptance pass for background hover, resize, drawings, and plugin settings changes. Keep application-owned scanner patterns available with the Core EOD Scanner plugin disabled.

Hover is now outside persisted workspace state. Focused profiling showed 1,000 hover events causing 1,000 persistent-tab updates before the change and zero afterward. Scheduler checks showed 120 idle callbacks before versus one initial callback afterward; a browser canvas recorded zero callbacks during a 300 ms settled interval and an overlay-only redraw on invalidation. Indicator-bundle profiling independently showed ten builds across ten viewport changes before versus zero after. Deferred `axisWidthChange`, screenshot flushing and kinetic invalidation are preserved. Native interaction acceptance remains required.

## ISSUE-08 · Quote and merge durability

Quote upsert and merge currently commit SQLite before attempting their binary writes. Some binary errors are logged and the operation still returns success. Delete can return an error after its SQLite transaction has committed. The [quote mutations](../../src-tauri-shell/src/database/quotes.rs) and [merge implementation](../../src-tauri-shell/src/database/instrument_mutations.rs) own these paths.

Proposed design for review:

1. Give each logical quote or merge operation an ID. Before the SQLite transaction, prepare and flush replacement files and record enough information to distinguish the expected before and after states. A merge can affect multiple files and must carry one operation ID for the entire set.
2. Commit the SQLite changes and the recovery intent together. Publish the binary changes in a defined order. Persist per-file progress or make it recoverable from verified file state. Report completion only when the entire operation is durable.
3. Resolve pending intents when a database opens and before another affected write. Finish forward when the staged or already-published bytes match the intent. Retain ambiguous intents and block overlapping writes for that database until reviewed. Account for crashes before the SQL commit, after each replacement, after the source removal, and after the last replacement but before intent completion.
4. Include merge in writer coordination. Keep Corporate Actions approval explicit and preserve raw binary immutability. Evaluate approval-time price basis consistency separately from writer coordination. Preserve the Bhavcopy journal, worker cap, and deferred sync policy.

The current [parity dialog](../../src/components/BinaryEodParityDialog.tsx) requests quick checks. Define a separate deep mode with dates, storage scale, and field-specific comparison rules. DB-SAFE-03 documents why SQLite and binary `prev_close` can legitimately differ. Delivery and trades have no direct counterpart in the binary format. Require tests for legitimate differences, actual value mismatches, missing records, and interruption at every publish boundary.

Decision needed before implementation: approve forward recovery with an explicit blocked state for ambiguous intents, and agree which differences deep parity reports as informational or actionable.

## ISSUE-09 · Command latency, reads, settings, and shutdown

The 15 November actual-database native baseline found 8–13 ms snapshot latency alone versus 1.07–1.29 s alongside 28,206-symbol listings. Symbol listing/search now use `spawn_blocking` without changing the shared-connection contract. Post-change native timing and separate watchlist-download profiling remain pending; this measurement alone does not justify a read pool.

Measure the blocking official watchlist fetch and active-database read contention separately. A read pool needs per-database ownership, bounded connections, and deletion/shutdown lifecycle integration. Profile first and choose the smallest changes that address observed stalls. The [connection registry](../../src-tauri-shell/src/database/connection_registry.rs) already has a read-only connection helper. Profile settings replacement can be evaluated independently with a same-directory durable staging file and Windows replacement tests. Coordinate close handling with recoverable writes and workspace saves before changing the exit path.

## ISSUE-10 · Independent design choices

- **Binary IPC:** benchmark the current history transfer, then define a versioned response and verify byte parity, cancellation, and renderer fallback.
- **Custom titlebar:** keep the native menu as the baseline. A prototype needs Windows snap, DPI, keyboard accelerator, and accessibility acceptance before changing decorations.
- **Object Tree:** specify selection, visibility, ordering, and drawing ownership for multi-chart layouts after ISSUE-03.
- **OHLCV inspector:** design keyboard stepping alongside existing pan and symbol navigation. Verify the readout with a screen reader and use the same price basis as the chart.
