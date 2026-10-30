# CA Dividend write-stage typed transport bridge — October 15 continuation

IST timestamp: 2026-10-15T12:09:56.309+05:30

## Objective
Expose accepted P4B private write owner only through a typed Tauri Desktop transport boundary.

## Previous limitation
October 8 attempt stopped at rustfmt in its new Rust test. October 15 TDD R1 stopped at formatter gate with 663 inherited and 668 candidate differences; RESUME1 corrected the five new formatting sites without touching inherited debt or bridge behavior. RESUME1 then stopped at native bridge GREEN (Rust compiled; 5/6 tests passed). RESUME2 corrected one whitespace-sensitive source-contract assertion; native bridge GREEN 6/6 and frontend GREEN 8/8 passed, but P4B 20/25 failed due to public command placement inside the private-owner source region, while its test filter selected a new bridge test (26 total). RESUME3 only relocates the byte-identical public wrapper after the recommended approval command and updates two new bridge source-region markers plus one bridge test name, preserving 25 original P4B tests and the original six production-file scope. RESUME3 then ran 38 P4A tests plus two separately covered P4B cases (40/40 PASS) but the broad p4a_ selector failed the expected-count gate; RESUME4 qualifies the P4A module selector to select exactly 38 without altering any production/test source bytes.

## Files changed
- Modified: src-tauri-shell/src/database.rs
- Modified: src-tauri-shell/src/database/corporate_action_imports.rs
- Modified: src-tauri-shell/src/main.rs
- Modified: src/types/desktop.ts
- Modified: src/platform/types.ts
- Modified: src/platform/tauriDesktop.ts
- Added: src-tauri-shell/src/database/corporate_action_imports/simple_cash_dividend_write_stage_bridge_tests.rs
- Added: src/features/corporateActions/__tests__/corporateActionDividendWriteStageTauriBridge.test.ts

## Final implementation
Public Rust input/result DTOs map six versioned input fields and exact post-commit P4B result. One new public Tauri command delegates to frozen private P4B owner exactly once. TypeScript DesktopApi and Tauri implementation expose one typed method. No frontend caller.

## Behavior preserved
P4A executor, P4B private transaction owner, P3A/B/C, Bhavcopy modular split, consolidation/reverse-split, UI, schema, manual Apply and Safe V2 preserved byte-exact outside eight approved paths.

