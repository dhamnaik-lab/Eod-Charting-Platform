# CA_DIVIDEND_AUTO_APPROVAL_SIMPLE_CASH_POLICY_EVALUATOR_TDD_R1

IST timestamp: 2026-10-05T18:41:49+05:30
Active workstream/root: `E:\TA Projects\EOD Charting Platform`

## Objective
Implement the approved **read-only** Simple Cash Dividend R1 backend eligibility evaluator. This stage must establish policy evidence and deterministic eligibility only. It does not approve/link a Corporate Action, record a policy decision, expose a command, add a setting, route Legacy Prepare, or change UI.

## Previous limitation
The accepted simple-cash classifier proved only narrow wording + exact stored cash. The accepted shared basis proved writer-identical previous-close/factor semantics. Neither combined NSE_API source witness, machine identity/provenance, same-date exclusion, existing-canonical exclusion or 1–7 day freshness into one policy decision.

## Source authority
- 14:11 snapshot SHA256 `3FBFDD747B7DA665D01F266A64EF06E42086B9AEDE87EC40C917077218AF3D3C`.
- accepted classifier evidence SHA256 `C83A4CAE81C6ABD13B8BB99623A66A8BAB0D8B8DA4220D88C1C220BE079EE32F`.
- accepted shared-basis evidence SHA256 `167C4F99C87C07BB0B556C78408BA0E77DB2952F268E29A391E5370C812CD0B2`.
- approved Policy Contract Design R1 SHA256 `B219A454744D2D1876A737362BDA582E1BDD1F0DC4CB04DA9312133D7E568CC1`.
- accepted protected source/config PRE: 597 exact rows.
- target PRE `F61DC24344D93B5AC75977AB38F973FBE785D482174FB4DC34B3112AEFF6CF6B` (52071 bytes).

## Files changed
- `src-tauri-shell/src/database/corporate_action_imports/auto_approval.rs` only.
- this change record after successful target validation.

## Final implementation
Adds policy constant `AUTO_APPROVAL_SIMPLE_CASH_DIVIDEND_R1`, distinct read-only evidence/eligibility types, exact persisted NSE_API source-witness lookup, and `evaluate_simple_cash_dividend_policy_r1(connection, folder_path, import_id)`.

Eligibility requires every approved Design R1 gate: unapproved ordinary row; NSE; source NSE_API; DIVIDEND; PARSED; PENDING; symbol; valid ex-date; finite positive cash-only stored semantics; installed simple-cash classifier exact cash revalidation; exactly one persisted NSE_API evidence row whose `purposeRaw` and `exDate` exactly match; no manual/exception provenance; current Safe-V2 machine identity proof; no same-date automatic-exclusion peer; no matching existing canonical Corporate Action; shared local Dividend basis; previous trade gap 1..=7 calendar days; finite positive close; exact cash; finite factor >1 and existing non-unity validity.

Official evidence receipt fields exposed by the evaluator: evidence row id, capture timestamp, optional source locator, cash amount, previous trade date/close, computed factor, and identity proof.

Known deterministic basis failures remain `Ineligible`; unexpected local price/SQLite operational errors propagate as `AppResult::Err` rather than being relabeled as policy skips.

## Behavior preserved
`evaluate_auto_approval_r1`, `AUTO_APPROVAL_SAFE_V2`, current batch/write/savepoint/audit code, k=0.40, confidence >=0.95, Split/Bonus ex-side G=7, manual Dividend writer, shared Dividend basis, Rights, classifier, Legacy Prepare, UI, settings and schema are unchanged. No new call to `approve_corporate_action_import_without_transaction` or `record_corporate_action_import_decision` is introduced by the Dividend evaluator.

