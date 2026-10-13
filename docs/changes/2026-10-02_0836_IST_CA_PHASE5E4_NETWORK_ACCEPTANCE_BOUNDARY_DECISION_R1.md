# CA Phase5E4 — Network Acceptance Boundary Decision R1

IST timestamp: 2026-10-02T08:36:00.377463+05:30

## Objective
Freeze the Phase5E4 network acceptance boundary after the completed RESUME5 Safe-V2 functional cycle and the exhausted RESUME1/2/3 historical network-provenance recovery chain.

## Authority
- RESUME5 evidence SHA256: `B5454E5F340FFB9FCF7AB3902FBF5126B70153DEADCEF2747208FE76DE36785A`
- RESUME5 RESUME1 evidence SHA256: `4D3017EB1EDFCE9D750A5E9CD159B7124977E48DF6D5C617995C6E99FFA45D71`
- RESUME5 RESUME2 evidence SHA256: `A3C88D04618CE842987C7778760B26AF88296FB3722A431DB8BAA324D2260F8A`
- RESUME5 RESUME3 evidence SHA256: `82FB39C1486F36057F541970B711EBA628B013A8671B5536F0AC13ACEB69447B`

## Decision
**RETAIN_STRICT_NETWORK_ZERO__NO_RETROACTIVE_WAIVER**

The completed RESUME5 cycle remains preserved as valid functional Safe-V2/database evidence, but Phase5E4 final acceptance remains pending the network gate because six external established TCP connections were observed and the strict `network=0` condition was not met. No historical process/WFP provenance can now identify the two network PIDs. No exception or retroactive waiver is granted.

### Frozen network=0 definition
Zero external network egress by the controlled EOD runtime process tree during the acceptance window. Loopback-only local IPC is not external egress.

## Current-run disposition
- Observed external TCP connections: **6**
- Strict network=0: **UNSATISFIED**
- Historical provenance recovery: **CLOSED / EXHAUSTED**
- Functional Safe-V2 evidence: **PRESERVED VALID, NOT FINAL PHASE5E4 ACCEPTANCE**
- TEST-DB rollback: **NOT WARRANTED**
- Second Load & Prepare under RESUME5: **NOT AUTHORIZED**

## Future acceptance requirement
A separate, newly authorized validation must enforce zero external egress before runtime launch. Monitoring alone is insufficient. The enforcement design must cover IPv4/IPv6 and all external outbound protocols, and must cover the exact EOD executable plus every child executable capable of originating traffic, or use a stronger isolated execution boundary that inherently covers the whole runtime process tree.

The future enforcement mechanism must be temporary, uniquely named, fail-closed, reversible, and must preserve unrelated Windows Firewall configuration. It must snapshot PRE state, prove enforcement active before launch, independently monitor the runtime, remove only run-owned controls afterward, and prove POST restoration.

## Behaviour preserved
This decision performs no product/source/build/dist/portable/database/firewall/network/runtime change. The accepted RESUME5 evidence chain remains byte-for-byte authoritative.

## Risks / limitations
The historical identities of PIDs 13932 and 15528 remain unrecoverable. This decision does not infer WebView2 provenance and does not relax the strict network gate.

## Rollback
Documentation-only decision. No product/database/firewall rollback is required.

## Next
`CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_DESIGN_R1` — design-only; firewall changes=0, EOD launch=0, Load&Prepare=0, DB writes=0, source changes=0, Git=0, network=0. Separate explicit approval is required before any enforcement implementation or new live cycle.