## Validation commands and results
- 01-controller-selftests: exit 0; C:\Program Files\nodejs\node.exe --test E:\TA Projects\EOD Charting Platform\tmp\CA_DIV_WRITE_BRIDGE_OCT15_RESUME4_2026-10-15_114948_IST_e7bf10fd\package\tools\selftest.cjs
- 03-rustfmt-database-pre: exit 1; rustfmt.exe --edition 2021 --check E:\TA Projects\EOD Charting Platform\tmp\CA_DIV_WRITE_BRIDGE_OCT15_RESUME4_2026-10-15_114948_IST_e7bf10fd\pre\src-tauri-shell\src\database.rs
- 03-rustfmt-database-candidate: exit 1; rustfmt.exe --edition 2021 --check E:\TA Projects\EOD Charting Platform\tmp\CA_DIV_WRITE_BRIDGE_OCT15_RESUME4_2026-10-15_114948_IST_e7bf10fd\candidate\src-tauri-shell\src\database.rs
- 04-rustfmt-corporate-action-imports-pre: exit 1; rustfmt.exe --edition 2021 --check E:\TA Projects\EOD Charting Platform\tmp\CA_DIV_WRITE_BRIDGE_OCT15_RESUME4_2026-10-15_114948_IST_e7bf10fd\pre\src-tauri-shell\src\database\corporate_action_imports.rs
- 04-rustfmt-corporate-action-imports-candidate: exit 1; rustfmt.exe --edition 2021 --check E:\TA Projects\EOD Charting Platform\tmp\CA_DIV_WRITE_BRIDGE_OCT15_RESUME4_2026-10-15_114948_IST_e7bf10fd\candidate\src-tauri-shell\src\database\corporate_action_imports.rs
- 05-rustfmt-new-bridge-test: exit 0; rustfmt.exe --edition 2021 --check E:\TA Projects\EOD Charting Platform\tmp\CA_DIV_WRITE_BRIDGE_OCT15_RESUME4_2026-10-15_114948_IST_e7bf10fd\candidate\src-tauri-shell\src\database\corporate_action_imports\simple_cash_dividend_write_stage_bridge_tests.rs
- 06-rustfmt-main-pre: exit 1; rustfmt.exe --edition 2021 --check E:\TA Projects\EOD Charting Platform\tmp\CA_DIV_WRITE_BRIDGE_OCT15_RESUME4_2026-10-15_114948_IST_e7bf10fd\pre\src-tauri-shell\src\main.rs
- 06-rustfmt-main-candidate: exit 1; rustfmt.exe --edition 2021 --check E:\TA Projects\EOD Charting Platform\tmp\CA_DIV_WRITE_BRIDGE_OCT15_RESUME4_2026-10-15_114948_IST_e7bf10fd\candidate\src-tauri-shell\src\main.rs
- 07-red-frontend-bridge: exit 1; C:\Program Files\nodejs\node.exe E:\TA Projects\EOD Charting Platform\node_modules\vitest\vitest.mjs run src/features/corporateActions/__tests__/corporateActionDividendWriteStageTauriBridge.test.ts --config vitest.config.ts --reporter=json --outputFile E:\TA Projects\EOD Charting Platform\tmp\CA_DIV_WRITE_BRIDGE_OCT15_RESUME4_2026-10-15_114948_IST_e7bf10fd\evidence\07-red-frontend-bridge.json --no-file-parallelism --maxWorkers=1
- 08-red-rust-bridge: exit 101; cargo.exe test --locked --offline --no-default-features --jobs 1 write_stage_bridge_ -- --test-threads=1
- 09-green-rust-bridge: exit 0; cargo.exe test --locked --offline --no-default-features --jobs 1 write_stage_bridge_ -- --test-threads=1
- 10-green-frontend-bridge: exit 0; C:\Program Files\nodejs\node.exe E:\TA Projects\EOD Charting Platform\node_modules\vitest\vitest.mjs run src/features/corporateActions/__tests__/corporateActionDividendWriteStageTauriBridge.test.ts --config vitest.config.ts --reporter=json --outputFile E:\TA Projects\EOD Charting Platform\tmp\CA_DIV_WRITE_BRIDGE_OCT15_RESUME4_2026-10-15_114948_IST_e7bf10fd\evidence\10-green-frontend-bridge.json --no-file-parallelism --maxWorkers=1
- 11-candidate-p4b: exit 0; cargo.exe test --locked --offline --no-default-features --jobs 1 p4b_ -- --test-threads=1
- 12-candidate-p4a: exit 0; cargo.exe test --locked --offline --no-default-features --jobs 1 database::corporate_action_imports::auto_approval::write_stage_tests::p4a_ -- --test-threads=1
- 13-candidate-autoapproval: exit 0; cargo.exe test --locked --offline --no-default-features --jobs 1 auto_approval::tests:: -- --test-threads=1
- 14-candidate-p3a: exit 0; cargo.exe test --locked --offline --no-default-features --jobs 1 dividend_prepared_scope_bridge_tests:: -- --test-threads=1
- 15-candidate-related-frontend: exit 0; C:\Program Files\nodejs\node.exe E:\TA Projects\EOD Charting Platform\node_modules\vitest\vitest.mjs run src/features/corporateActions/__tests__/corporateActionDividendPreparedScope.test.ts src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeTauriBridge.test.ts src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeOrchestration.test.ts src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeObservability.test.ts --config vitest.config.ts --reporter=json --outputFile E:\TA Projects\EOD Charting Platform\tmp\CA_DIV_WRITE_BRIDGE_OCT15_RESUME4_2026-10-15_114948_IST_e7bf10fd\evidence\15-candidate-related-frontend.json --no-file-parallelism --maxWorkers=1
- 16-candidate-combined-frontend: exit 0; C:\Program Files\nodejs\node.exe E:\TA Projects\EOD Charting Platform\node_modules\vitest\vitest.mjs run src/features/corporateActions/__tests__/corporateActionDividendWriteStageTauriBridge.test.ts src/features/corporateActions/__tests__/corporateActionDividendPreparedScope.test.ts src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeTauriBridge.test.ts src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeOrchestration.test.ts src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeObservability.test.ts --config vitest.config.ts --reporter=json --outputFile E:\TA Projects\EOD Charting Platform\tmp\CA_DIV_WRITE_BRIDGE_OCT15_RESUME4_2026-10-15_114948_IST_e7bf10fd\evidence\16-candidate-combined-frontend.json --no-file-parallelism --maxWorkers=1
- 17-candidate-typecheck: exit 0; C:\Program Files\nodejs\node.exe E:\TA Projects\EOD Charting Platform\node_modules\typescript\bin\tsc -p tsconfig.json --noEmit --incremental false
- 18-candidate-cargo-check: exit 0; cargo.exe check --tests --locked --offline --no-default-features --jobs 1
- 19-candidate-vite-build: exit 0; C:\Program Files\nodejs\node.exe E:\TA Projects\EOD Charting Platform\node_modules\vite\bin\vite.js build
- 21-post-rust-bridge: exit 0; cargo.exe test --locked --offline --no-default-features --jobs 1 write_stage_bridge_ -- --test-threads=1
- 22-post-frontend-bridge: exit 0; C:\Program Files\nodejs\node.exe E:\TA Projects\EOD Charting Platform\node_modules\vitest\vitest.mjs run src/features/corporateActions/__tests__/corporateActionDividendWriteStageTauriBridge.test.ts --config vitest.config.ts --reporter=json --outputFile E:\TA Projects\EOD Charting Platform\tmp\CA_DIV_WRITE_BRIDGE_OCT15_RESUME4_2026-10-15_114948_IST_e7bf10fd\evidence\22-post-frontend-bridge.json --no-file-parallelism --maxWorkers=1
- 23-post-p4b: exit 0; cargo.exe test --locked --offline --no-default-features --jobs 1 p4b_ -- --test-threads=1
- 24-post-p4a: exit 0; cargo.exe test --locked --offline --no-default-features --jobs 1 database::corporate_action_imports::auto_approval::write_stage_tests::p4a_ -- --test-threads=1
- 25-post-autoapproval: exit 0; cargo.exe test --locked --offline --no-default-features --jobs 1 auto_approval::tests:: -- --test-threads=1
- 26-post-p3a: exit 0; cargo.exe test --locked --offline --no-default-features --jobs 1 dividend_prepared_scope_bridge_tests:: -- --test-threads=1
- 27-post-related-frontend: exit 0; C:\Program Files\nodejs\node.exe E:\TA Projects\EOD Charting Platform\node_modules\vitest\vitest.mjs run src/features/corporateActions/__tests__/corporateActionDividendPreparedScope.test.ts src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeTauriBridge.test.ts src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeOrchestration.test.ts src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeObservability.test.ts --config vitest.config.ts --reporter=json --outputFile E:\TA Projects\EOD Charting Platform\tmp\CA_DIV_WRITE_BRIDGE_OCT15_RESUME4_2026-10-15_114948_IST_e7bf10fd\evidence\27-post-related-frontend.json --no-file-parallelism --maxWorkers=1
- 28-post-combined-frontend: exit 0; C:\Program Files\nodejs\node.exe E:\TA Projects\EOD Charting Platform\node_modules\vitest\vitest.mjs run src/features/corporateActions/__tests__/corporateActionDividendWriteStageTauriBridge.test.ts src/features/corporateActions/__tests__/corporateActionDividendPreparedScope.test.ts src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeTauriBridge.test.ts src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeOrchestration.test.ts src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeObservability.test.ts --config vitest.config.ts --reporter=json --outputFile E:\TA Projects\EOD Charting Platform\tmp\CA_DIV_WRITE_BRIDGE_OCT15_RESUME4_2026-10-15_114948_IST_e7bf10fd\evidence\28-post-combined-frontend.json --no-file-parallelism --maxWorkers=1
- 29-post-typecheck: exit 0; C:\Program Files\nodejs\node.exe E:\TA Projects\EOD Charting Platform\node_modules\typescript\bin\tsc -p tsconfig.json --noEmit --incremental false
- 30-post-cargo-check: exit 0; cargo.exe check --tests --locked --offline --no-default-features --jobs 1
- 31-post-vite-build: exit 0; C:\Program Files\nodejs\node.exe E:\TA Projects\EOD Charting Platform\node_modules\vite\bin\vite.js build

