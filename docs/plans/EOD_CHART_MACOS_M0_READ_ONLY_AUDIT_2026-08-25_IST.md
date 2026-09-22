# EOD Charting Platform — macOS Compatibility M0 Read-Only Audit

**Audit date:** 25 August 2026  
**Audit completion time:** 13:08 IST (UTC+05:30)  
**Project root represented by snapshot:** `E:\TA Projects\EOD Charting Platform`  
**Snapshot:** `Eod Charting Platform Source Code 2026-08-25_001225_IST`  
**Uploaded ZIP SHA-256:** `D15A1165C9BDAEC4F764048DA2E469A7245114D4AD18A5ACC5856463F1D470B9`  
**Archive inventory:** 851 ZIP entries; 727 files; 16,797,580 uncompressed bytes  
**Audit mode:** Read-only static audit  

---

## 1. Objective

Determine whether the current Windows EOD Charting Platform can be extended to macOS while preserving the verified Windows application, existing database specification, charting behavior, corporate-action provenance, and single-source architecture.

The audit covers:

- frontend and Tauri/Rust architecture;
- Node/npm and Rust build configuration;
- macOS application and DMG packaging readiness;
- native menu and application-lifecycle behavior;
- renderer compatibility with macOS WKWebView;
- mouse and trackpad interaction;
- application profile, filesystem, and path handling;
- SQLite and binary EOD database portability;
- database transfer and multi-machine usage constraints;
- platform-sensitive tests and user-interface text;
- signing, notarization, and release validation requirements.

This audit did **not** implement any change.

---

## 2. Executive verdict

### Decision

**Proceed with a controlled macOS enablement project. Do not create a separate Mac codebase and do not replace Tauri.**

The application is materially suitable for macOS because it already uses:

- one React/TypeScript renderer;
- Tauri 2 and a Rust native shell;
- a centralized renderer-to-desktop adapter under `src/platform`;
- cross-platform Rust filesystem types (`Path` and `PathBuf`);
- bundled SQLite through `rusqlite`;
- Rustls rather than a platform OpenSSL dependency;
- native file dialogs through `rfd`;
- explicit little-endian binary EOD serialization;
- a valid macOS `.icns` icon;
- dependency-lock entries for Apple Silicon and Intel macOS tooling.

The work is therefore a **contained platform-enablement effort**, not an application rewrite.

### Current release status

**The snapshot is not yet macOS release-ready.**

The principal reasons are:

1. The common Tauri build pre-hook uses a Windows-only command path.
2. Tauri bundle creation is disabled and there is no macOS-specific bundle configuration.
3. At least one Rust test asserts Windows path separators and will fail on macOS.
4. Chart wheel handling is not suitable for native Mac trackpad event patterns.
5. The custom native menu lacks the required macOS application submenu structure.
6. The default profile location under Documents requires real macOS privacy/permission testing.
7. Database files are structurally portable, but a real Windows-to-Mac migration and sidecar reconciliation have not been validated.
8. No `.app`, `.dmg`, code-signing, notarization, or Gatekeeper validation has been performed.

### Recommended initial target

- **Hardware:** Apple Silicon first (`aarch64-apple-darwin`).
- **Distribution:** direct signed and notarized DMG, not the Mac App Store.
- **Provisional OS support floor:** macOS 13 Ventura or later for the first supported release, until testing proves that older macOS/WebKit versions are adequate.
- **Database model:** one local database copy per computer; no shared live SQLite/WAL folder on NAS, SMB, or ordinary cloud-sync storage.
- **Source model:** one repository and one database specification for Windows and macOS.

---

## 3. Readiness matrix

| Area | Status | Audit conclusion |
|---|---|---|
| Core architecture | Green | Tauri 2 + React + TypeScript + Rust is suitable for Windows and macOS. |
| Renderer/desktop boundary | Green | Direct Tauri imports are confined to `src/platform`; no renderer rewrite is needed. |
| Rust dependencies | Green | No active Windows-only runtime crate or native API dependency was found. |
| SQLite format | Green/Amber | SQLite is portable; consistent transfer and WAL handling still require validation. |
| Binary `.eod` format | Green/Amber | Explicit little-endian encoding is portable; real migration parity still must pass. |
| macOS icon | Green | `src-tauri-shell/icons/icon.icns` exists. |
| npm/Tauri build entry | Red | Backslash path in the common build pre-hook is a macOS build blocker. |
| macOS bundle config | Red | `bundle.active` is false and no `tauri.macos.conf.json` exists. |
| Rust tests | Red | A Windows-separator assertion will fail on macOS. |
| Trackpad interaction | Red for release | Current wheel logic can zoom on horizontal trackpad scroll and overreact to small deltas. |
| Native menu | Amber/Red | First submenu is `File`; Tauri places it in the macOS application-menu slot. |
| Profile location | Amber | Documents is user-visible but may trigger macOS Files & Folders permission behavior. |
| Database registry | Amber | Absolute Windows paths must not be copied as the Mac registry. |
| Sidecar timestamps | Amber | Exact file modification nanoseconds can change during transfer. |
| WebKit rendering | Amber | Windows WebView2 behavior does not prove WKWebView behavior. |
| Signing/notarization | Red | Not configured or tested. |
| Windows regression safety | Green today | No source was changed by this audit. |

