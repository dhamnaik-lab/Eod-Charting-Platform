# CA Dividend Simple Cash Prepared-Scope Builder TDD R1

**IST timestamp:** 2026-10-06 0958 IST

## Objective
Implement and validate the approved P1 pure frontend builder for the current successful Load & Prepare Dividend prepared scope.

## Previous limitation
The installed read-only Dividend R1 evaluator had no pure frontend owner for freezing the exact current-cycle structural Dividend/PARSED/PENDING candidate IDs with generation/database freshness and deterministic scope evidence.

## Authority reconciliation
The accepted RESUME8 behavior/source baseline remains 597 exact rows. Two pre-existing documentation files were present before this task and caused the earlier broad protected-count stop: `resources/dnn-trend/README.md` (EAFCAAAD5AAAC136E30CA621734867D7F1C1A172443878A2D6F1A0009DF6494C) and `src-tauri-shell/README.md` (A72EFC87D4CB46EEB58A86F5D9C5A4E051400592A1EFED77E7A8BFFA5181CC44). RESUME2 verified those exact bytes, preserved them without modification, and treated them as explicit legacy-document overlays rather than builder source. Broad live PRE was therefore 599; the isolated behavior candidate remained 597 before the builder delta.

## Files changed
- ADDED `src/features/corporateActions/legacy/corporateActionDividendPreparedScope.ts` — SHA256 `5AB6CD9255CF41796CE97F880149AFC97A29A5E68EC0EBBC4AF33C1248B9C2D0`.
- ADDED `src/features/corporateActions/__tests__/corporateActionDividendPreparedScope.test.ts` — SHA256 `6A213EACFC9598B5588E9A224BA97EA7512B3C128C168AF0B34DBBFFEC629AC0`.
- PRESERVED legacy doc `resources/dnn-trend/README.md` — unchanged.
- PRESERVED legacy doc `src-tauri-shell/README.md` — unchanged.

## Final implementation
Pure frontend helper only. It validates current generation and unchanged database context, admits only DIVIDEND + PARSED + ordinary PENDING rows, excludes invalid/non-positive IDs, deduplicates and sorts IDs, freezes immutable scope metadata, and computes deterministic SHA-256 evidence identity. It performs no Tauri/backend call.

## Behaviour preserved
Existing Load & Prepare orchestration, Split/Bonus Safe V2, manual Apply workflow, installed Dividend backend evaluator, UI readiness, settings, schema, Rights behavior, raw EOD behavior and Phase5E4 status are unchanged.

## Validation commands/results
- 00-controller-selftests: exit=0; log SHA256=3BC3151DF00A527FC05E92E4E237E92033578BCC09484B918AFA43A037BF8EFA
- 01-baseline-pending-preparation: exit=0; log SHA256=98E36621632F4A2268B31915052DB837FF31C77229407F564B94324090F9C5C3
- 02-red-missing-builder: exit=1; log SHA256=E9ED53E3F77E75D10FDA7989588C3900FA5F26B4CB60EB61AC29B281BF368EBC
- 03-green-prepared-scope-builder: exit=0; log SHA256=0AD9ACAE084EA9E2B2781DCD7136B1E8C2E74624C62F12050D3FBBE3D1DC7EC5
- 04-affected-frontend-regression: exit=0; log SHA256=E9CD00E0EEBA1BEEFA2CD06DC21DCFBBF4B017812A64C50612CDE691AE88FA2F
- 05-candidate-typecheck: exit=0; log SHA256=01BA4719C80B6FE911B091A7C05124B64EEECE964E09C058EF8F9805DACA546B
- 06-candidate-vite-build: exit=0; log SHA256=F23F759F964283AAA2B7DD239E0CF6230124F3AEDD33AE4FC1F8E69E96D1279E
- 08-scoped-preedit-backup: exit=0; log SHA256=E8E15E56CA33DC6D0DF7057B4D3659D39B437E9AD89FE8487C7D0CA5F6350A01
- 09-post-install-focused-regression: exit=0; log SHA256=95169BC1AEFF84F39892B4FF2B25D69F0EDFD2C5244E8FF0484C85D9679AF47B
- 10-post-install-typecheck: exit=0; log SHA256=01BA4719C80B6FE911B091A7C05124B64EEECE964E09C058EF8F9805DACA546B
- 11-post-install-vite-build: exit=0; log SHA256=0A4CE7264E666499BD730BCD193CEEDE9AC67DAC5778DEF959D2EC2BAEBB3450

Final results: baseline 9/9; genuine missing-module RED; builder 15/15; affected 24/24; post-install 24/24; candidate/post-install TypeScript typecheck PASS; candidate/post-install Vite build PASS.

## Risks / limitations
Cycle identity remains ephemeral frontend orchestration state. The builder does not call the backend and its READY result is not write authority. P2/P3 remain separately unimplemented. The two legacy README files remain outside this builder delta and are not normalized, moved or rewritten here.

## Rollback guidance
After verifying the two builder target SHA256 values still equal the hashes above, remove only those two additive builder files. Preserve the two legacy README files. This returns the broad live protected population from 601 to the exact pre-task 599 state (597 accepted baseline + two preserved legacy docs). No database/schema rollback is required.

## Authority / evidence
- Accepted behavior/source PRE baseline: 597 exact rows.
- Preserved legacy documentation overlays: 2 exact rows.
- Broad live PRE: 599 exact rows.
- Behavior candidate POST: 599 rows (597 + 2 builder files).
- Broad live POST: 601 rows (597 + 2 legacy docs + 2 builder files).
- RESUME8 evaluator evidence SHA256: `135B8C0B00F417E89DFFAA49FEB2D2EB5F2C99F31C63292524E80A3A7203B909`.
- RESUME1 authority-stop evidence SHA256: `E467F7517A00A148A76BBD945609D370E1258F0393D4DA97268D8D93AAFF32CD`.
- Prepared-scope design SHA256: `870A081218ADBB71B3B9C3586D35A201AE42C403893764362F2F6AB76B788077`.
- Phase5E4 network gate remains OPEN / UNSATISFIED / DEFERRED.
