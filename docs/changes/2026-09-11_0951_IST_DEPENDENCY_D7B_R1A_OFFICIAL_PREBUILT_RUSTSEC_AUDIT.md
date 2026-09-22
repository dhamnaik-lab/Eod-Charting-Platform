# DEPENDENCY-D7B-R1A — Official Prebuilt RustSec Audit

- IST timestamp: 2026-09-11 09:51:14 IST
- Objective: Replace the failed D7B-R1 cargo-audit source build with the official RustSec Windows/MSVC prebuilt 0.22.2 asset and audit the accepted Cargo.lock.

## Previous limitation
D7B-R1 failed before project mutation while compiling cargo-audit 0.22.2 from source. The locked aws-lc-sys 0.40.0 native build could not find jitterentropy-internal.h under the local MSVC toolchain.

## Files changed
- This documentation report only.

No application source, npm dependency, Cargo.toml, Cargo.lock, database, or source-control state was changed.

## Final tooling implementation
- Release: cargo-audit/v0.22.2
- Official Windows asset: cargo-audit-x86_64-pc-windows-msvc-v0.22.2.zip
- Official asset SHA-256: 0A7316540862C13D954F648917CEACCA593747BAED6EEC180FAFA590BE2710AB
- Official asset bytes: 6192256
- Download seconds: 8.83
- Isolated cargo-audit version: cargo-audit-audit 0.22.2
- Isolated cargo-audit executable SHA-256: 0157F5CE1CE9FD4FB0A1F7C79AF1229771D1F80B6C2613DDB0D9200A8BA73946
- Isolated cargo-audit executable bytes: 15310848
- External tool root: E:\TA Projects\EOD Charting Platform Source Audit\DEPENDENCY_D7B_R1A_RUSTSEC_2026-09-11_095114_IST\isolated-tool-root
- Isolated Cargo home: E:\TA Projects\EOD Charting Platform Source Audit\DEPENDENCY_D7B_R1A_RUSTSEC_2026-09-11_095114_IST\isolated-cargo-home
- Isolated RustSec database: E:\TA Projects\EOD Charting Platform Source Audit\DEPENDENCY_D7B_R1A_RUSTSEC_2026-09-11_095114_IST\rustsec-advisory-db

## Audit result
- Classification: RUSTSEC_VULNERABILITIES_FOUND
- cargo-audit exit: 1
- Vulnerabilities: 8
- Warnings: 10
- Ignored advisories: 0
- Advisory IDs: RUSTSEC-2026-0194, RUSTSEC-2026-0195, RUSTSEC-2026-0194, RUSTSEC-2026-0195, RUSTSEC-2026-0185, RUSTSEC-2026-0098, RUSTSEC-2026-0099, RUSTSEC-2026-0104
- Warning categories: unmaintained=6, unsound=4
- RustSec DB commit: b50980aad8b8f14f77e25a97b32dd94bf008b0af
- RustSec DB updated: 09/09/2026 16:19:52
- Next gate: D7C_ADVISORY_REMEDIATION_REVIEW

## Behaviour preserved
- package.json SHA-256: 8C4BEBD7A534A3393939E4F99C4E3A28691D9FA7C8F85503F0565D4544C20E6F
- package-lock.json SHA-256: 08A6F8C52D4FD94A6777B5CC181F534C7D74DB6C9C10CFF73D9A95806C2C766D
- hidden npm lock SHA-256: 68C2AC02DFE26BEF57917EEE2F5D77CE4FD339C4F2E1A30ABE0874333FD3620C
- Cargo.toml SHA-256: D1199096F9EA2548FD011BC120ABD15407849A75D9AAA14240DF1D250A020D42
- Cargo.lock SHA-256: 68A14D7A9C904F0C981BC6529E82C439B2352EABBF2AA8BE221F7F79FCA778C5
- source fingerprint: 490D8844A47767F16DC08470839823C613D93B3A93EA92C398635BD44F3C2836 / 535 files
- normal user cargo-audit installation: absent before and after
- normal user RustSec advisory cache: unchanged
- database access: none
- direct source-control command: none

## Validation / evidence
- Exact D7A/D6B-R2 project authorities reverified before and after.
- Official RustSec asset size and SHA-256 verified before extraction.
- Exactly one cargo-audit.exe required after extraction.
- cargo audit --version required to report 0.22.2.
- RustSec audit JSON captured and normalized when the audit returned a completed result.

## Network
Online access was limited to the exact official RustSec release asset and cargo-audit's RustSec/yanked-data retrieval.

## Risks / limitations
- RustSec reports known advisories at the recorded database revision; a zero result cannot prove absence of unknown vulnerabilities.
- Warnings and ignored advisories remain separate follow-up gates rather than being treated as clean.

## Rollback guidance
No project rollback is required because project source/dependency state was not modified. The isolated D7B-R1A external run directory can be deleted after retaining this report and the evidence ZIP.

## Authorities
- D7A evidence SHA-256: 2674264B711873B2157BF090D66B660B4DF9BD0A9992F0B96BD040F31B4AAEDF
- D7B-R1 runner SHA-256: 664D33B4EDBDF80153829A4C488CDADDD02F3CAC6708AB327AF5143DD011B133
- D7B-R1 failure evidence SHA-256: B35647A9F0D08E2A66C1BE0369E70592545E34CF22FE1EC991FDFABDB27E4DED
- D7B-R1A package SHA-256: 5558AB1871904C811270D564993F9883315943F7316E5733C72AAAFEABE1CA06