---

## 4. Confirmed architectural strengths

### 4.1 One source tree is the correct design

The source already has a clear desktop boundary:

- `src/platform/desktop.ts`
- `src/platform/index.ts`
- `src/platform/shell.ts`
- `src/platform/tauriDesktop.ts`
- `src/platform/types.ts`

Tauri API imports are localized inside this directory. The application should retain this architecture and compile the same renderer and Rust backend for both operating systems.

A separate structure such as `EOD Chart Windows` and `EOD Chart Mac` would create duplicated features, divergent fixes, and database-behavior risk. It is not justified by the current implementation.

### 4.2 Rust dependency selection is favorable

`src-tauri-shell/Cargo.toml` uses:

- `reqwest` with `rustls-tls`;
- `rusqlite` with `bundled` SQLite;
- `rfd` for native dialogs;
- `open` for opening external resources;
- Tauri 2.

No active use of `std::os::windows`, Windows Registry APIs, `.exe` runtime launching, PowerShell invocation from the Rust runtime, or a Windows-only native library was found.

### 4.3 JavaScript dependency lock includes macOS variants

`package-lock.json` contains Apple Silicon and Intel macOS packages for the Tauri CLI and frontend build toolchain, including:

- `@tauri-apps/cli-darwin-arm64`;
- `@tauri-apps/cli-darwin-x64`;
- Darwin variants for esbuild, Rollup/Rolldown, and Lightning CSS.

This does not prove a Mac build, but it indicates that the locked JavaScript toolchain has macOS artifacts available.

### 4.4 macOS icon is already present

The snapshot contains:

- `src-tauri-shell/icons/icon.icns` — macOS;
- `src-tauri-shell/icons/icon.ico` — Windows;
- `src-tauri-shell/icons/icon.png` — common source/other targets.

No icon-generation blocker was found.

### 4.5 No source filename case collisions were found

The static filename/import-path audit did not find a true case-collision or a confirmed import whose casing differs from its target file. This is favorable for case-sensitive macOS volumes.

A real build on a case-sensitive APFS volume is still the definitive validation.

---

## 5. Confirmed blockers and high-priority findings

## 5.1 P0 — common npm build hook is Windows-only

**File:** `package.json`  
**Evidence:** lines 9 and 11

```json
"pretauri:build": "node .\\scripts\\generate-build-metadata.cjs",
"pretauri:bundle:nsis": "node .\\scripts\\generate-build-metadata.cjs"
```

The backslash invocation is Windows shell syntax. A normal macOS POSIX shell will not resolve this as `./scripts/generate-build-metadata.cjs`.

### Minimum future correction

Use forward slashes in the common command:

```json
"pretauri:build": "node ./scripts/generate-build-metadata.cjs"
```

Node and npm accept this form on Windows as well, so this is the smallest shared-source correction.

The Windows portable command must remain explicitly Windows-only:

```json
"tauri:portable:win": "... powershell ... ./scripts/prepare-tauri-portable.ps1"
```

Do not force the PowerShell portable packager to become the Mac packager.

---

## 5.2 P0 — macOS bundling is not configured

**File:** `src-tauri-shell/tauri.conf.json`  
**Evidence:** lines 30–32

```json
"bundle": {
  "active": false
}
```

No platform-specific Tauri configuration file exists in `src-tauri-shell`.

### Minimum future correction

Add:

```text
src-tauri-shell/tauri.macos.conf.json
```

Use it only for Mac-specific bundle targets and settings, while keeping `tauri.conf.json` common. Tauri supports platform-specific configuration and merges it with the base configuration. Arrays are replaced as whole arrays, so any Mac override of `app.windows`, icons, resources, or targets must be written carefully.

Recommended first output targets:

- engineering: `.app`;
- distribution: `.dmg`.

Do not activate or alter Windows bundling behavior unintentionally.

---

## 5.3 P0 — one Rust test hardcodes Windows separators

**File:** `src-tauri-shell/src/database/nse_identity_imports.rs`  
**Evidence:** lines 1985–1996

The test asserts suffixes such as:

```rust
"NSE\\Identity\\SymbolChanges\\nse_identity_symbol_changes.csv"
```

The production path construction uses path joins and is appropriate. The test is the defect: on macOS the rendered path uses `/`.

### Minimum future correction

Change the test to compare `Path`/`PathBuf` values or path components rather than comparing a Windows-formatted string.

Do not change production archive-folder semantics.

---

## 5.4 P0 for functional acceptance — Mac trackpad wheel handling

**File:** `src/engine/ChartEngine.ts`  
**Evidence:** lines 866–923

The current logic:

- prevents the default wheel event;
- pans only when Shift is pressed;
- otherwise computes zoom from `deltaY`;
- enforces at least one zoom step for every event;
- ignores dominant horizontal `deltaX` unless Shift is pressed.

Relevant logic:

```typescript
if (event.shiftKey) {
  const deltaPixels = event.deltaX !== 0 ? event.deltaX : event.deltaY;
  // pan
} else {
  const stepCount = Math.max(1, ...);
  // zoom from event.deltaY
}
```

Native Mac trackpads produce high-resolution wheel events and separate horizontal/vertical deltas. The current behavior can therefore cause:

- unintended zoom while the user performs a horizontal two-finger scroll;
- overly sensitive zoom from small vertical trackpad deltas;
- inconsistent behavior between a physical mouse wheel and a trackpad.

### Minimum future correction

Implement a focused wheel-input normalization layer:

1. normalize `deltaMode`;
2. treat dominant `deltaX` as horizontal pan without requiring Shift;
3. accumulate or threshold small trackpad `deltaY` values before applying zoom;
4. preserve existing physical mouse-wheel zoom behavior;
5. retain axis-scale wheel behavior after validating it on a trackpad.

Required focused tests:

- physical mouse-wheel zoom;
- small vertical trackpad deltas;
- horizontal trackpad pan;
- Shift+wheel compatibility;
- axis zoom;
- no zoom on pure horizontal delta.

Avoid a broad ChartEngine refactor.

---

## 5.5 P1 — custom native menu is incorrectly structured for macOS

**File:** `src-tauri-shell/src/main.rs`  
**Evidence:** menu construction lines 420–715

The first submenu added to the menu is `File`. The About item is under `Help`.

Tauri’s macOS menu behavior places the first submenu into the application-menu slot regardless of its visible label. As written, Mac users are likely to see the File actions occupying the EOD Chart application-menu position, without the normal first-class application entries expected for About, Hide, Services, and Quit.

### Minimum future correction

Under `#[cfg(target_os = "macos")]`:

1. build the EOD Chart application submenu first;
2. use native/predefined About, Services, Hide, Hide Others, Show All, and Quit menu roles where supported;
3. add File and the remaining common menus afterward;
4. preserve the current Windows menu order and commands.

Also decide whether `Settings` should map to the normal Command+Comma preference convention on Mac.

---

## 5.6 P1 — main-window close exits the whole process

**File:** `src-tauri-shell/src/main.rs`  
**Evidence:** lines 803–816

Closing the main window calls:

```rust
window.app_handle().exit(0);
```

This is different from common macOS behavior, where closing the last window can leave the application running and clicking the Dock icon reopens a window.

### Recommendation

For the first Mac release, explicitly preserving “close main window = quit” is acceptable and lower risk, provided it is documented and tested. A later native Mac lifecycle would require a complete reopen strategy and Dock activation handling; it should not be introduced incidentally during the initial port.

---

## 6. Filesystem and application-profile findings

## 6.1 System runtime storage is cross-platform

**File:** `src-tauri-shell/src/runtime.rs`  
**Evidence:** lines 87–105

System mode uses Tauri’s `app_data_dir()` and creates application state and log directories beneath it. This is the correct cross-platform pattern and should map to the appropriate macOS application-support location.

### Important Mac packaging rule

Use system mode for the signed `.app`. Do not make the installed application bundle act like the Windows portable edition by writing `portable-data` into or beside the signed bundle’s executable directory.

The existing Windows portable mode may remain Windows-specific.

## 6.2 Default profile under Documents requires macOS testing

**File:** `src-tauri-shell/src/app_profile.rs`  
**Evidence:** lines 169–216

The default application profile is:

```text
<Documents>/EOD Chart Profile
```

The application creates this directory and writes:

- app settings;
- database registry;
- profile-location pointer;
- related profile state.

On macOS, Documents is a user-protected location. Access can involve Files & Folders privacy behavior, user denial, managed restrictions, or cloud-redirection behavior. Because profile initialization is part of startup, a denied or unavailable Documents location could become a first-launch failure.

### Required design decision before implementation

Choose one of these deliberately:

**Option A — preserve Documents as the default**

- keeps the profile visible and easy to back up;
- requires robust permission error handling and a user-selectable fallback;
- requires first-launch testing with access allowed and denied.

**Option B — use application data as the macOS default**

- avoids routine Documents permission prompts;
- keeps machine-local state in the conventional application-support area;
- still allows the user to choose a custom profile directory;
- creates a small platform-specific default-location difference.

The audit recommendation is **Option B for macOS**, while preserving Windows behavior, but this is a recommendation rather than an implemented decision.

## 6.3 Relative profile paths depend on current working directory

**File:** `src-tauri-shell/src/app_profile.rs`  
**Evidence:** lines 416–423

Relative paths are resolved through `std::env::current_dir()`.

A GUI application’s current working directory should not be treated as stable on macOS. Native folder dialogs normally return absolute paths, so the ordinary UI flow is likely safe. Future hardening should reject ambiguous relative persisted paths or resolve them against an explicit stable root.

## 6.4 OS-specific startup wording

**File:** `src-tauri-shell/src/runtime.rs`  
**Evidence:** lines 139–148

The startup error says the location may be blocked by “Windows permissions.” This should become OS-neutral or platform-specific before Mac release.

---

## 7. Database and data-file portability

## 7.1 SQLite database format is portable, but the registry is not

**File:** `src-tauri-shell/src/database/connection_registry.rs`  
**Evidence:** registry model lines 35–40; open-folder flow lines 127–159

The database registry stores:

- recent database entries;
- `last_active_path` as an absolute string.

A Windows registry entry such as:

```text
E:\Market Data\EOD Database
```

is meaningless on macOS.

### Migration rule

Copy the **database folder**, not the Windows application profile or database registry. On the Mac:

1. launch EOD Chart;
2. use **Database → Open Database**;
3. select the copied local database folder;
4. allow EOD Chart to create a new Mac-side recent-database registry.

Do not mechanically rewrite the Windows registry JSON.

## 7.2 Binary `.eod` records are structurally portable

**File:** `src-tauri-shell/src/database/binary_eod.rs`  
**Evidence:** lines 1805–1829

Every record field is encoded and decoded using explicit little-endian conversions:

- `to_le_bytes()` when writing;
- `from_le_bytes()` when reading.

The implementation does not write a native Rust struct layout directly. This avoids differences caused by CPU architecture, field alignment, and native endianness.

The `.eod` format is therefore **portable by design between Windows x64 and Apple Silicon/Intel macOS**, subject to real migration parity validation.

## 7.3 Relative paths in the binary-state index are normalized

**File:** `src-tauri-shell/src/database/eod_binary_state.rs`  
**Evidence:** lines 1221–1240

Relative path components are joined with `/`, independent of the host separator. This is favorable for portability.

## 7.4 Exact modification timestamps can change during transfer

**File:** `src-tauri-shell/src/database/eod_binary_state.rs`  
**Evidence:** lines 1206–1218

The sidecar stores exact modification time in nanoseconds. The Bhavcopy fast path trusts a state row only when file length and modification time match the physical file.

**File:** `src-tauri-shell/src/bhavcopy.rs`  
**Evidence:** modified-time comparison around lines 372–389

Copying through ZIP, cloud storage, USB/exFAT, or another filesystem may alter timestamp precision or values. This does not mean the `.eod` data becomes invalid. It means the verified sidecar fast path may reject an otherwise identical file and use a conservative fallback/reconciliation path.

### Required migration validation

On first Mac open, record:

- number of VERIFIED, DIRTY, UNKNOWN, or mismatched sidecar rows;
- reconciliation behavior;
- first-open and first-Bhavcopy-import time;
- binary parity result;
- whether the sidecar can be safely regenerated without data mutation beyond its own index.

## 7.5 Do not share a live WAL database over a network filesystem

**File:** `src-tauri-shell/src/database/bootstrap.rs`  
**Finding:** the database uses SQLite WAL mode.

SQLite WAL requires all processes to be on the same host and does not work over a normal network filesystem. A live EOD database folder must not be concurrently opened by Windows and Mac computers through SMB/NAS or a cloud-synchronized folder.

For a small number of users, use separate local copies and a controlled update/snapshot distribution process. A true shared multi-user database would require a server/API architecture and is outside this Mac port.

## 7.6 Create a consistent database snapshot before transfer

Do not copy only the main SQLite file while a transaction may be active. A safe transfer should use one of these methods:

1. close EOD Chart completely and copy the full database folder only after writes stop;
2. preferably create a consistent copy using the SQLite Backup API or `VACUUM INTO`;
3. if copying a database that still has active WAL state, copy the matching `-wal` and `-shm` files together, although a purpose-built snapshot is safer.