## Gate receipts
{
  "00-resume2-parent-green-bound": {
    "failedGate": "09-green-rust-bridge",
    "parentPassed": 5,
    "parentFailed": 1,
    "failedTest": "write_stage_bridge_03_transport_delegates_once_and_passes_six_fields",
    "previousInstallation": false,
    "testOnlyFix": true
  },
  "00-resume1-parent-failure-bound": {
    "failedGate": "03-rustfmt-database",
    "baselineHunks": 663,
    "stoppedCandidateHunks": 668,
    "additionalFormattingSites": 5,
    "priorInstallation": false
  },
  "00-resume4-parent-p4a-bound": {
    "failedGate": "12-candidate-p4a",
    "parentPassed": 40,
    "parentFailed": 0,
    "expectedP4A": 38,
    "accidentallySelectedP4B": 2,
    "priorInstallation": false,
    "selectorOnly": true
  },
  "00-resume3-parent-p4b-bound": {
    "failedGate": "11-candidate-p4b",
    "parentP4BPassed": 25,
    "parentP4BFailed": 1,
    "originalP4BCount": 25,
    "newBridgeSelectedAccidentally": 1,
    "previousInstallation": false
  },
  "00-source-authority": {
    "live": 631,
    "snapshot": 629,
    "bhavcopyPreserved": true
  },
  "01-controller-selftests": {
    "passed": true
  },
  "02-isolated-RED": {
    "sourcePre": 631,
    "testFilesAdded": 2
  },
  "03-rustfmt-database": {
    "baselineHunks": 663,
    "candidateHunks": 663,
    "extraDebt": 0
  },
  "04-rustfmt-corporate-action-imports": {
    "baselineHunks": 277,
    "candidateHunks": 277,
    "extraDebt": 0
  },
  "05-rustfmt-new-bridge-test": {
    "passed": true
  },
  "06-rustfmt-main": {
    "baselineHunks": 758,
    "candidateHunks": 758,
    "extraDebt": 0
  },
  "07-red-frontend-bridge": {
    "total": 8,
    "passed": 1,
    "failed": 7,
    "files": [
      {
        "file": "src/features/corporateActions/__tests__/corporateActionDividendWriteStageTauriBridge.test.ts",
        "passed": 1,
        "failed": 7
      }
    ],
    "failedNames": [
      "defines exactly six public input fields without eligibility assertions",
      "defines the six permitted disposition codes",
      "defines all result fields and nullable corporateActionId",
      "exposes the typed method on DesktopBridgeApi",
      "exports all DTOs and adds platform capability",
      "invokes the one dedicated Tauri command with input only",
      "registers only the public Rust command and not the private owner"
    ]
  },
  "08-red-rust-bridge": {
    "expectedCompileFailure": true
  },
  "09-green-rust-bridge": {
    "passed": 6,
    "failed": 0,
    "ignored": 0
  },
  "10-green-frontend-bridge": {
    "total": 8,
    "passed": 8,
    "failed": 0,
    "files": [
      {
        "file": "src/features/corporateActions/__tests__/corporateActionDividendWriteStageTauriBridge.test.ts",
        "passed": 8,
        "failed": 0
      }
    ],
    "failedNames": []
  },
  "11-candidate-p4b": {
    "passed": 25,
    "failed": 0,
    "ignored": 0
  },
  "12-candidate-p4a": {
    "passed": 38,
    "failed": 0,
    "ignored": 0
  },
  "13-candidate-autoapproval": {
    "passed": 52,
    "failed": 0,
    "ignored": 0
  },
  "14-candidate-p3a": {
    "passed": 2,
    "failed": 0,
    "ignored": 0
  },
  "15-candidate-related-frontend": {
    "total": 68,
    "passed": 68,
    "failed": 0,
    "files": [
      {
        "file": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScope.test.ts",
        "passed": 15,
        "failed": 0
      },
      {
        "file": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeObservability.test.ts",
        "passed": 18,
        "failed": 0
      },
      {
        "file": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeOrchestration.test.ts",
        "passed": 26,
        "failed": 0
      },
      {
        "file": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeTauriBridge.test.ts",
        "passed": 9,
        "failed": 0
      }
    ],
    "failedNames": []
  },
  "16-candidate-combined-frontend": {
    "total": 76,
    "passed": 76,
    "failed": 0,
    "files": [
      {
        "file": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScope.test.ts",
        "passed": 15,
        "failed": 0
      },
      {
        "file": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeObservability.test.ts",
        "passed": 18,
        "failed": 0
      },
      {
        "file": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeOrchestration.test.ts",
        "passed": 26,
        "failed": 0
      },
      {
        "file": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeTauriBridge.test.ts",
        "passed": 9,
        "failed": 0
      },
      {
        "file": "src/features/corporateActions/__tests__/corporateActionDividendWriteStageTauriBridge.test.ts",
        "passed": 8,
        "failed": 0
      }
    ],
    "failedNames": []
  },
  "17-candidate-typecheck": {
    "passed": true
  },
  "18-candidate-cargo-check": {
    "passed": true
  },
  "19-candidate-vite-build": {
    "passed": true
  },
  "20-scoped-backup": {
    "files": 6,
    "additiveAbsent": 2,
    "backup": "E:\\TA Projects\\EOD Charting Platform\\backups\\pre_ca_div_write_bridge_oct15_2026-10-15_1202_IST_e7bf10fd"
  },
  "21-post-rust-bridge": {
    "passed": 6,
    "failed": 0,
    "ignored": 0
  },
  "22-post-frontend-bridge": {
    "total": 8,
    "passed": 8,
    "failed": 0,
    "files": [
      {
        "file": "src/features/corporateActions/__tests__/corporateActionDividendWriteStageTauriBridge.test.ts",
        "passed": 8,
        "failed": 0
      }
    ],
    "failedNames": []
  },
  "23-post-p4b": {
    "passed": 25,
    "failed": 0,
    "ignored": 0
  },
  "24-post-p4a": {
    "passed": 38,
    "failed": 0,
    "ignored": 0
  },
  "25-post-autoapproval": {
    "passed": 52,
    "failed": 0,
    "ignored": 0
  },
  "26-post-p3a": {
    "passed": 2,
    "failed": 0,
    "ignored": 0
  },
  "27-post-related-frontend": {
    "total": 68,
    "passed": 68,
    "failed": 0,
    "files": [
      {
        "file": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScope.test.ts",
        "passed": 15,
        "failed": 0
      },
      {
        "file": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeObservability.test.ts",
        "passed": 18,
        "failed": 0
      },
      {
        "file": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeOrchestration.test.ts",
        "passed": 26,
        "failed": 0
      },
      {
        "file": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeTauriBridge.test.ts",
        "passed": 9,
        "failed": 0
      }
    ],
    "failedNames": []
  },
  "28-post-combined-frontend": {
    "total": 76,
    "passed": 76,
    "failed": 0,
    "files": [
      {
        "file": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScope.test.ts",
        "passed": 15,
        "failed": 0
      },
      {
        "file": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeObservability.test.ts",
        "passed": 18,
        "failed": 0
      },
      {
        "file": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeOrchestration.test.ts",
        "passed": 26,
        "failed": 0
      },
      {
        "file": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeTauriBridge.test.ts",
        "passed": 9,
        "failed": 0
      },
      {
        "file": "src/features/corporateActions/__tests__/corporateActionDividendWriteStageTauriBridge.test.ts",
        "passed": 8,
        "failed": 0
      }
    ],
    "failedNames": []
  },
  "29-post-typecheck": {
    "passed": true
  },
  "30-post-cargo-check": {
    "passed": true
  },
  "31-post-vite-build": {
    "passed": true
  }
}

