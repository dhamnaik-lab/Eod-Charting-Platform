# CA Phase5E4 New-Windows Sandbox Controlled Enablement Rebase R1

IST timestamp: 2026-10-05T09:34:45.1036271+05:30

## Objective
Dispatch exactly one controlled Windows Sandbox feature enablement attempt after the accepted new-Windows readiness rebase.

## Previous limitation
The current new Windows installation had Windows Sandbox present but Disabled. Strict network-zero final acceptance still requires an isolated Sandbox capability and later isolated CA validation.

## Files changed
- This change record: E:\TA Projects\EOD Charting Platform\docs\changes\2026-10-05_0934_IST_CA_PHASE5E4_NEW_WINDOWS_SANDBOX_CONTROLLED_ENABLEMENT_REBASE_R1.md
- Windows optional-feature state may have changed through the single DISM enable attempt.
- EOD product source, live dist, standard portable and database files were not modified by this runner.

## Final implementation
- Target: Containers-DisposableClientVM
- Native DISM enable attempt count: 1
- /All: yes
- /NoRestart: yes
- /LimitAccess: yes
- Automatic reboot: no
- Sandbox launch: no

## Behavior preserved
- EOD launch=0; Load & Prepare=0; DB access=0.
- src=0; src-tauri-shell=0; build/product test=0; Git=0.
- No deliberate host-network mutation or external network probe.
- Exact persistent application delete-only PFRO allowlist remained the PRE gate.

## Validation commands/results
- Parent readiness evidence SHA256: 475B9F99F73F3B48EFD3A562A3BE734326816ABF293AA5B6A91BD7D95182AE0D
- PRE Sandbox state: Disabled
- Native DISM exit code: 3010
- POST Sandbox state: Enabled
- POST reboot: CBS=True WU=False PFRO2=False
- Hardware adapter administrative state preserved: True
- Decision: ENABLEMENT_ATTEMPT_CONSUMED__WAIT_MANUAL_REBOOT_AFTER_AUDIT__NO_SECOND_ENABLE_ATTEMPT

## Risks / limitations
- Sandbox capability was not launched or tested in this task.
- The enable attempt is consumed even if the post-DISM state is incomplete or an error occurred.
- A second enable attempt is not authorized by this record.
- Any required manual reboot must be independently authorized after audit.

## Rollback guidance
- Do not automatically disable Windows Sandbox or parent features.
- If rollback is later required, use a separately authorized, evidence-bound rollback task after identifying exact feature deltas.

## Relevant hashes / evidence
- Readiness evidence: 475B9F99F73F3B48EFD3A562A3BE734326816ABF293AA5B6A91BD7D95182AE0D
- ENABLE_ATTEMPT stdout SHA256: 91175722DA6B41D01665AF83DFC5EC52B2441B8752617972B0B42FE03436144A
- ENABLE_ATTEMPT stderr SHA256: E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855
- DISM log SHA256: E27A6F4E9BA96557CCB41AC5BCAA3BF0DE92F02A1DE251E695354238A43A8E88
