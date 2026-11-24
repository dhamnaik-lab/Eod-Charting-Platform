# EOD Charting Platform

Local-first desktop charting and end-of-day market-data application oriented toward Indian exchanges. The supplied source uses a **React 18 / TypeScript / Vite renderer**, **Tauri 2 desktop shell**, and **Rust backend**. This is a code-derived overview, not evidence of a successful Windows build or live-market operation. Sources: [package.json](package.json), [Tauri configuration](src-tauri-shell/tauri.conf.json), [Rust manifest](src-tauri-shell/Cargo.toml), [desktop entry](src-tauri-shell/src/main.rs).

## Start from a source checkout

1. Check the operating rules in [AGENTS.md](AGENTS.md), then verify that the checkout is the intended active project root. A source-only snapshot does not itself provide a runnable Windows installation.
2. Install the project-appropriate Node.js/npm, Rust toolchain, and Tauri/Windows build prerequisites. Install JavaScript dependencies using `npm ci` when dependency retrieval is permitted; dependency and toolchain readiness were **not** established by this documentation audit.
3. From the root, `npm run dev` launches the configured Tauri development workflow. `npm run dev:renderer` starts only Vite and cannot substitute for the desktop backend. See [package.json](package.json) and [src/platform/desktop.ts](src/platform/desktop.ts).
4. For focused verification after dependencies are available, use `npm run typecheck:renderer` or `npm test`, according to scope. Use the project validation script for changed documents: `scripts/validate-change.ps1 -Profile docs` on a compatible Windows PowerShell/Git environment. Follow the shared Cargo and release-build restrictions in [AGENTS.md](AGENTS.md), rather than running indiscriminate full builds.

## What the source contains

Charting workspaces, instruments and identity resolution, `.eod` binary price files with SQLite-backed metadata, NSE/BSE Bhavcopy acquisition and imports, corporate-action preparation and explicit approval, watchlists, drawings/indicators, scanners, alerts, and constrained plugin support. Architecture and verification status are maintained separately; the presence of code does not certify real exchange-data completeness. See [Architecture](ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md) and [Feature status](FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md).

## Documentation map — one owner per subject

| Document | Owns |
|---|---|
| [AGENTS.md](AGENTS.md) | Binding working rules, safety constraints, and validation policy (preserved verbatim) |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Explicit contractual behavior and preservation constraints |
| [ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md](ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md) | Current runtime design, interfaces, storage, and traced flows |
| [FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md](FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md) | Feature implementation evidence, test-source coverage, acceptance gaps |
| [UI/UX audit findings](FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md#uiux-audit-findings) | Finding-level implementation, validation and pending native checks |
| [Git main synchronization](docs/changes/2026-11-06_MAIN_SYNCHRONIZATION.md) | Dated sync baseline, local work preservation and rollback evidence |
| [FILE_INVENTORY.md](FILE_INVENTORY.md) | Short source navigation map |
| [PROJECT_STATE_EOD_CHARTING_PLATFORM.md](PROJECT_STATE_EOD_CHARTING_PLATFORM.md) | Dated snapshot audit baseline, findings and check results |
| [Native scanner retirement readiness](docs/plans/2026-11-21_NATIVE_SCANNER_RETIREMENT_READINESS.md) | Current native/TypeScript routing, bounded Windows parity evidence and open migration gates |
| [WP-04 signal and formula parity](docs/plans/2026-11-24_WP04_SIGNAL_AND_FORMULA_PARITY.md) | Windows portable acceptance for the built-in presets and bounded custom signals |
| [HANDOFF.md](HANDOFF.md) | Immediate resume/checkpoint instructions |
| [NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md](NEXT_THREAD_PROMPT_EOD_CHARTING_PLATFORM.md) | User-confirmed running/completed/next phase states only |

**Source scope.** The [4 Nov 2026 ZIP audit](PROJECT_STATE_EOD_CHARTING_PLATFORM.md#snapshot-authority) is historical. The [living scanner roadmap](docs/plans/2026-11-21_NATIVE_SCANNER_RETIREMENT_READINESS.md) tracks current routing and migration gates. WP-02 and WP-03 have Windows acceptance records. The [WP-04 V1 preset pilot](docs/plans/2026-11-24_WP04_SIGNAL_AND_FORMULA_PARITY.md#windows-portable-acceptance--24-november-2026-ist) passed Windows desktop parity on the normal portable using actual EOD data.