## Exact changed file SHA256
- src-tauri-shell/src/database.rs 24CF19D993A4E4448599E6D255F7803D9B820CFBBE6FF6C672E26B523C701A97 75763 bytes
- src-tauri-shell/src/database/corporate_action_imports.rs B187CD15A9E36AE16418C066DA579BBEF7947A998DF9A0858E9E6ABE0C835CFB 581377 bytes
- src-tauri-shell/src/main.rs 581A81FEC2524B5FE05F0BE4F21366B7B148315993FCD3210EADE87EED6604C5 51248 bytes
- src/types/desktop.ts F4D6186D0F25FBDE646EA04E28B8F98982761E6B5427860E092AB72464B4DB4E 62692 bytes
- src/platform/types.ts FB7F7186A53873BEE02BE0A684648BB644A1CA44A0364AED4F8A4F719A6D91D3 11572 bytes
- src/platform/tauriDesktop.ts DDF09A9662E90FD3960A988E7F1E7267B6AAABB6C684BF38457595AC05C6A39E 25903 bytes
- src-tauri-shell/src/database/corporate_action_imports/simple_cash_dividend_write_stage_bridge_tests.rs DA8062DB0DDDD20C64D212D23FF7FCF2BE80607AD559951780C73DD757705FAA 6946 bytes
- src/features/corporateActions/__tests__/corporateActionDividendWriteStageTauriBridge.test.ts 6D41671B537D4F82CE9E19FB15C95C2CD2B6B195ADEC5EFB3772E7DB2492BF76 4664 bytes

