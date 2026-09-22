# V1.14AD Cargo sha2 R1A Evidence-Parser Forensic Acceptance

**IST timestamp:** 2026-08-29 19:07:18 +05:30 IST

## Objective

Correct only the preserved Cargo-tree evidence parser and determine whether the already-generated minimal sha2 Cargo candidate is valid without rerunning Cargo dependency resolution.

## Previous defect or limitation

The prior R1 audit constructed and replayed the correct two-file sha2 candidate, and both `cargo metadata --locked --offline` and `cargo tree --locked --offline` returned exit code 0. However, its tree parser used the regex `(?m)^\s*sha2 v0\.10\.9(?:\s|$)`. That expression permits only whitespace before `sha2`, while Cargo ASCII tree output uses the branch prefix `|-- `. The preserved direct dependency line is exactly `|-- sha2 v0.10.9`, so the parser produced a false negative.

## Files inspected

- Prior R1 reports ZIP with SHA-256 `D96D8B4FB1A1A81DEC52419727FCAD3D715BED6167ECE945574F4656567C2B8B`.
- Preserved R1 summary, full locked metadata output and cargo-tree output.
- Exact HEAD and accepted candidate Cargo.toml/Cargo.lock files.
- Exact two-file contextual patch.
- Prior targeted Cargo status before/after evidence.
- Current live Cargo.toml/Cargo.lock identities.

## Files created

- `90-r1a-forensic-acceptance-summary.json`
- `91-corrected-cargo-tree-sha2-evidence.txt`
- `92-accepted-sha2-only-Cargo.toml`
- `93-accepted-sha2-only-Cargo.lock`
- `94-accepted-head-to-sha2-only-Cargo-contextual.patch`
- This mandatory docs/changes report and reports ZIP.

## Files modified

- No production source/configuration file.
- No live Cargo.toml or Cargo.lock.
- No live Git index entry.
- No database.
- No build/package output.

## Final implementation

R1A does not execute Cargo. It independently re-parses preserved metadata and Cargo-tree outputs, verifies the exact direct tree line, re-validates candidate manifest/lock semantics, verifies that no non-root Cargo.lock package record changed, validates the exact two-file contextual patch contents and preserved 0/0 replay result, and copies the accepted candidate artifacts into new R1A evidence.

## Validation commands / evidence

- Preserved `cargo metadata --locked --offline`: exit 0.
- Preserved metadata root package directly declares sha2 with requirement `^0.10`.
- Preserved `cargo tree --locked --offline`: exit 0.
- Preserved direct Cargo-tree line: `|-- sha2 v0.10.9`.
- Candidate mutated by prior Cargo validation: false.
- Preserved contextual patch check/apply: 0 / 0.
- R1A Cargo commands executed: 0.

## Actual validation results

- Corrected classification: **CA_CARGO_SHA2_SCOPE_CONTEXTUAL_PATCH_VALIDATED**.
- Candidate Cargo.toml SHA-256: `A4231F9AD2D201DA4D933D8BEF5159938C7226DF59C8A734FDF7905EDDFB83F3`.
- Candidate Cargo.lock SHA-256: `88C05F566B84F3A2D57E97882AD35323BE2A49B8715FBD38A24063B7DA3853F2`.
- Contextual patch SHA-256: `FA5BFB023103AFA821141E8D93301459DE135D2481BD0B2522F8F097EE87343E`.
- Root lock dependency added: `sha2`.
- Non-root package changes: 0.
- Existing sha2 package: version `0.10.9` with locked checksum preserved.
- Direct Cargo-tree sha2 match count: 1.
- Prior targeted Cargo status before/after: byte-identical.

## Behavior deliberately preserved

- Exact current live Cargo.toml/Cargo.lock bytes.
- Exact Git index state.
- All unrelated working-tree changes.
- The R3 cumulative baseline source candidate.
- No dependency-resolution rerun, compile/test, database access or packaging.

## Risks or limitations

This gate accepts the Cargo attribution evidence only. The full cumulative Corporate Action baseline has not yet been compiled or tested with the accepted contextual Cargo patch. That remains the next gate.

## Rollback guidance

No production rollback is required because R1A changes only audit evidence and documentation.

## Recommended next step

Apply `94-accepted-head-to-sha2-only-Cargo-contextual.patch` only inside the disposable cumulative baseline and run governed compile/test validation. Do not promote the current Cargo.toml/Cargo.lock wholesale.

## Status

**V1_14AD_CARGO_SHA2_R1A_FORENSIC_ACCEPTANCE_COMPLETE**
