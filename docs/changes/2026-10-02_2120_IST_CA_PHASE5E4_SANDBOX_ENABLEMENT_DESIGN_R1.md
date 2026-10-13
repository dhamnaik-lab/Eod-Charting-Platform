# CA Phase5E4 Windows Sandbox enablement design R1

IST timestamp: 2026-10-02T21:20:10.976256+05:30

## Objective
Finish the approved Sandbox enablement design from retained exact evidence and shorten the route by parking Hyper-V image preparation and grouping future enablement/reboot-resume/capability in one explicitly approved workflow.

## Previous limitation
Sandbox feature presence was resolved as Disabled; host mutation is not yet authorized. The Hyper-V fallback found no guest image in its bounded scan. The earlier process drifted into repeated environment-design rounds.

## Files changed
Created the supplied DESIGN.md, contract.json, NEXT_AGENT_HANDOFF.md, sources.json, pure controller/tests and this change record. Copied two exact evidence ZIPs and the byte-exact existing Sandbox template. No EOD source/build/dist/portable/DB or host settings modified. Original historical runner packages were not recovered or revalidated; exact evidence ZIPs are the declared authority.

## Final implementation
Design-only package plus optional documentation registration runner. The future design covers native DISM one-attempt enablement, required-parent side effects, local-payload/WU suppression, manual reboot, explicit receipt-bound post-only resume, no-EOD/no-DB Networking=Disable capability, and target-only rollback limitations. It is not a live enablement script.

## Behaviour preserved
Strict no-retroactive-network-waiver; EOD behaviour; authorized source and DB isolation; existing virtualization settings; unchanged `.wsb` template. Capability and final CA acceptance remain separate. Sandbox-local clone acceptance needs explicit amendment, not silent substitution.

## Validation commands and results
See preparation/VALIDATION.json and preparation/validation-output.txt for executed package verify-only, pure selftests, file integrity and fresh-extraction checks. Windows native PowerShell parser and all Windows enablement/guest operations NOT RUN in the preparation environment. The optional local runner native-parses itself before documentation registration.

## Risks / limitations
Future Windows servicing can enable parents or require reboot and may fail if local component payload is unavailable. `/LimitAccess` is not whole-host egress control. No promise of complete OS rollback or fixed completion time. Guest startup, mapping and EOD/WebView2 compatibility untested.

## Rollback guidance
For this task remove only this exact change record and run-owned registration output if the design is rejected; no system rollback required. Future target-only feature rollback requires a separate operator request and cannot automatically disable shared parents.

## Authority
Sandbox state ZIP `14102163D70BE8D0E7610B8075F721F3DEFA632151E89C25F10EB4198D4BE229`; zero-image preflight ZIP `59FDBAABB82F7725C4257237A0D31966C0B902FCC21917BC2378E6BAFB6BF156`; unchanged template `940BEB606DF1EB5A7A4ACFF9EA85546945D890F0D175761CD087442B7246B8EF`.

## Next
Proposed `CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_FIX4_WINDOWS_SANDBOX_CONTROLLED_ENABLEMENT_AND_CAPABILITY_R1`. This design alone grants no enablement, reboot, Sandbox launch, EOD, or DB permission.