## Limitations and risks
Transport registration allows potential future calls but no caller/activation was introduced. No EOD launch, live DB writes, Load & Prepare, schema, Git, dependency retrieval or network. All tests used isolated source copies / offline Cargo; native runtime side-effect testing and Phase5E4 remain separate.

## Rollback guidance
Restore the six modified files from E:\TA Projects\EOD Charting Platform\backups\pre_ca_div_write_bridge_oct15_2026-10-15_1202_IST_e7bf10fd and delete only the two new test files if still matching the recorded POST hashes. Verify entire 631-file PRE authority before any rollback acceptance.

## Authority
Parent preflight SHA 4FFD494AE3C8FE463BA852F868DFC9BFB5123C038A6E7B220BCC41DFAD9D4CAA; failed Oct15 formatting evidence SHA 49D98D70A2B50F0755DE184A929C0418B56AC7B0B53AFCA8FF2239384F27F9D2; RESUME1 failed GREEN SHA 81B34E35DBA28A9FC9D9ADBC1D519148C266332F66072B41354606658083DC6C; RESUME2 failed P4B SHA 2C8335FAF688EF811912939221B84F1E6FA7ABAFF22864E24807C1DAD6658766; RESUME3 failed P4A-count SHA 5A45FC6782F7123D865BB8E9E56DCCEC1CC035E56DE537AB88CBADA036C6627E; PRE 631 CCBF331F8FC4B4E9BD638190B25BAF4E605F0CB44E4A75D4CFEAC279DE2A2EE5; POST 633 artifact in evidence.
