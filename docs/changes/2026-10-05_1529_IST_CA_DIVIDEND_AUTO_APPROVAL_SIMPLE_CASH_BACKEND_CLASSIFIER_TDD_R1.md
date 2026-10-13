# CA_DIVIDEND_AUTO_APPROVAL_SIMPLE_CASH_BACKEND_CLASSIFIER_TDD_R1

IST preparation timestamp: 2026-10-05T15:29:20+05:30

## Objective
Add a pure, inactive backend classifier for simple explicit per-share cash Dividend wording and a pure stored-cash revalidation helper. Do not activate autonomous Dividend policy or writers.

## Source authority
Active root: `E:\TA Projects\EOD Charting Platform`.
Snapshot `2026-10-05_141122_IST`: `3FBFDD747B7DA665D01F266A64EF06E42086B9AEDE87EC40C917077218AF3D3C`.
Accepted skipped-focus installation evidence: `ACAE0F29293CC7A526A217478845206A3357DF96417465A463AFF6556DC3F49E`.
Current source manifest: `A4F50EC99E52EFE91FE9B2275E339E981C76BFDB19CB5F52D62C9FDF0D88BB2A` (595 source/config files).
The candidate is assembled from the snapshot plus only the two exact accepted UI/test postimages and the corresponding installed change record. This is a documented authority chain, NOT a fresh 15:xx snapshot or rollback to the old UI. The target runner verifies all 595 live source/config files and their exact population before installation.

## Previous limitation
The existing manual parser can safely parse many Dividend, multi-component and unit-distribution forms. Its PARSED result alone does not indicate a simple single per-share cash-dividend evidence class, and its human-readable message is not a policy contract.

## Files changed
- Modified `src-tauri-shell/src/database/corporate_action_imports.rs`: module/test declarations only (169-byte prefix); original parser and every existing function remain byte-identical.
- Created `src-tauri-shell/src/database/corporate_action_imports/simple_cash_dividend_evidence.rs`: typed pure classifier and stored-value revalidation.
- Created `src-tauri-shell/src/database/corporate_action_imports/simple_cash_dividend_evidence_tests.rs`: 33 pure Rust tests, including table-driven retained fixtures and rejection cases.
- Created this change record; a successful target run appends actual command results and IST completion time.

## Final implementation
`classify_simple_cash_dividend_evidence(purpose_raw)` returns `EligibleSimpleCash(f64)` or `Ineligible(SimpleCashDividendReason)`.
`revalidate_simple_cash_dividend_evidence(purpose_raw, Option<f64>)` also requires a finite positive stored value exactly equal to the existing parser-derived amount. It reads no database.

The lexical gate recognizes a narrow complete form: optional Interim/Final, Dividend/Div, optional single separator (- or :), an existing currency marker (Rs[.], Re[.], INR or rupee sign), unsigned decimal with optional /- terminator, and explicit per share (optional final period). Case/whitespace variations are accepted. The grammar checks structure only; it never parses, aggregates or rounds the amount. Numeric conversion and positive/finite validation use the existing purpose parser and positive_number helper. There is no epsilon or new cash-normalization policy.

Reject multiple Dividend components, inclusive wording, special dividends (including standalone specials in this deliberately conservative R1), unit/mixed distributions, compound actions, unsupported/conditional/cancelled wording, percent-only amounts, extra numbers, signed amounts, scientific/grouped numerals, missing per-share/currency evidence, nonpositive/nonfinite amounts and stored-cash mismatch. Existing manual parsing for these cases is unchanged.

Eligibility here is evidence-shape classification only. It establishes neither exchange identity nor event authenticity. The helper does NOT establish NSE/PENDING/symbol/ex-date/source/provenance/same-date-peer or previous-close authority; those belong to a separately approved future policy. No call was added in auto_approval.rs, Prepare, the writer, settings or the UI. No policy version/decision is activated.

## Behavior preserved
All existing parser/tokenization helpers; Dividend manual approval and adjustment math; Split/Bonus Safe V2, R1-B4, k=0.40 and G=7; Legacy UI and skipped-focus/observability behavior; bridge/types, RootApp, settings, DB schema and raw EOD history; Rights/BSE/Demerger/manual complex-event handling.
Phase5E4 strict network gate remains OPEN / UNSATISFIED / DEFERRED. Prior runtime and Sandbox enablement authorities remain consumed and are not reused.

## Validation design and actual generation results
Generation environment has no rustc, Cargo or PowerShell executable. **No Rust compile/test/Cargo check or native Windows parser pass is claimed during package preparation.**
Generation checks: accepted archive hashes/CRC and 24-entry evidence manifest verified; 595-file accepted source population reconstructed and verified; candidate source bytes/sizes and additive parent wiring verified; 36 existing pure parser functions, exact ParsedAction structure and 20 existing pure fixture functions hash-bound; Node controller selftests and JavaScript syntax checks performed with logs included.