## TDD/validation contract
Target runner must prove:
1. exact 597-row PRE and preserved-owner hashes;
2. test-only RED candidate fails compilation specifically with E0425 for missing `evaluate_simple_cash_dividend_policy_r1`;
3. GREEN runs exactly 18 `dividend_policy_r1_*` in-memory SQLite/temp-path tests;
4. all 23 pre-existing Safe-V2/Auto-Approval/R1-B4 tests still pass;
5. evaluator read-only test proves no canonical action, decision, or import-status mutation;
6. accepted-PRE vs candidate rustfmt debt parity (no new debt);
7. offline locked Cargo check with tests compiled;
8. exact PRE recheck + scoped backup;
9. install only `auto_approval.rs`;
10. repeat all 41 focused tests and offline Cargo check post-install;
11. exact 597-row POST + preserved hashes.

The focused Rust tests use in-memory SQLite and a non-created temporary price-folder path only. They do not open/copy/query the live project database and do not launch EOD.

## Risks / limitations
This stage does not implement invocation/preparation-scope pinning, policy batch result, decision receipt persistence, transaction/savepoint write discipline, setting/Prepare routing or UI observability. Those remain Stage P3/P4 and require separate approval. `NSE_CSV`, BSE, special/multiple/unit/compound Dividend and existing canonical-action auto-link remain manual-only. The 7-day policy is a fail-closed ceiling.

## Rollback
Before install: no live change. After an install failure, restore only the exact backed-up PRE `auto_approval.rs` when live bytes still match this candidate POST; otherwise withhold rollback for manual review. Do not restore the project/database wholesale.

## Candidate hashes
- RED test-only file `BC830BFC7DE91372ACF22B54EF7C7EEC02E71ED7A9CDC2530B1457FC0542498B` (52286 bytes).
- GREEN `249936DB0144BFA7ECA5BE163F9B73A68C1006F4C00F55614481624F59709BDC` (82700 bytes).

## Network disposition
Phase5E4 remains `OPEN / UNSATISFIED / DEFERRED`.
## RESUME1 controller sequencing correction

The first target run stopped before any Rust command because the controller called a GREEN-only evaluator-presence assertion against the unchanged baseline source. RESUME1 changes only controller validation sequencing: baseline validates preservation of existing Safe V2/write owners; GREEN and post-install validate those preserved owners plus the new Dividend evaluator/policy constant. Parent stop evidence SHA256: `195241DA76A92569819B07E7628479E9D0E4DE77AFB56CB4A0B19F3C24F61EDF`. Product candidate, RED file, policy tests, source authority and approved behavior are unchanged.



## RESUME2 fixture correction

The first native GREEN run reached all 18 Dividend policy tests; 12 passed and 6 stopped on the same in-memory schema error: `no such column: sector` from the accepted `eod_data::find_instrument_record` query. Production authority already selects `sector, industry` from `instruments`. RESUME2 changes only the focused in-memory test fixture schema to add nullable `sector TEXT` and `industry TEXT`. The production evaluator body is byte-identical to RESUME1.

Bound RESUME1 GREEN-failure evidence SHA256: `4DC47F66BB4441CB0F3EAC9C29EE6AA5007496CAEE21E509559633C902AEECD1`.


## RESUME4 rustfmt-preservation correction

RESUME2 proved baseline 23/23, expected E0425 RED, Dividend policy 18/18 and affected 41/41. RESUME3 then derived the 30 candidate-only rustfmt hunks but its selftest correctly stopped because one formatter hunk crossed the preservation boundary and reformatted the accepted `evaluate_auto_approval_r1` Safe V2 function. RESUME4 applies the same 30 candidate-only rustfmt hunks, then restores `evaluate_auto_approval_r1` byte-for-byte from accepted PRE before validation. The remaining candidate rustfmt debt must be a multiset subset of accepted PRE debt. No policy semantics or write path are changed.

Derived candidate SHA256: `0D79ABE14BAE86FD45B730F68D56205E438831FF13C3819A087989EA4E5B6E14` (84580 bytes).


## RESUME8 selftest-owner-source correction

