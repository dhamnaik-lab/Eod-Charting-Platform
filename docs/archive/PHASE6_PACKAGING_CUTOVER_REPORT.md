# PHASE6_PACKAGING_CUTOVER_REPORT

Date: 2026-03-28

## Summary

Phase 6 focused on validation, packaging evidence, and cutover rules rather than new feature porting.

No business logic was migrated in this phase. The only non-documentation change was adding a reproducible `tauri:bundle:nsis` script to `package.json` for the already-validated Windows Tauri installer path.

## Backup Snapshot

- `D:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260328_190442_phase6_packaging_cutover`

## Files Added

- `PHASE6_PACKAGING_CUTOVER_REPORT.md`
- `PARITY_MATRIX_ELECTRON_VS_TAURI.md`

## Files Modified

- `package.json`
- `README.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `PROJECT_BRIEF_EOD_CHARTING_PLATFORM.md`
- `NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md`
- `CHANGES_BY_OPencode_NEMOTRON_3_SUPER.md`
- `MIGRATION_EXECUTION_PLAN.md`
- `FILE_INVENTORY.md`
- `RISK_REGISTER.md`
- `src-tauri-shell/README.md`

## Validation Performed

### Electron

- `npm run build`
  - passed
- `npm run dist:dev`
  - passed
  - produced `release/win-unpacked/EOD Chart.exe`
- bounded launch check for `release/win-unpacked/EOD Chart.exe`
  - process stayed alive after 8 seconds
  - main window title was `EOD Chart`
- `npm run dist:installer`
  - passed
  - produced `release/EOD Chart Setup 0.1.0.exe`
- bounded installer-start check for `release/EOD Chart Setup 0.1.0.exe`
  - process stayed alive after 8 seconds
  - main window title was `EOD Chart Setup`

### Tauri

- `cargo check --manifest-path src-tauri-shell/Cargo.toml`
  - passed
- `npm run tauri:build`
  - passed
  - produced `src-tauri-shell/target/release/eod-charting-platform-shell.exe`
- bounded launch check for `src-tauri-shell/target/release/eod-charting-platform-shell.exe`
  - process stayed alive after 8 seconds
  - main window title was `EOD Chart`
- `npm run tauri:bundle:nsis`
  - passed
  - produced `src-tauri-shell/target/release/bundle/nsis/EOD Chart_0.1.0_x64-setup.exe`
- bounded installer-start check for `src-tauri-shell/target/release/bundle/nsis/EOD Chart_0.1.0_x64-setup.exe`
  - process stayed alive after 8 seconds
  - main window title was `EOD Chart Setup`

### Renderer Seam Purity

- scanned `src/**/*.{ts,tsx,js,jsx}` outside `src/platform/*`
- no active React/TypeScript renderer file outside `src/platform/*` imports `@tauri-apps/*`
- legacy inactive files still containing historical Tauri imports:
  - `src/app.js`
  - `src/modules/backend-api.js`

## Exact Parity Claims

Authoritative area-by-area status now lives in `PARITY_MATRIX_ELECTRON_VS_TAURI.md`.

High-confidence claims after this phase:

- Electron packaged Windows fallback is validated at unpacked-app startup level and NSIS-installer startup level
- Tauri packaged Windows shell is validated at release-executable startup level and NSIS-installer startup level
- no active renderer seam regression was introduced; runtime-specific imports remain isolated to `src/platform/*`

Explicit non-claims after this phase:

- full interactive Tauri database parity is not yet proven in packaged builds
- full interactive Tauri CSV import / bhavcopy parity is not yet proven in packaged builds
- Tauri dev-mode shell startup is not yet fully re-verified in this phase
- macOS packaging, signing, notarization, and runtime validation are not yet proven
- quote editor CRUD, merge-symbol flows, and corporate-action / identity-history mutation flows are still Electron-only

## Windows Packaging And Runtime Notes

### Current local result

- Electron packaging is reproducible with:
  - `npm run dist:dev`
  - `npm run dist:installer`
- Tauri packaging is reproducible with:
  - `npm run tauri:build`
  - `npm run tauri:bundle:nsis`

### Practical interpretation

- Electron already has a usable packaged fallback path on Windows
- Tauri now has a validated Windows NSIS installer path, but it is still a packaging-only milestone, not a full feature-parity signoff
- `src-tauri-shell/tauri.conf.json` still keeps `"bundle.active": false`, so default `tauri build` stays fast and installer creation remains an explicit packaging step

### Official Tauri notes relevant to this repo

- Tauri uses Microsoft Edge WebView2 on Windows. The official prerequisites say WebView2 is already installed on Windows 10 version 1803 and later, and otherwise the Evergreen Bootstrapper should be installed:
  - <https://v2.tauri.app/start/prerequisites/>
- Tauri Windows installers are distributed as either WiX-based `.msi` packages or NSIS setup executables. MSI generation requires the Windows VBSCRIPT optional feature:
  - <https://v2.tauri.app/distribute/windows-installer/>
- Tauri's Windows signing guide says code signing is required for Microsoft Store distribution and to avoid SmartScreen warnings on browser-downloaded installers. It also notes that EV certificates get immediate SmartScreen reputation while OV certificates may still warn until reputation accrues:
  - <https://v2.tauri.app/distribute/sign/windows/>

### Windows release readiness for this repo

Validated now:

- Electron unpacked startup
- Electron NSIS installer startup
- Tauri release executable startup
- Tauri NSIS installer startup

Still missing before external cutover:

- signed Windows installers for Electron and Tauri
- clean-machine WebView2 prerequisite verification
- full packaged interactive smoke of Tauri database/import/bhavcopy workflows
- final decision on deferred mutation flows

## macOS Packaging, Signing, And Notarization Notes

macOS is still planning-only for this repository.

What is not yet done:

- no macOS host build was performed
- no `.app` or `.dmg` artifact was produced
- no Apple Developer signing identity is configured
- no notarization credentials are configured
- no macOS runtime smoke test was run

Official Tauri guidance relevant to the next macOS pass:

- Tauri distribution docs state that for macOS direct distribution outside the App Store, code signing is required and notarization is also required:
  - <https://v2.tauri.app/distribute/>
- Tauri's macOS application bundle guide says the app bundle should be built on a Mac and can be produced with `tauri build -- --bundles app`:
  - <https://v2.tauri.app/distribute/macos-application-bundle/>
- Tauri's DMG guide says a DMG can be produced on a Mac with `tauri build -- --bundles dmg`:
  - <https://v2.tauri.app/distribute/dmg/>
- Tauri's macOS signing docs say a signing identity is required, notarization requires Apple credentials, and ad-hoc signing does not remove the Privacy & Security allowlist step:
  - <https://v2.tauri.app/distribute/sign/macos/>

Minimum macOS cutover prerequisites for this repo:

- a Mac build host or CI runner
- Apple Developer account and signing identity
- notarization credentials
- a decision on whether to ship `.app`, `.dmg`, or both
- packaged runtime smoke against at least one Intel/Apple Silicon supported target strategy

## Go / No-Go Cutover Criteria

### Current decision

- **No-go** for making Tauri the default runtime today

### Why the cutover is still blocked

- quote editor CRUD is still Electron-only
- merge-symbol flows are still Electron-only
- corporate-action / identity-history mutation flows are still Electron-only
- packaged Tauri interactive parity for database/import/bhavcopy flows is still partial
- macOS packaging/signing/notarization is not yet validated
- app-data path migration and first-run recent-database behavior are not yet verified on clean packaged installs

### Minimum go criteria

- all user-facing features claimed for Tauri are either:
  - implemented and validated in Tauri, or
  - explicitly hidden/removed from the Tauri product claim
- packaged Windows Tauri build passes interactive smoke for:
  - database lifecycle
  - recent databases
  - settings and layouts
  - symbol reads and watchlists
  - CSV preview/import
  - bhavcopy single-date and batch flows
- macOS packaging/signing/notarization path is built and validated on a Mac
- rollback Electron package remains releasable for at least one release cycle after first Tauri rollout

### Safe intermediate position

- Windows-only internal Tauri preview is reasonable
- Electron should remain the default external release runtime until the blockers above are closed

## Rollback Criteria

Stay on Electron as the release default if any of the following remain true:

- any packaged Tauri startup regression appears
- any packaged Tauri database lifecycle regression appears
- any packaged Tauri CSV import or bhavcopy regression appears
- deferred mutation flows are still needed by release users and remain Electron-only
- macOS release signing/notarization is still incomplete

Rollback action:

- continue shipping Electron artifacts
- keep Tauri validation work on a separate migration track
- do not delete Electron scripts, assets, or packaging config

## What Should Happen Next

Recommended next step:

- run a dedicated post-Phase-6 blocker pass for:
  - quote editor CRUD parity
  - merge-symbol parity
  - corporate-action / identity-history mutation parity
  - interactive packaged Windows smoke of all already-ported Tauri flows

After that pass, re-open the cutover decision with the parity matrix as the baseline.
