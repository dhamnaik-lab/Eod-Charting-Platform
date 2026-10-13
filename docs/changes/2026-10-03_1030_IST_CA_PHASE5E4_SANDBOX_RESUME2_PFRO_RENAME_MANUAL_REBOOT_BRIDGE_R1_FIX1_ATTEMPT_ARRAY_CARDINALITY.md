# CA Phase5E4 — Sandbox RESUME2 PFRO Rename Manual Reboot Bridge R1 FIX1 — Attempt Array Cardinality

IST timestamp: 2026-10-03T10:31:05.7929784+05:30

## Objective
Bridge the exact RESUME1 POST stop through one manual reboot because the fresh Enabled Sandbox state also contained a real delayed Amcache rename; never dispatch feature enablement or disablement.

## Previous defect / limitation
RESUME1 correctly stopped on OTHER_OR_RENAME_BLOCKING. The first RESUME2 harness then stopped before any bridge-state write because PowerShell unrolled the single Get-TaskAttemptFiles result to a scalar FileInfo; under StrictMode, $TaskAttempts.Count did not exist. No reboot receipt or RESUME2 evidence directory had been created.

## Files changed
External RESUME2 ZIP/runner plus this documentation record and run-owned recovery evidence/receipt only. EOD source/build/dist/database are unchanged.

## Final implementation
FIX1 forces Get-TaskAttemptFiles results through @(...) at both initial and post-reboot cardinality gates so zero/one/many results always expose .Count and indexing consistently. All RESUME2 authority, exact evidence binding, manual-reboot bridge, same-runner resume, host-network preservation, and synthetic Networking=Disable capability behavior remain unchanged.

## Behaviour preserved
Consumed enable attempt remains exactly 1. Feature enable/disable dispatch=0; registry mutation=0; automatic reboot/reboot loop=0; EOD=0; DB=0; Load&Prepare=0; Git=0; external network probe=0; process termination=0; host adapter/VMSwitch/HNS/firewall mutation=0.

## Validation / actual result
Status: RESUME2_WAIT_MANUAL_REBOOT
Fresh target=Enabled; launcher present; exact Amcache delayed rename remains blocking; CBS/WU false; network preserved; consumed enableAttemptCount=1; feature enable/disable dispatch=0. Manual reboot authorized once.

Preparation package selftests and native parser results are printed by the runner/evidence. Windows state is supported only by actual runtime evidence.

## Risks / limitations
A blocking PFRO after the authorized reboot stops fail-closed; no second reboot is automatically authorized. Capability does not prove EOD/WebView2 compatibility or final Phase5E4 CA acceptance.

## Rollback
No Windows feature or registry rollback is authorized or required by RESUME2. The active receipt is run-owned bookkeeping; original receipt/evidence are copied before replacement.

## Relevant hashes
RESUME1 POST-stop evidence: D744512097DD03AA00EBE915626DB0DEDD5495627E03A9E299797521D8561D62
RESUME1 package: 70BC4CCAE168916AC28E5A46A3E3D1DC768708B80F99F25540FBDFCEAA8D0E6C
RESUME1 runner: CD5B20181504C9314F641747FB19ED0AEB498B6BF198C087B3FABB3D5BA826C9
Consumed parent package: B2CAC4033F1535969990E5C1831A2D05399333011366A153CB03923F96DE6E70
Consumed FIX1 runner: 4873D475127A092A27C33E342A04C3059A06A1F4F0CEDBCEF4DC339C5F6DC88A
RESUME2 package: 59E3F5DED6F10985D2081865CFBDFBECB9227227B4CD6C6EAAA8884A2656629F
RESUME2 runner: CB885BB91799BB8ED98906466CCA0D5AB2B9AD48BDAF4CFBB8DAB11419C9D858