Target validation is serial:
1. Verify exact current 595-file source population, candidate contracts, and locally installed compiler paths. No rustup/installer/dependency retrieval.
2. rustc --test baseline harness: the 20 named existing pure parser fixtures only.
3. Genuine module-absent compile RED after adding module/test wiring without the classifier file. No stub evaluator and no claimed runtime RED test count.
4. Add classifier. Compile the same pure-source harness; verify all 53 registered test names. Execute new classifier 33/33 and combined affected pure suite 53/53.
5. Cargo check --locked --offline --no-default-features --tests --jobs 1 with run-owned target directory. This checks the real Tauri crate/module/test integration without running the DB test suite or embedding a frontend/release app.
6. Recheck live/candidate hashes, use existing scoped backup helper for only the original parent source, then atomically install the three declared source/test paths from run-owned staging.
7. Verify installed 597-file population; compile and run all 53 pure tests against installed files; record hashes and actual command results. No post-install Cargo build is run on the live source root; the exact installed source equals the integration-checked candidate.

The pure harness is generated under tmp from EXACT hash-verified existing source items and fixture bodies, plus path references to the actual new module/test files. It contains no database/Tauri stub or second production parser. Its purpose is to execute Rust tests without accidentally running any of the many SQLite fixtures in the canonical module. Cargo check --tests separately verifies canonical module integration.

## Build-system locations
All compiler executables, harness source, logs, target artifacts and source staging for this task are under the run-owned project tmp directory. Source directories remain source-only. The unchanged Tauri build.rs may regenerate its established gen/schemas outputs in the TEMPORARY candidate; their guarded content/population must still match before installation. No live gen/schemas or live dist output is produced by this runner.

## Risks and limitations
Native Windows Rust/MSVC tools and cached dependencies must already exist. Offline Cargo check fails without installing/downloading missing crates. Its first dependency compile can take several minutes even with no tests executing; commands run with one Cargo job. Full workspace/DB test suites, release/custom-protocol packaging, EOD/manual runtime checkpoints and final network acceptance are not performed.
The dormant API can cause expected dead-code warnings until future integration. No warning suppression or looser compiler checks are added.

## Rollback guidance
Before target installation, discard only the candidate. After a failed post-install gate, the runner restores only its exact owned postimages: the original parent from the verified scoped backup; new module/test files are removed only if their SHA256 still matches the installed candidate. Concurrent source drift stops automatic rollback for that path. No database/whole-project/Sandbox rollback is authorized. Preserve all evidence.

## Relevant hashes
- `src-tauri-shell/src/database/corporate_action_imports.rs` PRE `4ABCAE58416AA0B6683AB7C087C894A5412D21120B2DC38F0181F4783C1DE854` / POST `52895C6FF5BCD9231FB87946F15D968FE38A42D777DBE4B4A1BD1FB8A3058FC3` / POST bytes `569120`
- `src-tauri-shell/src/database/corporate_action_imports/simple_cash_dividend_evidence.rs` PRE `None` / POST `94F83E8ABBA3B9102EAB7D548583D4A02C7879361D74F4010519BE8222C60176` / POST bytes `7017`
- `src-tauri-shell/src/database/corporate_action_imports/simple_cash_dividend_evidence_tests.rs` PRE `None` / POST `C069BE75CD37F223709E7C0B414296011FAE34AAB8314F6ABAA614858213FC1F` / POST bytes `11025`

## Target status
Without a target-host validation receipt appended below, this file describes a prepared candidate only, not a validated Windows installation.

## Target-host validation receipt

IST completed: 2026-10-05T16:06:24.611+05:30

- 00-controller-selftests: exit 0; log SHA256 8443E3274277CABA0DF8A4BFC44C2C4B980EB1B0F31071557222CA02A2E61589
  ["C:\\Program Files\\nodejs\\node.exe","--test","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_R1_RESUME2_ebbb1962\\payload\\tools\\controller.test.cjs"]
- 01-rustc-version: exit 0; log SHA256 5477F9BAD65B15C4C5B31FC050FC72FEBA651EA1B330BC75CF356A4D6B0FBC80
  ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\rustc.exe","--version","--verbose"]
- 02-cargo-version: exit 0; log SHA256 1F88EAF7FE1AAEC83184752CF4C944CD22F00184136FF36A3E4C318CC60EF566
  ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\cargo.exe","--version"]
- 03-baseline-compile: exit 0; log SHA256 E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855
  ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\rustc.exe","--edition=2021","--crate-name","ca_dividend_pure_r1","--test","--error-format=json","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_R1_RESUME2_ebbb1962\\pure\\03-baseline-compile.rs","-o","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_R1_RESUME2_ebbb1962\\pure\\03-baseline-compile.exe"]
- 04-baseline-list: exit 0; log SHA256 50AFB4547B33FE8AA789533BA5FFCA8FF8E23A8AF64F966EA3C5564044E023B9
  ["E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_R1_RESUME2_ebbb1962\\pure\\03-baseline-compile.exe","--list"]
