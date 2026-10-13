# CA_DIVIDEND_ADJUSTMENT_BASIS_SHARED_SEAM_TDD_R1

IST timestamp: 2026-10-05T16:37:51+05:30
Active workstream/root: `E:\TA Projects\EOD Charting Platform`.

## Objective
Extract the existing Dividend previous-trade-close and adjustment-factor calculation into a shared, non-mutating backend basis seam. The ordinary Dividend writer must consume that seam so a later separately authorized read-only policy evaluator can reuse exactly the same local-price selection and factor arithmetic.

## Previous limitation
The current Dividend writer computes cash validation, previous-close selection and `previous_close / (previous_close - cash)` inline inside `compute_adjustment_factor`. The accepted Dividend Policy Contract R1 requires a shared basis containing `previous_trade_date`, `previous_close`, `cash_amount` and `computed_factor` before any future policy evaluator is implemented. Duplicating the formula in `auto_approval.rs` is explicitly prohibited.

## Source authority
- Accepted source snapshot SHA256: `3FBFDD747B7DA665D01F266A64EF06E42086B9AEDE87EC40C917077218AF3D3C`.
- Accepted classifier installation evidence SHA256: `C83A4CAE81C6ABD13B8BB99623A66A8BAB0D8B8DA4220D88C1C220BE079EE32F`.
- Accepted protected source/config PRE population: `597` exact rows.
- Target PRE `instrument_mutations.rs`: `39A37CEC5360648654FCC1FE3F66105655CDC68E9B907BFF77B68984F29B4C82`, 77712 bytes.
- Approved policy-contract design SHA256: `B219A454744D2D1876A737362BDA582E1BDD1F0DC4CB04DA9312133D7E568CC1`.

## Files changed
- `src-tauri-shell/src/database/instrument_mutations.rs` only.
- This required change record is created after successful installation.

No Cargo manifest/lock, DB/schema, Corporate Action auto-approval, classifier, frontend, desktop/Tauri bridge, setting, Prepare routing or packaging file changes are part of this task.

## Final implementation
- Add internal immutable `DividendAdjustmentBasis` with `previous_trade_date`, `previous_close`, `cash_amount` and `computed_factor`.
- Add `load_dividend_adjustment_basis(...)`, a non-mutating helper that validates cash using the existing `require_positive_adjustment_number` label/error, loads the exact same local previous-trading-row authority, and computes the exact existing Dividend factor.
- Refactor previous-close loading through `PreviousTradeCloseBasis` so Dividend can retain the selected trade date while the existing Rights caller still receives the same previous close through the compatibility wrapper.
- Change only the Dividend branch of `compute_adjustment_factor` to return the shared basis `computed_factor`.
- Keep the existing generic factor-validity check in `record_price_adjustment_action` unchanged, including its handling of non-finite factors.
- Add five focused pure tests for factor/date preservation, existing cash>=close error, existing nonpositive-close error precedence, current NaN-to-generic-validation behavior, and exact no-rounding arithmetic.

## Behavior preserved
- Existing manual Dividend writer semantics and user-visible error strings.
- Previous local price selection: reverse current unified rows and select the first row whose date is strictly before effective date.
- Existing Rights previous-close behavior and TERP math.
- Generic adjustment-factor finite/positive/non-unity validation.
- Raw EOD prices remain unchanged.
- Split/Bonus Safe V2, `AUTO_APPROVAL_SAFE_V2`, classifier R1, R1-B4 identity/provenance, k=0.40, confidence and same-date logic.
- No Dividend policy evaluator, batch, write, command, setting, UI or Prepare activation.

## Validation plan / target-host evidence required
1. Exact `597`-file live PRE authority and preserved-owner hashes.
2. Existing pure adjustment baseline: 2/2.
3. Expected compiler RED: `compute_dividend_adjustment_basis_from_values` absent from unmodified source (`E0425`), with zero runtime tests.
4. Candidate GREEN contract probe 1/1.
5. New seam tests 5/5.
6. Affected pure regression 8/8 (2 existing + 5 seam + 1 contract probe), no ignored tests.
7. Rustfmt baseline-debt parity: exact accepted PRE and candidate owner are both checked with the same installed rustfmt; their canonical formatting diffs must be identical. The accepted PRE is not globally rustfmt-clean, so RESUME1 must prove the candidate adds zero new formatting debt rather than reformat unrelated historical code.
8. `cargo check --locked --offline --no-default-features --tests --jobs 1` in a run-owned reconstructed current Rust source copy.
9. Exact source-only scoped backup; install only after all candidate gates.
10. Post-install 8/8 pure regression, repeated offline Cargo check in a fresh run-owned copy, and exact `597`-file protected POST authority.

No DB test/runtime fixture is executed; Cargo compiles the crate/tests but does not run DB-backed tests.


## RESUME1 rustfmt correction

