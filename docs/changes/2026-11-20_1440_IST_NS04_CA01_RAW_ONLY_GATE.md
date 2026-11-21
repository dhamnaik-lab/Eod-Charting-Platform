# NS-04 — CA-01 HOLD: native scanner raw-only safety gate

- **IST timestamp:** 2026-11-20 14:40 IST (UTC+05:30)
- **Workstream:** EOD Charting Platform, `E:\TA Projects\EOD Charting Platform`
- **Authority:** PR #124, `arena/1a89772f-eod-charting-platform`, parent `b21d9ed22fe6f6c6483c0b595027616b978eb784`; accepted main `717eb6f00af96d8f717929eab2fc2d57cd7e5b6f`.
- **Objective:** Prevent unsupported native adjusted-price results while issuer-event ownership and BSE T+0 applicability are unresolved under CA-01.
- **Previous defect:** Native IPC accepted `priceBasis: "adjusted"`, and the production source delegated to existing corporate-action projection. Duplicate or conflicting Split/Bonus action rows with different IDs for one economic event can be multiplied. No approved event-ownership rule exists to decide their applicability.
- **Decision:** Fail closed for **all native adjusted requests** until the CA-01 policy is approved. This is intentionally conservative: even a single unreferenced issuer action may have unresolved settlement applicability. Do **not** invent a deduplication or ownership rule. No chart or corporate-action approval behavior changes.

## Files changed

- `src-tauri-shell/src/native_scanner/ipc.rs` — reject adjusted native requests with `native-scan-invalid-request`, issue path `request.evaluation.priceBasis` and code `ca01-adjusted-native-disabled`, before any database read or job registration; raw requests still validate.
- `src-tauri-shell/src/native_scanner/database_source.rs` — reject adjusted reads inside the production native `ScanDataSource` independently of IPC; raw price reads retain the existing path.
- `src-tauri-shell/src/native_scanner/tests.rs` — disposable Hybrid BSE normal/T+0 shared-ISIN fixtures for duplicate Split factor 2, conflicting Split factor 2/3, and Split+Bonus. Assert raw native reads work and adjusted native reads fail closed.
- `HANDOFF.md`, `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md` — document new current safety gate and outstanding acceptance.

## Behavior preserved

- TypeScript scanner remains the default; native scanner opt-in remains OFF by default.
- Existing native UI adapter submits `priceBasis: "raw"` and is unaffected.
- The chart/export `apply_corporate_adjustments` implementation and the CA-01 HOLD document are untouched. Historical native adjusted projection fixtures that directly test the **shared** price helper remain unchanged; these do not authorize public native adjusted execution.
- Binary/Hybrid read behavior, database permits, registered scanner IDs, event mapping, matching/scoring and no-alert semantics remain unchanged.
- No new dependency; no production database, data file, or build output touched by GitHub edit.

## Validation and limitations

- Before commit: source and GitHub authority inspected at `b21d9ed22fe6f6c6483c0b595027616b978eb784`. No Rust toolchain is available in this editing environment; **Rustfmt, Cargo compilation and tests are NOT independently executed prepublication**.
- Tests added: native IPC adjusted-rejection/raw-acceptance; native source rejection for three synthetic BSE same-event collision shapes.
- After PR publication: GitHub CI Rustfmt, Cargo check/test and renderer gates must pass on the **new** commit; capture real run IDs and counts before acceptance. Windows shared-Cargo, `tauri:check`, disposable-database runtime and portable native UI remain untested.
- **Separate unresolved identity concern:** `ReadOnlyDatabaseSource::open` still constructs event identity from folder path plus modification time rather than a canonical database revision token. Do not claim this task corrects database-switch/revision authority; address as a separate bounded task with approved source-of-truth and validation.
- **CA-01** is not resolved; native adjusted scanning is intentionally unavailable. Avoid treating this as proof that the accepted chart adjustment source is unambiguous.
- **Protected files:** local generated files, audit documents, CA-01 HOLD record, and `.git/info/attributes` cannot be hashed from the remote GitHub connection. None is in the changed-file allowlist; confirm local hash preservation when pulling.

## Rollback

Revert this scoped safety-gate commit on the PR branch if necessary (with explicit user approval), then keep native execution OFF. **Do not re-enable adjusted native execution** without a reviewed event-ownership policy and corresponding regression tests. Restore no local files or databases.

## Next step

Verify the PR branch's new commit and its GitHub CI results. Independently validate the Windows shared Cargo and disposable BSE/T+0 fixture behavior before considering merge. Keep PR #124 open.

## Post-publication formatting follow-up

Initial GitHub Rustfmt workflow run `44708768666` **FAILED** exclusively on two line-wrap differences in the newly added `native_scanner/ipc.rs` test (no semantic findings). This follow-up commit applies the exact stable rustfmt diff. Original handoff headings were also corrected from literal escaped newline characters to actual Markdown paragraph breaks. New CI validation remains pending until the workflow reports its real result.
