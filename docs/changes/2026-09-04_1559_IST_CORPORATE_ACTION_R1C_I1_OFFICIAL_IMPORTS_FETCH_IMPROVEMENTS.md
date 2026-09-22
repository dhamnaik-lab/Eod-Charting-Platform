# Corporate Action R1C Donor Promotion I1 - Official Imports Fetch Improvements

Status: AUTOMATED PASS / MANUAL PRIVATE-DB CHECK REQUIRED
IST: 2026-09-04 15:59:34 IST

Implemented:
- direct fetch scope NSE + BSE / NSE / BSE
- independent CSV fallback NSE / BSE selector
- Force Re-fetch preserved for every direct-fetch scope
- ordered per-exchange started/completed/failed log
- per-database last successful fetch via existing R1C localStorage donor
- last-success write only after full selected-scope success
- From <= To validation and date bounds
- Error/string/object-message surfacing before fallback

Preserved:
- existing CorporateActionDialog route and five capability areas
- Task5B corporateActionImportOperations boundary
- review-first and no automatic approval
- CSV fallback, Historical Backfill, Review Issues, scan, identity, approval
- R1C Normal/Maintenance/Review/Approve donor production modules byte-preserved

Files modified:
- src/components/DatabaseToolsDialogs.tsx

Files created:
- src\features\corporateActions\__tests__\corporateActionLegacyOfficialFetchImprovements.test.ts
- this report

Validation:
- TDD RED: expected missing-feature failure confirmed
- focused tests: PASS
- full Corporate Action Vitest directory: PASS
- renderer typecheck: PASS
- renderer build: PASS
- portable build: PASS

Hashes:
- DatabaseTools preimage: F96BBD084058C95BC019EA5D5F8B1AE56DA75614CE6265396996F707A27773C1
- DatabaseTools postimage: 8FC0CA2056D1E471D0602C123A2B73F249D4936CBB3843920A92F396F98F8DF2
- focused test: 4F3A7B42F016264AEB0BDDB1C343147FC525947892FDDB89ECD4BB54697E75DF
- Task5B operations preserved: 71AB68E06056B0A147AE6139D6CD327873B1116ED3B4BF6B85456F70E2721709
- fetch-history donor preserved: BA0333C848062896C93C01E9CE9EA5D1EDF11326E2CB956ECB0B6475CCEAB8CF
- portable: 64DFFA9C9748D6B12CBD781A1A2FFA29F0E306410CE4403299D947BAFE6AA7E3

Safety:
- backend Corporate Action business logic changed: NO
- database access by runner: NO
- Git command by runner: NO
- Maintenance route reactivated: NO
- Fetch -> Load -> Review -> Approve route reactivated: NO
- dependency change: NO

Manual checkpoint:
1. Verify NSE + BSE / NSE / BSE selector.
2. Verify normal Fetch Official and Force Re-fetch.
3. Verify BOTH logs NSE then BSE.
4. Verify last-success text updates only after complete success.
5. Verify invalid From > To is blocked.
6. Verify CSV fallback NSE/BSE selection and import remains available.
7. Verify Historical Backfill and all other existing CA areas remain intact.

UI/UX redesign remains blocked until manual acceptance.