RESUME5 re-proved baseline 23/23, E0425 RED, Dividend policy 18/18 and affected regression 41/41. Its rustfmt gate then proved the derived candidate had exactly one remaining candidate-only formatter hunk while 44 legacy hunks matched accepted PRE. That sole hunk is inside the new Dividend evaluator's machine-identity let-else statement. RESUME7 recognizes that the unmatched formatter signature occurs twice in the candidate: once in the new Dividend evaluator and once in the accepted Safe V2 evaluator. It selects the unique hunk whose full context occurs inside `evaluate_simple_cash_dividend_policy_r1`, applies only that hunk, and preserves the existing Safe V2 evaluator, Split/Bonus basis and batch/write function byte-for-byte. Final candidate SHA256: `FB96C923335130906A3D8680C7E97EF1EC75801BF2AA0EE311923BB1DA03B8A8` (84561 bytes).


## Target-host completion receipt

- 00-controller-selftests: exit=0; log SHA256=7C6AFBACD85E77A0272CC56D55186A1DDF7981D604C100DECE8A1321F64A6735
  Command: ["C:\\Program Files\\nodejs\\node.exe","--test","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_POLICY_R1_RESUME8_58535d5c\\parent-payload\\tools\\resume4-controller.test.cjs"]
- 01-rustc-version: exit=0; log SHA256=BC35C51DC7D2BB4C4F32AEB16F731FE38622803B7ADA97CF0E296B1BA92CDAFD
  Command: ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\rustc.exe","--version","--verbose"]
- 02-cargo-version: exit=0; log SHA256=7B6778B336445CEA138966D146FB89F9A4E0B0833BAC3DBADEE4B3837DAFFBF0
  Command: ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\cargo.exe","--version"]
- 03-baseline-preservation-tests: exit=0; log SHA256=42B52946B91142B519ECA69F39557CB538AF816D7EB30191D69774E1C09B7556
  Command: ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\cargo.exe","test","--manifest-path","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_POLICY_R1_RESUME8_58535d5c\\candidate\\src-tauri-shell\\Cargo.toml","--locked","--offline","--no-default-features","--jobs","1","--target-dir","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_POLICY_R1_RESUME8_58535d5c\\03-baseline-target","database::corporate_action_imports::auto_approval::tests::","--","--test-threads=1","--color","never"]
- 04-red-missing-evaluator: exit=101; log SHA256=3672609432AA641C2F2F713D57C913213D1A4621B49581F6E0BDA2FB9B5034CC
  Command: ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\cargo.exe","test","--manifest-path","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_POLICY_R1_RESUME8_58535d5c\\candidate\\src-tauri-shell\\Cargo.toml","--locked","--offline","--no-default-features","--no-run","--jobs","1","--target-dir","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_POLICY_R1_RESUME8_58535d5c\\04-red-missing-evaluator-target"]
- 05-green-dividend-policy-tests: exit=0; log SHA256=08B71DB33781DA18891A2C42203A1D95C34261389E0325B6F4B4D7ACC86718F8
  Command: ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\cargo.exe","test","--manifest-path","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_POLICY_R1_RESUME8_58535d5c\\candidate\\src-tauri-shell\\Cargo.toml","--locked","--offline","--no-default-features","--jobs","1","--target-dir","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_POLICY_R1_RESUME8_58535d5c\\05-green-target","dividend_policy_r1_","--","--test-threads=1","--color","never"]
- 05b-affected-auto-approval-regression: exit=0; log SHA256=F0CC465DD8FDE33A8BED43D6743771929B57008870E79513F9DB0B1C55B01D90
  Command: ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\cargo.exe","test","--manifest-path","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_POLICY_R1_RESUME8_58535d5c\\candidate\\src-tauri-shell\\Cargo.toml","--locked","--offline","--no-default-features","--jobs","1","--target-dir","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_POLICY_R1_RESUME8_58535d5c\\05b-affected-target","database::corporate_action_imports::auto_approval::tests::","--","--test-threads=1","--color","never"]