A future **Create Portable Database Snapshot** command would materially reduce migration risk, but it is a separate feature and was not implemented here.

## 7.7 Historical Windows paths must remain historical

Corporate-action and identity evidence can contain source references such as:

```text
E:\TA Projects\Corporate Actions Raw\...
```

Those strings record where evidence originally came from. They are not necessarily active runtime paths. Do not globally replace them with Mac paths, because doing so would falsify provenance.

Only machine-local runtime settings, registry entries, and user-entered active source folders should be platform-adjusted.

---

## 8. Renderer and WKWebView compatibility

Windows Tauri renders through WebView2/Chromium; macOS Tauri renders through the operating system’s WebKit via WKWebView. Therefore a clean Windows renderer build and Windows visual test do not establish Mac runtime correctness.

The following require real Mac acceptance testing.

## 8.1 Canvas and Retina display

The chart uses Canvas, `devicePixelRatio`, and resize handling. Test:

- 1× and Retina scaling;
- sharp candlesticks, lines, markers, and crosshair;
- resizing and maximization;
- multiple displays with different scale factors;
- screenshots at Retina scale;
- text clipping along price/time axes.

## 8.2 Font metrics

There are 32 source occurrences of hardcoded `Segoe UI`, primarily in chart canvas drawing and text measurement. macOS will use a fallback font, which can have different glyph widths and baseline metrics.

Likely risks:

- clipped price labels;
- legend width mismatch;
- axis padding differences;
- screenshot legend misalignment;
- drawing-label placement drift.

Do not replace all fonts before testing. First run visual acceptance. If defects are observed, centralize a cross-platform chart font stack and use measured text widths consistently.

## 8.3 Clipboard

The renderer uses `navigator.clipboard`, `ClipboardItem`, and image/text clipboard flows. Test:

- copy symbol/text;
- copy chart screenshot;
- denied clipboard permission behavior;
- fallback save-to-file behavior;
- clipboard operation after the app loses/regains focus.

Any rejected clipboard promise should produce a visible error rather than fail silently.

## 8.4 Workers and modern browser APIs

The application uses Web Workers and modern browser capabilities such as `structuredClone`, `ResizeObserver`, Pointer Events, and module workers. These are expected in modern WebKit but must be tested against the selected minimum macOS version.

This is why the first support floor should be conservative rather than simply adopting Tauri’s oldest possible macOS target.

## 8.5 Input and context menus

Test all of the following on a real Mac trackpad and a mouse:

- vertical two-finger scroll;
- horizontal two-finger scroll;
- pinch gestures, including ensuring they do not cause unstable chart state;
- drag/pan;
- Control-click;
- two-finger secondary click;
- drawing selection and handles;
- axis scaling;
- floating-window dragging/resizing.

---

## 9. User-interface portability findings

## 9.1 Shortcut label

**File:** `src/components/KeyboardShortcutsDialog.tsx`  
**Evidence:** line 16

The implementation already recognizes Meta/Command in relevant shortcut handlers, but the help dialog displays only `Ctrl+K`.

Use a platform-sensitive label such as:

- Windows: `Ctrl+K`;
- macOS: `⌘K`;
- or common documentation: `Ctrl/⌘+K`.

## 9.2 Windows path examples in active UI

**File:** `src/components/DatabaseToolsDialogs.tsx`  
**Evidence:** lines 4047 and 4083

Active input placeholders show:

- `C:\path\to\BSE current master.csv`;
- `E:\TA Projects\Corporate Actions Raw`.

Replace these with neutral instructions or platform-sensitive examples. Do not confuse these UI placeholders with historical provenance fields, which must remain unchanged.

## 9.3 Generated source comment

A generated watchlist source file includes the original Windows path in a comment. It is not a runtime blocker. Future generation should use a neutral source name rather than a personal absolute path, but this is low priority and must not change generated data content.

---

## 10. Build and release machine requirements

The final macOS `.app` and `.dmg` should be built on a Mac. The initial build host requires:

- Apple Silicon Mac for the first target;
- Xcode or Xcode Command Line Tools;
- Rust and the Apple target toolchain;
- Node/npm matching the project’s validated toolchain;
- the latest confirmed source snapshot or repository checkout;
- Apple signing credentials for the production lane.

Recommended sequence:

1. unsigned/ad-hoc local engineering `.app`;
2. local `.dmg` for install-flow testing;
3. Developer ID signing;
4. Apple notarization;
5. stapling;
6. Gatekeeper validation;
7. SHA-256 and release manifest.

A free Apple developer account is insufficient for normal notarized distribution. Production direct-download distribution should use an appropriate Developer ID identity.

---

## 11. Proposed implementation phases

