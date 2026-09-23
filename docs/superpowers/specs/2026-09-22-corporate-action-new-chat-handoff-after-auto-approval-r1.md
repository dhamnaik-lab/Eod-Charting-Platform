# Corporate Action — New-Chat Handoff After Auto-Approval R1 Runtime Acceptance

**Date:** 2026-09-22 IST  
**Workstream:** `E:\TA Projects\EOD Charting Platform`  
**Policy:** `AUTO_APPROVAL_SAFE_V1`  
**Source authority:** `561` source files / `555` protected source files  
**FIX3 failure evidence SHA-256:** `7DDF468D7138F5DA6A5A40F92BC3BCE0B87307289EEEBCB2EA96A55527EA40DE`  
**FIX4 verifier evidence SHA-256:** `575BBA4E20BE09DA4738E958BEEC0A3B80AB541E901930B5C47499D2BA2146BD`  
**FIX5 verifier evidence SHA-256:** `CD4500259F3A92A6FDA8DAA1797436521EB0BCB10BDC3284E5F9C895EC0071B2`  
**FIX3 PRE backup SHA-256:** `BA9E4E269E283A6E5B4306DA0D6C822D6DC565B5DC7E6FB6422A0FFBF610CEE8`  
**Controlled EXE SHA-256:** `65971AB7D5523FFEDFA75ADAD74ED7C2CE1B4D372A07DB9D4797609B7ED7D0C7`

Auto-Approval R1 source/runtime behavior is accepted/current. The real TEST DB contains the verified FIX3 production outcome: `1221` Quick Resolve transitions and six `AUTO_APPROVAL_SAFE_V1` approved/linked outcomes. FIX6 was read-only and performed no additional CA mutation.

The recovery findings are: rolled-back PRE AUTOINCREMENT IDs are not live authority; `LINKED_EXISTING` follows the production `(ISIN match OR symbol match)` predicate; and newly created actions store resolved current symbol/ISIN even when the raw import preserves a machine-proven historical ISIN. Live acceptance is bound to these production semantics, exact decision/audit deltas, and exactly three new canonical actions.

**Immediate next bounded task:** refresh and verify the standard user-launched portable/app package from the accepted `561/555` source, then create Snapshot V3 and synchronize the final authority. Do not redesign Auto-Approval R1 during that task.