- 06a-rustfmt-pre: exit=1; log SHA256=2EC285A2F06FC0BD79D892C0DABBA50674AA77E2649D56CC5AB85CB781E8219C
  Command: ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\rustfmt.exe","--edition","2021","--check","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_POLICY_R1_RESUME8_58535d5c\\parent-payload\\authority\\current-rust-postimages\\src-tauri-shell\\src\\database\\corporate_action_imports\\auto_approval.rs"]
- 06b-rustfmt-candidate: exit=1; log SHA256=8CCCE5355049551433DF6B9A1D9E10D4E98BB2D4D2201EAEA3C4EC1B1E153C15
  Command: ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\rustfmt.exe","--edition","2021","--check","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_POLICY_R1_RESUME8_58535d5c\\candidate\\src-tauri-shell\\src\\database\\corporate_action_imports\\auto_approval.rs"]
- 07-cargo-check-candidate: exit=0; log SHA256=3502A72560A6983C7FBE027E32F9806F0606A79C96E436DC2C6AE79186AE91FE
  Command: ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\cargo.exe","check","--manifest-path","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_POLICY_R1_RESUME8_58535d5c\\candidate\\src-tauri-shell\\Cargo.toml","--locked","--offline","--no-default-features","--tests","--jobs","1","--target-dir","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_POLICY_R1_RESUME8_58535d5c\\07-cargo-check-candidate-target"]
- 08-scoped-preedit-backup: exit=0; log SHA256=C96540B515ECA8B15484E3DD1A19214070B5E5FE025274137D40BC2331A4A5F6
  Command: ["C:\\Program Files\\WindowsApps\\Microsoft.PowerShell_7.6.6.0_x64__8wekyb3d8bbwe\\pwsh.exe","-NoProfile","-NonInteractive","-Command","$ErrorActionPreference='Stop'; $t=$null; $e=$null; [void][System.Management.Automation.Language.Parser]::ParseFile('E:\\TA Projects\\EOD Charting Platform\\scripts\\create-project-backup.ps1',[ref]$t,[ref]$e); if(@($e).Count -ne 0){throw 'Backup helper parser failed'}; & 'E:\\TA Projects\\EOD Charting Platform\\scripts\\create-project-backup.ps1' -ShortName CA_DIVIDEND_SIMPLE_CASH_POLICY_EVALUATOR_R1 -Paths @('src-tauri-shell/src/database/corporate_action_imports/auto_approval.rs')"]
- 09-post-install-focused-regression: exit=0; log SHA256=73E4E46B8DDE26D7DEC34276D0B8035F3F1FC27CC31157CA8511A2DF45BD2D51
  Command: ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\cargo.exe","test","--manifest-path","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_POLICY_R1_RESUME8_58535d5c\\post-install-source\\src-tauri-shell\\Cargo.toml","--locked","--offline","--no-default-features","--jobs","1","--target-dir","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_POLICY_R1_RESUME8_58535d5c\\09-post-target","database::corporate_action_imports::auto_approval::tests::","--","--test-threads=1","--color","never"]
- 10-post-install-cargo-check: exit=0; log SHA256=0CEF4DFA80F1E94ED3722EFA68BA86E6B37D6F41434AD4F63531857321946A04
  Command: ["C:\\Users\\dharm\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin\\cargo.exe","check","--manifest-path","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_POLICY_R1_RESUME8_58535d5c\\post-install-source\\src-tauri-shell\\Cargo.toml","--locked","--offline","--no-default-features","--tests","--jobs","1","--target-dir","E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_DIV_POLICY_R1_RESUME8_58535d5c\\10-post-install-cargo-check-target"]

Final native results: baseline preservation 23/23; expected E0425 RED; Dividend policy 18/18; affected 41/41; post-install 41/41; rustfmt accepted-PRE legacy-debt subset PASS; candidate/post-install offline locked Cargo checks PASS. All evaluator tests use in-memory SQLite only. No live DB/EOD/Prepare/Git/network retrieval/Windows changes or auto-approval writes.