## M1 — minimum cross-platform build preparation

**Purpose:** make the existing source capable of entering a Mac build without altering Windows application behavior.

Expected files:

- modify `package.json`;
- create `src-tauri-shell/tauri.macos.conf.json`;
- modify `src-tauri-shell/src/database/nse_identity_imports.rs` test only;
- optionally harden `scripts/generate-build-metadata.cjs` or the Mac build environment to guarantee IST metadata;
- create required timestamped report under `docs\changes\`.

Required Windows regression commands after the change:

```powershell
npm run typecheck:renderer
npm test
npm run tauri:check
npm run build:renderer
npm run tauri:portable:win
```

The Windows executable/package hash and file location must be verified after the portable build.

## M2 — macOS input and native-shell compatibility

Expected files:

- modify `src/engine/ChartEngine.ts`;
- add or modify focused ChartEngine wheel-input tests;
- modify `src-tauri-shell/src/main.rs` for a macOS application menu;
- modify `src-tauri-shell/src/runtime.rs` for neutral wording;
- decide and, if approved, modify `src-tauri-shell/src/app_profile.rs` for the Mac default/fallback profile location;
- modify `src/components/KeyboardShortcutsDialog.tsx`;
- modify `src/components/DatabaseToolsDialogs.tsx`;
- create a timestamped `docs\changes\...md` report.

## M3 — first Apple Silicon engineering build

On a real Apple Silicon Mac:

```bash
xcode-select --install
npm ci
npm run typecheck:renderer
npm test
npm run tauri:check
npm run build:renderer
npm run tauri:dev
```

Then build the `.app` and `.dmg` with the approved Mac configuration.

Do not mark M3 passed until actual command output and runtime evidence are captured.

## M4 — database migration acceptance

Use a disposable but representative copy of the production database.

Validation must include:

- application opens the copied folder through the native Mac dialog;
- SQLite `PRAGMA quick_check` passes;
- foreign-key validation passes where applicable;
- expected database/table counts match the Windows source snapshot;
- binary `.eod` parity passes;
- sample NSE, BSE, and index instruments load with matching OHLCV history;
- corporate-action events and provenance display correctly;
- watchlists and settings behave as intended;
- binary-state sidecar status is recorded;
- a controlled Bhavcopy test is executed on a disposable copy;
- no Windows absolute registry path is retained as an active Mac path.

## M5 — production release lane

- Developer ID signing;
- notarization;
- stapling;
- `codesign` verification;
- Gatekeeper/`spctl` verification;
- drag-install from DMG;
- first launch from the Applications folder;
- upgrade/reinstall test;
- final artifact SHA-256 and manifest;
- final Windows regression lane.

## M6 — optional universal Mac binary

Only after Apple Silicon is stable:

- install `aarch64-apple-darwin` and `x86_64-apple-darwin` Rust targets;
- build `universal-apple-darwin`;
- validate on both Apple Silicon and a real Intel Mac, or an explicitly accepted Intel test environment.

Do not absorb Intel complexity into the first Mac milestone unless an intended user actually requires it.

---

## 12. macOS functional acceptance checklist

### Launch and storage

- [ ] Launches from development build.
- [ ] Launches from `/Applications` after DMG drag-install.
- [ ] Creates application runtime data in the approved Mac location.
- [ ] Handles Documents-profile permission allowed.
- [ ] Handles Documents-profile permission denied or unavailable.
- [ ] Saves and reloads settings.
- [ ] No data is written inside the signed application bundle.

### Database

- [ ] Opens an existing copied Windows database folder.
- [ ] Creates a new database on Mac.
- [ ] Closes and reopens recent databases.
- [ ] Windows registry/profile paths are not reused as active Mac paths.
- [ ] SQLite integrity checks pass.
- [ ] Binary EOD parity passes.
- [ ] Sidecar mismatches and regeneration are understood.
- [ ] No live database is opened from a network/cloud-sync location.

### Charts and input

- [ ] Candlestick, line, area, OHLC bar, baseline, HLC area, Heikin-Ashi, and Renko render correctly.
- [ ] Retina rendering is sharp.
- [ ] Mouse-wheel zoom matches Windows behavior.
- [ ] Vertical trackpad zoom is controlled.
- [ ] Horizontal trackpad scroll pans and does not zoom.
- [ ] Axis scale interaction works.
- [ ] Drawing tools create, select, move, edit, lock, and delete correctly.
- [ ] Secondary click works through two-finger click and Control-click.
- [ ] Crosshair and labels are aligned.
- [ ] Multiple displays and scale factors work.

### Features

- [ ] Symbol search and command palette.
- [ ] Watchlists and watchlist manager.
- [ ] Scanner and workers.
- [ ] Indicators and custom formula.
- [ ] Quote editor and merge-symbol flows.
- [ ] Corporate-action and identity review flows.
- [ ] Bhavcopy download/import.
- [ ] BSE/NSE source file dialogs.
- [ ] Text clipboard.
- [ ] Image clipboard.
- [ ] Screenshot save.
- [ ] External links open correctly.

### Native shell

- [ ] EOD Chart application menu appears correctly.
- [ ] About, Settings/Preferences, Services, Hide, and Quit behave correctly.
- [ ] File/Database/Watchlist/Chart/Draw/View/Help menus retain their commands.
- [ ] Command-key shortcuts are displayed and executed correctly.
- [ ] Full screen and maximize/zoom behavior are acceptable.
- [ ] Closing the main window follows the deliberately approved lifecycle.

### Distribution

- [ ] `.app` bundle builds on Mac.
- [ ] `.dmg` builds on Mac.
- [ ] Correct icon and application identifier.
- [ ] Signed with the intended Developer ID.
- [ ] Notarization succeeds.
- [ ] Ticket is stapled.
- [ ] Gatekeeper accepts a fresh downloaded copy.
- [ ] Release SHA-256 and manifest are recorded.

---

## 13. Validation performed during this audit

| Validation | Result | Evidence/limitation |
|---|---|---|
| Uploaded archive exists and can be extracted | PASS | 851 entries; 727 files. |
| Uploaded archive SHA-256 | PASS | `D15A...70B9`. |
| Core source/config read-only inspection | PASS | Targeted TypeScript, Rust, Tauri, npm, DB, and packaging files inspected. |
| Search for active Windows-only Rust APIs/dependencies | PASS | No confirmed Windows-only runtime dependency found. |
| Renderer-to-Tauri boundary inspection | PASS | Tauri imports confined to `src/platform`. |
| macOS JavaScript package variants | PASS | Darwin ARM64 and x64 entries present in lockfile. |
| macOS icon presence | PASS | `icon.icns` exists. |
| Static filename/import casing review | PASS | No confirmed case-collision or true import-case mismatch found. |
| macOS npm build pre-hook review | FAIL/confirmed blocker | Windows backslash command path. |
| macOS bundle configuration review | FAIL/confirmed blocker | `bundle.active: false`; no Mac platform config. |
| Cross-platform Rust test review | FAIL/confirmed blocker | Windows path-separator assertion. |
| Mac trackpad interaction review | FAIL for release readiness | Logic is not trackpad-normalized. |
| TypeScript typecheck | NOT RUN | No claim made. |
| Vitest | NOT RUN | No claim made. |
| Vite production build | NOT RUN | No claim made. |
| Cargo check/test | NOT RUN | `cargo` and `rustc` are unavailable in the audit container. This is an environment limitation, not evidence of project failure. |
| Tauri build | NOT RUN | Requires complete toolchain; final Mac bundle should be built on a Mac. |
| macOS `.app` | NOT RUN | No Mac build host used. |
| macOS `.dmg` | NOT RUN | No Mac build host used. |
| WKWebView runtime acceptance | NOT RUN | Requires macOS. |
| Windows database opened on Mac | NOT RUN | Requires macOS and an approved disposable DB copy. |
| Code signing/notarization | NOT RUN | Production credentials and Mac build required. |
| Windows regression build/package | NOT RUN | Audit was read-only; no source change required regression execution. |

---

## 14. Files inspected

The audit inspected or searched, at minimum:

### Project governance and baseline

- `AGENTS.md`
- `HANDOFF.md`
- snapshot directory and archive inventory

### Build and package configuration

- `package.json`
- `package-lock.json`
- `vite.config.mts`
- `vitest.config.ts`
- `tsconfig.json`
- `.cargo/config.toml`
- `src-tauri-shell/Cargo.toml`
- `src-tauri-shell/build.rs`
- `src-tauri-shell/tauri.conf.json`
- `src-tauri-shell/capabilities/default.json`
- `src-tauri-shell/icons/*`

### Build/maintenance scripts

- `scripts/generate-build-metadata.cjs`
- `scripts/prepare-tauri-portable.ps1`
- `scripts/Create-EOD-Source-Code-Snapshot-v3.ps1`
- `scripts/check-doc-references.ps1`
- `scripts/create-project-backup.ps1`
- `scripts/prune-backups.ps1`
- `scripts/validate-change.ps1`

### Renderer/platform bridge

- `src/platform/desktop.ts`
- `src/platform/index.ts`
- `src/platform/shell.ts`
- `src/platform/tauriDesktop.ts`
- `src/platform/types.ts`

### Rust runtime and data handling

- `src-tauri-shell/src/main.rs`
- `src-tauri-shell/src/runtime.rs`
- `src-tauri-shell/src/app_profile.rs`
- `src-tauri-shell/src/database/connection_registry.rs`
- `src-tauri-shell/src/database/bootstrap.rs`
- `src-tauri-shell/src/database/binary_eod.rs`
- `src-tauri-shell/src/database/eod_binary_state.rs`
- `src-tauri-shell/src/database/nse_identity_imports.rs`
- `src-tauri-shell/src/bhavcopy.rs`
- related Rust modules found by platform/path/API searches

### Renderer behavior and UI

- `src/engine/ChartEngine.ts`
- chart renderer/crosshair files containing font/text measurement logic
- `src/components/KeyboardShortcutsDialog.tsx`
- `src/components/DatabaseToolsDialogs.tsx`
- clipboard and screenshot call sites
- module-worker and browser-API call sites
- relevant test files containing Windows path fixtures

---

## 15. Files created and modified

### Inside the uploaded snapshot

- **Files created:** none.
- **Files modified:** none.
- **Files deleted:** none.
- **Database writes:** none.
- **Build output added:** none.
- **Packaging output added:** none.

### Outside the snapshot

- This audit report was created as a separate downloadable artifact.

### Exact behavior changed

- None.

### Behavior deliberately preserved

- Current Windows build and portable packaging configuration.
- Current charting and input behavior.
- Current database schema and binary EOD specification.
- Current application profile behavior.
- Current corporate-action and identity provenance strings.
- Current Bhavcopy and sidecar behavior.
- Current native menu and window lifecycle.

---

## 16. Risks and possible regressions in future implementation

The audit itself introduces no runtime regression. Future implementation must guard against:

1. changing the Windows portable build while adding Mac scripts;
2. replacing Tauri config arrays unintentionally through platform-specific merge behavior;
3. changing physical mouse-wheel behavior while fixing trackpad behavior;
4. changing chart axis/screenshot layout through a font refactor;
5. altering historical Windows provenance strings;
6. moving profile data without an explicit migration/fallback policy;
7. copying an inconsistent SQLite/WAL database;
8. trusting sidecar timestamps after cross-filesystem transfer;
9. treating a Mac renderer pass as proof of Windows behavior or vice versa;
10. introducing native Mac lifecycle semantics without a Dock reopen implementation;
11. attempting App Store sandboxing before external-file/database access is designed for it;
12. building a universal binary before Apple Silicon behavior is stable.

---

## 17. Recommended next step

Create an isolated, source-only **M1 Mac Build Preparation** change from the latest confirmed source after the current corporate-action work reaches a safe checkpoint.

The M1 change should be limited to:

1. cross-platform npm build-hook path;
2. new macOS-specific Tauri bundle configuration;
3. path-separator-independent Rust test;
4. explicit Mac build scripts/commands;
5. required timestamped `docs\changes\` report;
6. full Windows typecheck/test/build/portable-package regression validation.

Do not combine trackpad, native menu, profile-location policy, database migration, signing, or broad renderer refactoring into M1. Those belong to subsequent separately validated phases.

---

## 18. Official references consulted

- Tauri prerequisites: https://v2.tauri.app/start/prerequisites/
- Tauri platform-specific configuration: https://v2.tauri.app/develop/configuration-files/
- Tauri webview versions: https://v2.tauri.app/reference/webview-versions/
- Tauri macOS application bundle: https://v2.tauri.app/distribute/macos-application-bundle/
- Tauri DMG distribution: https://v2.tauri.app/distribute/dmg/
- Tauri macOS code signing/notarization: https://v2.tauri.app/distribute/sign/macos/
- Tauri window menu behavior: https://v2.tauri.app/learn/window-menu/
- Tauri CLI/universal macOS target: https://v2.tauri.app/reference/cli/
- SQLite WAL constraints: https://www.sqlite.org/wal.html
- SQLite Backup API: https://sqlite.org/backup.html
- SQLite safe-copy/corruption guidance: https://www.sqlite.org/howtocorrupt.html

---

## 19. Final audit conclusion

The current EOD Charting Platform should become a **Windows + macOS application from one source tree**. The data and backend architecture are substantially portable. The required work is concentrated in the build entry, Mac bundle configuration, one platform-sensitive Rust test, trackpad input, native menu conventions, first-launch profile handling, migration validation, and the signed/notarized release lane.

No database redesign, Electron conversion, Windows fork, or separate Mac application is warranted.

**M0 status: complete as a read-only static audit.**  
**macOS release status: not yet ready.**  
**Recommended program decision: proceed with M1 after the active Windows/corporate-action work reaches a safe checkpoint.**
