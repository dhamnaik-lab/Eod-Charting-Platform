# Identity ER3-B â€” NSE Controlled Candidate Acquisition & Validation

**IST timestamp:** `2026-09-14 23:47:51 IST`  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Base authority:** `Eod Charting Platform Source Code 2026-09-14_192551_IST.zip`  
**Base SHA-256:** `85E7CCED0A71B8E3C4C757E1BE018E65A993446AB51DEA2DECBDB250421B9C62`

## Objective

Implement ER3-B Design R1: private/read-only NSE candidate acquisition and validation after ER3-A discovery, with hard network/body budgets, frozen parser reuse, deterministic evidence, no URL promotion/persistence/UI, and one explicitly authorized online NSE verification gate.

## Previous limitation

ER3-A could discover and rank official-domain URLs but intentionally stopped at `DISCOVERED_NOT_PROMOTED`; no bounded layer existed to fetch discovered candidates and prove their remote bytes satisfied the frozen NSE source contract.

## Files changed

Created:
- `src-tauri-shell\src\database\official_source_candidate_validation.rs` â€” SHA-256 `2A34988688B572F6EF3B9BF1195D65C4458AD4480378599B67E9294CCB49B784`
- `docs\superpowers\specs\2026-09-14-identity-er3b-nse-controlled-candidate-acquisition-validation-design-r1.md` â€” SHA-256 `AB7672F95632942E1AF4AAA026AA8CD8CCA96A45CAC2543A845AE419491E6BB1`
- `docs\superpowers\plans\2026-09-14-identity-er3b-nse-controlled-candidate-acquisition-validation-plan-r1.md` â€” SHA-256 `5054561E4C367973D6898B956ED48EDB43505D0654207EB5C475A16D61997816`
- this change record

Modified:
- `src-tauri-shell\src\database.rs` â€” SHA-256 `4A10FC439D54EF7CF457B6C6725329F6B055FE12CB5D0FFF7458D015A497F45D`
- `src-tauri-shell\src\database\official_source_discovery.rs` â€” SHA-256 `016B66BFF6242989ADE648CCB34DE8A3C932B93D020A0BB40F9DB311C3B078A9`

## Final implementation

- Exact ER1â†’ER3 mapping; healthy/unsupported/BSE recovery triggers fail closed.
- ER3-A remains pure/offline; only source-contract metadata visibility is widened internally.
- Bounded GET-only NSE transport reuses the frozen NSE redirect/provenance policy.
- 45 s timeout; 4 MiB landing limit; 32 MiB per candidate; 64 MiB total candidate budget; first 5 deterministic candidates only; no retry/recursion.
- Both declared `Content-Length` and streamed-body overflow are enforced.
- Existing NSE equity/SME/symbol-change/name-change/delisted parsers are reused.
- Candidate evidence captures final URL, status, content type, byte count, SHA-256, parser/schema/population/freshness and classification without raw body.
- Exact states only: `VALIDATED_CANDIDATE_NOT_PROMOTED`, `INDETERMINATE_CANDIDATE`, `REJECTED_CANDIDATE`.
- No DB/settings/archive/UI/Tauri public surface or URL promotion.

## Validation results

- Combined pre-implementation B1/B2 RED: **PASS â€” expected failure observed**, exit `101`.
- ER3-B1 GREEN: **PASS**, see `02-er3b-b1-green.log`.
- ER3-B2 GREEN: **PASS**, see `03-er3b-b2-green.log`.
- ER3-B3 authorization RED: **PASS â€” fail-closed authorization observed**, exit `101`.
- ER3-B3 controlled NSE online verification: **PASS**, see `17-er3b-online-green.log` and `ER3B_ONLINE_VERIFICATION.txt`.
- Preservation regressions: **PASS** for official-source provenance, ER1, ER3-A, NSE delisted, I3, I4, ER2-A/B/C1/C2.
- `cargo check --locked --offline`: **PASS**.
- Protected source postflight: **543/543 exact**.

## Behaviour preserved

I3/I4 mutation authority, ER1 report/UI semantics, ER2 resolver/shadow behavior, ER3-A discovery behavior and `DISCOVERED_NOT_PROMOTED`, configured source URLs, managed archive behavior, DB/schema/data, public Tauri/frontend surfaces, BSE, and deferred NSE temp-staging concurrency behavior remain unchanged.

## Risks / limitations

- ER3-B validates candidates but does not approve/promote them; operator workflow remains separately gated ER3-C/ER4 work.
- Online verification proves current official NSE acquisition and source-contract validation; it does not require NSE to have moved a source.
- Missing response content type can produce `INDETERMINATE_CANDIDATE` even when parser/schema/population pass.
- Private ER3-B code may remain dead-code in the normal binary until a separately approved consumer path exists.

## Rollback

Restore the pre-run `database.rs` and `official_source_discovery.rs` backups; remove `official_source_candidate_validation.rs`, the ER3-B design/plan/change record; verify the accepted 542-file preflight manifest. No DB rollback is required.

## Evidence

Routine evidence is stored only under `E:\TA Projects\EOD Charting Platform\tmp`. Source Audit remains reserved for source snapshot evidence.

