# P3A bridge regression authority alignment R1

IST timestamp: 2026-10-07T19:13:06+05:30

## Objective
Align inherited P3A assertions with accepted P4A/P4B without changing production.

## Previous defect
The test pinned pre-P4A whole-file SHA F93E8999227BB2ED0D251033192851CA814B7CC6D34C9AF2D4902F7DD9D5BB5F and scanned through neighboring private P4B functions until the next Tauri command.

## Files changed
- Modified only: src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeTauriBridge.test.ts
- Added: this mandatory change record.

## Final implementation
A local source-test helper identifies the unique top-level P3A function and ends at its own unindented closing brace. Missing/duplicate boundaries or inclusion of a neighboring top-level item fail closed. The two function-body cases use this helper. The historical hash case now pins the accepted P4A module at 121666 bytes and SHA 5C75FA10AF7354E5B83DFB8DD27F48C8EBF0678332DB19E87D1B7C5CA1C6A16F. All nine cases and six prohibited-operation assertions remain.

## Behavior preserved
All production source, P4A/P4B tests, read-only behavior, Safe V2, manual Apply, frontend orchestration, schema/settings and Tauri registration remain unchanged. No write bridge was added. Historical P4B evidence is not modified.

## Authority
Snapshot: Eod Charting Platform Source Code 2026-10-07_175517_IST.zip
Snapshot SHA: F6BEF9C1CEE9D99BED1D52C70E6A81437FCA9B8ACF16872AE7593602079E8C46
All 606 uploaded behavior/source rows matched accepted P4B. The upload omitted two historical README overlays; this runner nevertheless required all 608 local live rows.
P4B evidence SHA: A7BBEB21628E202FA0AD3838244A73086E7E671865BB85660BD5E9ECFCD8E432
Probe evidence SHA: 8D3CD11D980670C08ED409EF23D8D69CBF4CF11C3F7DD288AB2A94C9F4D36BC0
Target PRE: 6184 bytes / C82D3B22518C6FD0DD5C652EEC3A9FCE5631DA1B2A8B13837825DF578C4D0054
Target POST: 7009 bytes / 8B8BA9FD0AD3367262A630D1E75956B6DAB9DE0B02371760762E663D6D050909

## Actual validation results
```json
{
  "source_authority": {
    "live": 608,
    "behavior": 606,
    "historicalOverlaysPreserved": 2
  },
  "00-controller-selftests": {
    "passed": true
  },
  "01-assertion-preservation-probes": {
    "passed": true,
    "kind": "NODE_ADAPTER_NOT_VITEST",
    "sourceMutationProbes": 12
  },
  "02-native-pre-p3a-expected-red": {
    "files": [
      {
        "path": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeTauriBridge.test.ts",
        "tests": 9,
        "passed": 7,
        "failed": 2
      }
    ],
    "tests": 9,
    "passed": 7,
    "failed": 2,
    "skipped": 0,
    "expectedFailures": [
      "opens only the read-only connection and delegates to the closed P2 evaluator",
      "preserves the closed P2 evaluator byte-exact"
    ]
  },
  "03-native-pre-related-regressions": {
    "files": [
      {
        "path": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScope.test.ts",
        "tests": 15,
        "passed": 15,
        "failed": 0
      },
      {
        "path": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeObservability.test.ts",
        "tests": 18,
        "passed": 18,
        "failed": 0
      },
      {
        "path": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeOrchestration.test.ts",
        "tests": 26,
        "passed": 26,
        "failed": 0
      }
    ],
    "tests": 59,
    "passed": 59,
    "failed": 0,
    "skipped": 0,
    "expectedFailures": []
  },
  "04-native-candidate-dividend-regressions": {
    "files": [
      {
        "path": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScope.test.ts",
        "tests": 15,
        "passed": 15,
        "failed": 0
      },
      {
        "path": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeObservability.test.ts",
        "tests": 18,
        "passed": 18,
        "failed": 0
      },
      {
        "path": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeOrchestration.test.ts",
        "tests": 26,
        "passed": 26,
        "failed": 0
      },
      {
        "path": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeTauriBridge.test.ts",
        "tests": 9,
        "passed": 9,
        "failed": 0
      }
    ],
    "tests": 68,
    "passed": 68,
    "failed": 0,
    "skipped": 0,
    "expectedFailures": []
  },
  "05-native-candidate-typecheck": {
    "passed": true,
    "nativeCommand": true
  },
  "06-scoped-backup": {
    "passed": true,
    "backupRoot": "E:\\TA Projects\\EOD Charting Platform\\backups\\pre_p3a_bridge_alignment_2026-10-07_1912_IST_2500008a",
    "fileCount": 1
  },
  "07-native-post-dividend-regressions": {
    "files": [
      {
        "path": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScope.test.ts",
        "tests": 15,
        "passed": 15,
        "failed": 0
      },
      {
        "path": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeObservability.test.ts",
        "tests": 18,
        "passed": 18,
        "failed": 0
      },
      {
        "path": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeOrchestration.test.ts",
        "tests": 26,
        "passed": 26,
        "failed": 0
      },
      {
        "path": "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeTauriBridge.test.ts",
        "tests": 9,
        "passed": 9,
        "failed": 0
      }
    ],
    "tests": 68,
    "passed": 68,
    "failed": 0,
    "skipped": 0,
    "expectedFailures": []
  },
  "08-native-post-typecheck": {
    "passed": true,
    "nativeCommand": true
  },
  "09-final-authority": {
    "passed": true,
    "modifiedTestFiles": 1,
    "modifiedProductionFiles": 0,
    "live": 608,
    "behavior": 606,
    "preservedOtherLiveFiles": 607
  }
}
```

