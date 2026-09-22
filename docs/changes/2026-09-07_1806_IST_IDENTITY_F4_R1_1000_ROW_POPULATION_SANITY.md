# Identity F4-R1 — 1000-Row Fail-Closed Population Sanity

Status: GREEN VALIDATED / F4-R1 IMPLEMENTATION INSTALLED
Timestamp: 2026-09-07 18:06:45 IST

Threshold: 1000
Error marker: SOURCE_POPULATION_SANITY_REJECTED

NSE official Equity download: >=1000 supported rows before final source write
NSE current Preview/Apply: >=1000 unique supported current symbols before plan construction
BSE official lifecycle download: >=1000 unique CURRENT symbols before final source write
BSE current Preview/Apply: >=1000 unique CURRENT symbols before plan construction
BSE Delisted/Suspended rows cannot compensate for undersized Active population

RED evidence SHA256: 7E7A72D0830C7141A83A2125B2FC111A77C22B9D7F12342CEC1E96FD1B5B4AA6
Focused F4 tests: PASS
NSE Identity regressions: PASS
BSE Identity regressions: PASS
Cargo check offline: PASS

Project database schema/data change: NO
External network test: NO
F2-F3 change: NO
F5 change: NO
Source-control command: NO