Parent evidence SHA256: `1A9FA72DA1C00FAA7510330D1707D678323753112EFA634BA01F31E1B925AFC7`.

The parent run proved the expected E0425 RED, contract probe 1/1, new seam 5/5, and affected pure regression 8/8, then stopped before Cargo check, backup, or installation at the whole-file rustfmt gate. Rustfmt identified three formatting changes in the newly added seam tests plus three pre-existing rustfmt diff regions (four formatting rewrites) in unrelated historical tests already present in the accepted PRE owner.

RESUME1 applies only rustfmt's three formatting changes to the newly added tests. It does **not** reformat the three unrelated accepted PRE diff regions. Validation therefore checks the exact PRE owner and candidate owner with the same rustfmt and requires their canonical rustfmt diff bodies to be identical. This proves the candidate introduces zero formatting debt while preserving accepted historical bytes outside this task.

Live installation remains gated behind this parity check, offline Cargo compilation, exact PRE recheck and scoped backup.

## Risks / limitations
- This seam deliberately does not implement the Policy Contract R1 freshness ceiling (`1..=7` days); that is a future evaluator policy gate. It only exposes the writer-selected previous trade date and preserves writer behavior.
- This seam deliberately does not reject NaN previous-close output earlier than today. The existing writer's downstream generic factor-validity guard remains authoritative, preserving current error precedence.
- `load_dividend_adjustment_basis` is backend-internal and currently has no auto-approval caller.
- Rights now obtains its close through the date-bearing internal previous-close helper and compatibility wrapper; focused existing rights math and full Cargo compilation must remain green.

## Rollback guidance
Before installation, no live rollback is needed. After installation, restore only `instrument_mutations.rs` from this run's exact source-only backup if and only if the live bytes still equal this task's postimage. On unexpected concurrent drift, refuse automatic rollback and stop for manual review. Do not restore a whole project or any database.

## Candidate hash
- PRE: `39A37CEC5360648654FCC1FE3F66105655CDC68E9B907BFF77B68984F29B4C82` (77712 bytes)
- POST: `8477709924F1AEAC7F45C8D4477C39300C14B5A4AB1715F086EBA8E285590A02` (81337 bytes)

## Network disposition
Phase5E4 remains `OPEN / UNSATISFIED / DEFERRED`. This task does not consume or change that gate.

Target-host command receipts/results are appended only after successful validation and installation.


## Target-host completion receipt

- 00-controller-selftests: exit=0; log SHA256=2E72F11452017CAAAC060CAFC8047D836CF0B73D36DB721F97F8D4546DD8F196
  Command: ["C:\\Program Files\\nodejs\\node.exe","--test","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\payload\\tools\\controller.test.cjs"]
- 01-rustc-version: exit=0; log SHA256=BC35C51DC7D2BB4C4F32AEB16F731FE38622803B7ADA97CF0E296B1BA92CDAFD
  Command: ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\rustc.exe","--version","--verbose"]
- 02-cargo-version: exit=0; log SHA256=7B6778B336445CEA138966D146FB89F9A4E0B0833BAC3DBADEE4B3837DAFFBF0
  Command: ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\cargo.exe","--version"]
- 03-baseline-compile: exit=0; log SHA256=01BA4719C80B6FE911B091A7C05124B64EEECE964E09C058EF8F9805DACA546B
  Command: ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\rustc.exe","--edition=2021","--crate-name","ca_dividend_basis_r1","--test","--error-format=json","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\pure\\03-baseline-compile.rs","-o","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\pure\\03-baseline-compile.exe"]
- 04-baseline-list: exit=0; log SHA256=570721F560B334F7177BDCFFB99BA1A35FEF3F1F965507B26CB9F76CCD2B0BC4
  Command: ["E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\pure\\03-baseline-compile.exe","--list"]
- 05-baseline-pure-regression: exit=0; log SHA256=BA4E73600BF251F5248FDAC49E78507660D135529A61D744A257B0B4EA0224B5
  Command: ["E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\pure\\03-baseline-compile.exe","--test-threads=1","--color","never"]
- 06-red-missing-seam: exit=1; log SHA256=42506E4FF1CF804C11A5635F2AB6BB33B911B9FB148812EC5EC315A8B73D13CC
  Command: ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\rustc.exe","--edition=2021","--crate-name","ca_dividend_basis_r1","--test","--error-format=json","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\pure\\06-red-missing-seam.rs","-o","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\pure\\06-red-missing-seam.exe"]
- 07-green-compile: exit=0; log SHA256=01BA4719C80B6FE911B091A7C05124B64EEECE964E09C058EF8F9805DACA546B
  Command: ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\rustc.exe","--edition=2021","--crate-name","ca_dividend_basis_r1","--test","--error-format=json","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\pure\\07-green-compile.rs","-o","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\pure\\07-green-compile.exe"]
