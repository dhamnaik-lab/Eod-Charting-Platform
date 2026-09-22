# Identity F5-R1 — Runtime Official-Host Enforcement

Status: GREEN VALIDATED / F5 IMPLEMENTATION INSTALLED
Timestamp: 2026-09-07 16:16:02 IST

## Bound scope
- F5 only: runtime official-source provenance enforcement.
- Saved officialSourceUrls.v1 overrides remain unchanged.
- F2-F4 unchanged.

## Runtime contract
- NSE: HTTPS + exact frozen NSE host.
- BSE: HTTPS + exact frozen BSE host.
- Initial request URL validated before request.
- Redirect targets validated before follow.
- Final response URL validated before content consumption.
- Unknown/HTTP/lookalike hosts fail closed with OFFICIAL_SOURCE_PROVENANCE_REJECTED.

## Evidence
RED evidence SHA256: C45B7E30C4A56DF661FBFE41599F78A0C04B813C4CED049781733EC999BD4941
Focused provenance tests: PASS
Full NSE Identity Rust tests: PASS
Full BSE Identity Rust tests: PASS
Cargo check offline: PASS

Project database access/change: NO
External network tests: NO
Source-control command: NO