- 05-baseline-parser-regression: exit 0; log SHA256 83C76365833D2851C41BF67F154704D882934B75E5692FD7A463FCE34B056578
  ["E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_R1_RESUME2_ebbb1962\\pure\\03-baseline-compile.exe","--test-threads=1","--color","never"]
- 06-red-module-absent: exit 1; log SHA256 94A7BE31A75C32C126D13EA25972723ABB1D3A996613FA752B749520942D2135
  ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\rustc.exe","--edition=2021","--crate-name","ca_dividend_pure_r1","--test","--error-format=json","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_R1_RESUME2_ebbb1962\\pure\\06-red-module-absent.rs","-o","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_R1_RESUME2_ebbb1962\\pure\\06-red-module-absent.exe"]
- 07-green-compile: exit 0; log SHA256 E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855
  ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\rustc.exe","--edition=2021","--crate-name","ca_dividend_pure_r1","--test","--error-format=json","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_R1_RESUME2_ebbb1962\\pure\\07-green-compile.rs","-o","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_R1_RESUME2_ebbb1962\\pure\\07-green-compile.exe"]
- 08-green-list: exit 0; log SHA256 0371A37A1D463A73D5DDA4061F586A973F824F1B94188F7910322361A6FF03C9
  ["E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_R1_RESUME2_ebbb1962\\pure\\07-green-compile.exe","--list"]
- 09-green-classifier: exit 0; log SHA256 A8353CF3088049D60D96F701345CC4703F841FBFDA1F32B3D39C6E438F805333
  ["E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_R1_RESUME2_ebbb1962\\pure\\07-green-compile.exe","database::corporate_action_imports::simple_cash_dividend_evidence_tests::","--test-threads=1","--color","never"]
- 10-affected-pure-regression: exit 0; log SHA256 E68256E903B6F9816B1A2F37B54496B514FB2D96E8E4E7022456FBAE9021019A
  ["E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_R1_RESUME2_ebbb1962\\pure\\07-green-compile.exe","--test-threads=1","--color","never"]
- 11-cargo-check-tests-offline: exit 0; log SHA256 E73FC5B52D633A3E07E01436407BD02BB9ED3092585C3483B909965C5E2B65DF
  ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\cargo.exe","check","--manifest-path","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_R1_RESUME2_ebbb1962\\candidate\\src-tauri-shell\\Cargo.toml","--locked","--offline","--no-default-features","--tests","--jobs","1","--target-dir","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_R1_RESUME2_ebbb1962\\cargo-target"]
- 12-scoped-preedit-backup: exit 0; log SHA256 2CB060BF3C69A3C0E0A80C581BEC0D42185F10AD3FA1BA9B89BBF4D393A5A807
  ["C:\\Program Files\\WindowsApps\\Microsoft.PowerShell_7.6.6.0_x64__8wekyb3d8bbwe\\pwsh.exe","-NoProfile","-NonInteractive","-Command","$ErrorActionPreference='Stop'; $t=$null; $e=$null; [void][System.Management.Automation.Language.Parser]::ParseFile('E:\\TA Projects\\EOD Charting Platform\\scripts\\create-project-backup.ps1',[ref]$t,[ref]$e); if(@($e).Count -ne 0){throw 'Backup helper parser failed'}; & 'E:\\TA Projects\\EOD Charting Platform\\scripts\\create-project-backup.ps1' -ShortName CA_DIVIDEND_SIMPLE_CASH_CLASSIFIER_R1 -Paths @('src-tauri-shell/src/database/corporate_action_imports.rs')"]
- 13-installed-compile: exit 0; log SHA256 E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855
  ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\rustc.exe","--edition=2021","--crate-name","ca_dividend_pure_r1","--test","--error-format=json","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_R1_RESUME2_ebbb1962\\pure\\13-installed-compile.rs","-o","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_R1_RESUME2_ebbb1962\\pure\\13-installed-compile.exe"]
- 14-installed-list: exit 0; log SHA256 0371A37A1D463A73D5DDA4061F586A973F824F1B94188F7910322361A6FF03C9
  ["E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_R1_RESUME2_ebbb1962\\pure\\13-installed-compile.exe","--list"]
- 15-installed-pure-regression: exit 0; log SHA256 A1C413A023F7A6ED61DA4D39346AA0FAFD90AB23407315B659EDC09A35E77157
  ["E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_R1_RESUME2_ebbb1962\\pure\\13-installed-compile.exe","--test-threads=1","--color","never"]

Pure parser baseline: 20/20. New classifier: 33/33. Affected pure suite: 53/53. Installed pure suite: 53/53. All counts independently parsed from exact named Rust test output.

Cargo check compiled the real crate and test targets with --locked --offline --no-default-features --tests. It did not execute SQLite fixtures, launch EOD or validate a release executable. The installed source hashes match that checked candidate.

Backup: E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20261005_160621_CA_DIVIDEND_SIMPLE_CASH_CLASSIFIER_R1

Phase5E4 gate: OPEN / UNSATISFIED / DEFERRED. Dividend auto-approval activation: NONE.