## Validation commands and evidence
```json
[
  {
    "label": "00-controller-selftests",
    "executable": "C:\\Program Files\\nodejs\\node.exe",
    "args": [
      "--test",
      "--test-reporter=tap",
      "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_P3A_ALIGN_R1_2500008a\\package\\tools\\controller.test.cjs"
    ],
    "cwd": "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_P3A_ALIGN_R1_2500008a\\package",
    "exitCode": 0,
    "signal": null,
    "error": null,
    "logSha256": "B66343B6B06052CA075A9915C20457E483649288FDC4782BF4B64F52CCAAB2EA"
  },
  {
    "label": "01-assertion-preservation-probes",
    "executable": "C:\\Program Files\\nodejs\\node.exe",
    "args": [
      "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_P3A_ALIGN_R1_2500008a\\package\\tools\\assertion-probes.cjs",
      "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_P3A_ALIGN_R1_2500008a\\pre",
      "E:\\TA Projects\\EOD Charting Platform\\node_modules\\typescript\\lib\\typescript.js",
      "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_P3A_ALIGN_R1_2500008a\\evidence\\ASSERTION_PROBES.json"
    ],
    "cwd": "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_P3A_ALIGN_R1_2500008a\\package",
    "exitCode": 0,
    "signal": null,
    "error": null,
    "logSha256": "0E03CBC302781EE680E0A7EAE0BCB4ADB583C8A4346043F8F8CE9D1A7CCE4CFC"
  },
  {
    "label": "02-native-pre-p3a-expected-red",
    "executable": "C:\\Program Files\\nodejs\\node.exe",
    "args": [
      "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_P3A_ALIGN_R1_2500008a\\pre\\node_modules\\vitest\\vitest.mjs",
      "run",
      "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeTauriBridge.test.ts",
      "--config",
      "vitest.config.ts",
      "--reporter=json",
      "--outputFile",
      "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_P3A_ALIGN_R1_2500008a\\evidence\\02-native-pre-p3a-expected-red.json",
      "--no-file-parallelism",
      "--maxWorkers=1"
    ],
    "cwd": "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_P3A_ALIGN_R1_2500008a\\pre",
    "exitCode": 1,
    "signal": null,
    "error": null,
    "logSha256": "D000C1AB690107F8B826CE0CCA6FAF80650F4E1C6DDCB8DA8A3FDA0FB50E3A93"
  },
  {
    "label": "03-native-pre-related-regressions",
    "executable": "C:\\Program Files\\nodejs\\node.exe",
    "args": [
      "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_P3A_ALIGN_R1_2500008a\\pre\\node_modules\\vitest\\vitest.mjs",
      "run",
      "src/features/corporateActions/__tests__/corporateActionDividendPreparedScope.test.ts",
      "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeOrchestration.test.ts",
      "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeObservability.test.ts",
      "--config",
      "vitest.config.ts",
      "--reporter=json",
      "--outputFile",
      "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_P3A_ALIGN_R1_2500008a\\evidence\\03-native-pre-related-regressions.json",
      "--no-file-parallelism",
      "--maxWorkers=1"
    ],
    "cwd": "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_P3A_ALIGN_R1_2500008a\\pre",
    "exitCode": 0,
    "signal": null,
    "error": null,
    "logSha256": "48892A5C3E39F5D09A746D92F873CDF067BEF5F2D8B905C03346BC02E0A4DB33"
  },
  {
    "label": "04-native-candidate-dividend-regressions",
    "executable": "C:\\Program Files\\nodejs\\node.exe",
    "args": [
      "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_P3A_ALIGN_R1_2500008a\\candidate\\node_modules\\vitest\\vitest.mjs",
      "run",
      "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeTauriBridge.test.ts",
      "src/features/corporateActions/__tests__/corporateActionDividendPreparedScope.test.ts",
      "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeOrchestration.test.ts",
      "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeObservability.test.ts",
      "--config",
      "vitest.config.ts",
      "--reporter=json",
      "--outputFile",
      "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_P3A_ALIGN_R1_2500008a\\evidence\\04-native-candidate-dividend-regressions.json",
      "--no-file-parallelism",
      "--maxWorkers=1"
    ],
    "cwd": "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_P3A_ALIGN_R1_2500008a\\candidate",
    "exitCode": 0,
    "signal": null,
    "error": null,
    "logSha256": "48467531E5BEF68A6599F74FBD018042D131D087D57589A143E9E85A779BFA63"
  },
  {
    "label": "05-native-candidate-typecheck",
    "executable": "C:\\Program Files\\nodejs\\node.exe",
    "args": [
      "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_P3A_ALIGN_R1_2500008a\\candidate\\node_modules\\typescript\\bin\\tsc",
      "-p",
      "tsconfig.json",
      "--noEmit",
      "--incremental",
      "false"
    ],
    "cwd": "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_P3A_ALIGN_R1_2500008a\\candidate",
    "exitCode": 0,
    "signal": null,
    "error": null,
    "logSha256": "01BA4719C80B6FE911B091A7C05124B64EEECE964E09C058EF8F9805DACA546B"
  },
  {
    "label": "07-native-post-dividend-regressions",
    "executable": "C:\\Program Files\\nodejs\\node.exe",
    "args": [
      "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_P3A_ALIGN_R1_2500008a\\post\\node_modules\\vitest\\vitest.mjs",
      "run",
      "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeTauriBridge.test.ts",
      "src/features/corporateActions/__tests__/corporateActionDividendPreparedScope.test.ts",
      "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeOrchestration.test.ts",
      "src/features/corporateActions/__tests__/corporateActionDividendPreparedScopeObservability.test.ts",
      "--config",
      "vitest.config.ts",
      "--reporter=json",
      "--outputFile",
      "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_P3A_ALIGN_R1_2500008a\\evidence\\07-native-post-dividend-regressions.json",
      "--no-file-parallelism",
      "--maxWorkers=1"
    ],
    "cwd": "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_P3A_ALIGN_R1_2500008a\\post",
    "exitCode": 0,
    "signal": null,
    "error": null,
    "logSha256": "A36E78329BBCE52C6609D59477F839EE5D02A6EE9D6DB716C9B9BA577060B806"
  },
  {
    "label": "08-native-post-typecheck",
    "executable": "C:\\Program Files\\nodejs\\node.exe",
    "args": [
      "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_P3A_ALIGN_R1_2500008a\\post\\node_modules\\typescript\\bin\\tsc",
      "-p",
      "tsconfig.json",
      "--noEmit",
      "--incremental",
      "false"
    ],
    "cwd": "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_P3A_ALIGN_R1_2500008a\\post",
    "exitCode": 0,
    "signal": null,
    "error": null,
    "logSha256": "01BA4719C80B6FE911B091A7C05124B64EEECE964E09C058EF8F9805DACA546B"
  }
]
```

## Risks and limitations
Source-text assertions are not runtime DB-effect proof. The extractor relies on the established top-level Rust formatting convention and fails closed at detectable boundary changes. The Node adapter/probes are not Vitest. Rust/Cargo, Vite/portable builds, EOD, Prepare, live DB and network were not run for this TypeScript test-only change. The generic validation script was not invoked because it executes Git and broader checks outside this bounded task.
Phase5E4 remains OPEN / UNSATISFIED / DEFERRED.

## Rollback
Restore only the exact PRE test from E:\TA Projects\EOD Charting Platform\backups\pre_p3a_bridge_alignment_2026-10-07_1912_IST_2500008a, then verify PRE SHA C82D3B22518C6FD0DD5C652EEC3A9FCE5631DA1B2A8B13837825DF578C4D0054. Do not restore any production file from older P2 material. Supersede this change record when an explicitly authorized rollback occurs.

## Next step
Audit the final evidence ZIP before continuing the already-approved write-bridge task. Bind that task to SOURCE_POST_LIVE_608.json, SOURCE_POST_BEHAVIOR_606.json and this test POST hash. No next task runs automatically.
