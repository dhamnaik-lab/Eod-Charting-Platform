# PARITY_MATRIX_ELECTRON_VS_TAURI

Date: 2026-03-28

Status meanings used in this matrix:

- `Electron only`
- `Tauri only`
- `Both supported`
- `Partial on Tauri`
- `Not validated`

Validation level notes:

- `Build verified`
- `Launch verified`
- `Basic interaction verified`
- `Not yet verified`

| Area | Status | Validation level | Notes |
| --- | --- | --- | --- |
| app startup | Both supported | Launch verified | Packaged Electron and packaged Tauri executables both launched and exposed `EOD Chart` window titles in bounded checks |
| database lifecycle | Partial on Tauri | Build verified | Electron is active and known-good; Tauri commands exist, but packaged interactive create/open/close/delete smoke is still not fully claimed |
| recent database registry | Partial on Tauri | Build verified | Tauri registry path exists, but clean packaged migration/first-run recents behavior is still not fully claimed |
| settings/layout persistence | Partial on Tauri | Build verified | Tauri persistence exists, but packaged interactive save/reload parity is still not fully claimed |
| symbol reads/search | Partial on Tauri | Build verified | Tauri read path exists; packaged interactive parity is still not fully claimed |
| watchlists | Partial on Tauri | Build verified | Tauri CRUD exists, but packaged interactive parity is still not fully claimed |
| EOD reads | Partial on Tauri | Build verified | Tauri read path exists, but packaged interactive parity is still not fully claimed |
| CSV preview | Partial on Tauri | Build verified | Tauri preview path exists, but packaged end-to-end parity is still not fully claimed |
| CSV import | Partial on Tauri | Build verified | Tauri import path exists, but packaged end-to-end parity is still not fully claimed |
| import progress | Partial on Tauri | Build verified | `import:progress` wiring exists, but packaged large-file parity is still not fully claimed |
| bhavcopy download | Partial on Tauri | Build verified | Tauri single/batch download exists, but packaged end-to-end parity is still not fully claimed |
| bhavcopy progress | Partial on Tauri | Build verified | `bhavcopy:progress` wiring exists, but packaged long-run parity is still not fully claimed |
| menu events | Partial on Tauri | Build verified | Core Tauri menu forwarding exists, including Phase 7 mutation-tool ids, but packaged command-by-command parity is still not fully claimed |
| external links | Both supported | Build verified | Dual-wired behind `src/platform/shell.ts`; not re-click-tested in this phase |
| app metadata/about | Both supported | Build verified | Dual-wired behind `src/platform/shell.ts`; not re-opened in this phase |
| quote editor | Partial on Tauri | Build verified | Tauri quote CRUD now compiles and is exposed through the existing renderer dialog, but packaged interactive CRUD smoke is still not fully claimed |
| merge symbols | Partial on Tauri | Build verified | Tauri merge-symbol command now compiles and is exposed through the existing renderer dialog, but packaged interactive merge smoke is still not fully claimed |
| corporate-action writes | Partial on Tauri | Build verified | Tauri corporate-action and identity-history mutation commands now compile and are exposed through the existing renderer dialog, but packaged interactive mutation smoke is still not fully claimed |
| packaged Windows behavior | Both supported | Launch verified | Electron unpacked app, Electron NSIS installer, Tauri release executable, and Tauri NSIS installer all launched successfully in bounded checks |
| packaged macOS readiness | Not validated | Not yet verified | No macOS host build, no signing, no notarization, no runtime smoke |

## Explicit Notes

- No active React/TypeScript renderer file outside `src/platform/*` imports `@tauri-apps/*`
- Legacy inactive files `src/app.js` and `src/modules/backend-api.js` still contain historical Tauri imports and remain outside the active runtime path
- The matrix is intentionally conservative: build and startup evidence does not count as full interactive parity
- The remaining Tauri gap is now primarily validation depth, not missing adapter surface
- Electron remains the release fallback, and the current recommendation is `Windows-preview-only` rather than default-runtime cutover