- 08-green-list: exit=0; log SHA256=5AB59033CDD210C299C94581D2F2BA1601B322194FC236427C8F19272D199357
  Command: ["E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\pure\\07-green-compile.exe","--list"]
- 09-green-contract-probe: exit=0; log SHA256=1B6F9AEA3D47DCE4FC91D321AD105F27CF187DDD391C410BDBCF6E6E5C39C96B
  Command: ["E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\pure\\07-green-compile.exe","--test-threads=1","--color","never","basis_contract_probe"]
- 10-green-new-seam: exit=0; log SHA256=C26FE41C6E22873C0AFC69F570FCAD29B6186C65E865598F50CFEB0F4EDB718D
  Command: ["E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\pure\\07-green-compile.exe","--test-threads=1","--color","never","dividend_basis_shared_seam_"]
- 11-affected-pure-regression: exit=0; log SHA256=B17AF47384EB3F83DB0054ABB150D4808879A78D82555DE1BCD743E900887F04
  Command: ["E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\pure\\07-green-compile.exe","--test-threads=1","--color","never"]
- 12a-rustfmt-baseline-debt: exit=1; log SHA256=BB30DAC4D07076D0B8C6BF00EC5E69DAD8ADDF1B0A58E7A5DBD791C81A56E2CA
  Command: ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\rustfmt.exe","--edition","2021","--check","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\payload\\authority\\pre-instrument_mutations.rs"]
- 12b-rustfmt-candidate-debt: exit=1; log SHA256=92C0E2B89984306699F8CA0012705DC14B518B0691E41CD9FF6ED38883C1406B
  Command: ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\rustfmt.exe","--edition","2021","--check","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\candidate\\src-tauri-shell\\src\\database\\instrument_mutations.rs"]
- 13-cargo-check-candidate: exit=0; log SHA256=1CDBA80E2988A4D92C85F62FC12B502448D0A1CAEFFA299D240963ED62120333
  Command: ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\cargo.exe","check","--manifest-path","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\13-cargo-check-candidate-source\\src-tauri-shell\\Cargo.toml","--locked","--offline","--no-default-features","--tests","--jobs","1","--target-dir","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\13-cargo-check-candidate-target"]
- 14-scoped-preedit-backup: exit=0; log SHA256=E8D09D04D53CD880DF306388CAE20F7F366B567DB868A1C8DE36CA96E5503785
  Command: ["C:\\Program Files\\WindowsApps\\Microsoft.PowerShell_7.6.6.0_x64__8wekyb3d8bbwe\\pwsh.exe","-NoProfile","-NonInteractive","-Command","$ErrorActionPreference='Stop'; $t=$null; $e=$null; [void][System.Management.Automation.Language.Parser]::ParseFile('E:\\TA Projects\\EOD Charting Platform\\scripts\\create-project-backup.ps1',[ref]$t,[ref]$e); if(@($e).Count -ne 0){throw 'Backup helper parser failed'}; & 'E:\\TA Projects\\EOD Charting Platform\\scripts\\create-project-backup.ps1' -ShortName CA_DIVIDEND_BASIS_SHARED_SEAM_R1 -Paths @('src-tauri-shell/src/database/instrument_mutations.rs')"]
- 15-installed-compile: exit=0; log SHA256=01BA4719C80B6FE911B091A7C05124B64EEECE964E09C058EF8F9805DACA546B
  Command: ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\rustc.exe","--edition=2021","--crate-name","ca_dividend_basis_r1","--test","--error-format=json","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\pure\\15-installed-compile.rs","-o","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\pure\\15-installed-compile.exe"]
- 16-installed-list: exit=0; log SHA256=5AB59033CDD210C299C94581D2F2BA1601B322194FC236427C8F19272D199357
  Command: ["E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\pure\\15-installed-compile.exe","--list"]
- 17-installed-pure-regression: exit=0; log SHA256=B17AF47384EB3F83DB0054ABB150D4808879A78D82555DE1BCD743E900887F04
  Command: ["E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\pure\\15-installed-compile.exe","--test-threads=1","--color","never"]
- 18-post-install-cargo-check: exit=0; log SHA256=F23B97CD88BF10D5A4C47EBADD6458FC7CA74883AFD4B039FDA26B6363058F55
  Command: ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\cargo.exe","check","--manifest-path","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\18-post-install-cargo-check-source\\src-tauri-shell\\Cargo.toml","--locked","--offline","--no-default-features","--tests","--jobs","1","--target-dir","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_BASIS_R1_RESUME1_ccd220a8\\18-post-install-cargo-check-target"]

Final native results: baseline 2/2; expected E0425 RED; probe 1/1; new seam 5/5; affected 8/8; installed 8/8; candidate and post-install offline locked Cargo checks PASS; rustfmt baseline-debt parity PASS (candidate adds no new formatting debt). No DB tests executed.
