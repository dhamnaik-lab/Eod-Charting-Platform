# CA Phase5E4 — Sandbox Controlled Enablement R1 FIX1 — PFRO Application Cleanup Classification

IST timestamp: 2026-10-03T01:52:15.9034241+05:30

## Objective
Prevent Chrome Temp delete-only PendingFileRenameOperations from falsely blocking the approved Sandbox controlled-enable workflow while preserving fail-closed handling for real or ambiguous reboot state.

## Previous defect / limitation
The parent runner treated every non-empty PendingFileRenameOperations value as reboot-required. After an actual reboot, the only surviving entries were three Google Chrome Temp delete-on-reboot operations, while CBS RebootPending and Windows Update RebootRequired were both false. The parent gate therefore stopped before any Sandbox enablement attempt.

## Files changed
- Standalone workflow runner only.
- Parent workflow ZIP remains byte-exact SHA256 B2CAC4033F1535969990E5C1831A2D05399333011366A153CB03923F96DE6E70.
- EOD product/source/build/database files unchanged.

## Final implementation
PFRO is parsed as source/destination pairs. Only well-formed delete-only pairs whose sources are exactly under *1\??\C:\Program Files\Google\Chrome\Temp are classified CHROME_TEMP_DELETE_ONLY and non-blocking when CBS/WU indicators are clear. PFRO2 presence, odd/malformed entries, blank sources, non-empty destinations, prefix lookalikes, non-Chrome sources, CBS reboot, or WU reboot remain blocking.

The registry is read-only and is never deleted or edited.

## Behaviour preserved
Exactly one Sandbox enablement attempt; no automatic retry/reboot/rollback; identical parent package/controller/bootstrap/template; resume receipt binding; empty Networking=Disable capability test; EOD=0; DB=0; Git=0; external probe=0; host adapter/switch/HNS/firewall mutation=0.

## Validation
Runner native PowerShell parser executes before workflow. Synthetic PFRO classifier selftests: 8 cases. Parent package verify-only and 20/20 workflow selftests remain mandatory before PRE capture.

## Risks / limitations
The exception is intentionally narrow to the exact Chrome Temp source subtree and delete-only operation shape. Any mixed/unknown PFRO state fails closed. This is not a general waiver of PendingFileRenameOperations.

## Rollback
Use the exact parent runner SHA256 12FC3BE5338D4FC62B8A7A8E5AED1B6589660C81E978BF363AE9A0F059CEACFE. No registry/system rollback is required because FIX1 changes runner classification only.

## Relevant hashes
- Parent package SHA256: B2CAC4033F1535969990E5C1831A2D05399333011366A153CB03923F96DE6E70
- Parent runner SHA256: 12FC3BE5338D4FC62B8A7A8E5AED1B6589660C81E978BF363AE9A0F059CEACFE
- FIX1 runner SHA256: 4873D475127A092A27C33E342A04C3059A06A1F4F0CEDBCEF4DC339C5F6DC88A
