# Identity F2-R1 — NSE Official Company-Name Change Acquisition

Status: GREEN VALIDATED / F2-R1 IMPLEMENTATION INSTALLED
Timestamp: 2026-09-07 23:09:17 IST

Official URL: https://nsearchives.nseindia.com/content/equities/namechange.csv
Managed target: NSE\Identity\CompanyNameChanges\nse_identity_company_name_changes.csv

Acquisition behavior:
- URL default/override added
- F5 runtime host validation reused
- existing I4 company-name parser validates bytes before final write
- result reports companyNameChangeFilePath/companyNameChangeRowsRead
- Official Source URLs UI exposes Company name change CSV

Historical Apply automation: NO
Identity database mutation from refresh: NO
F1/F3/F4/F5 behavior changed: NO

RED evidence SHA256: 6A05F97BAE99245BD90293CC7BCD42ABBA5E8CF58842A59E0035FA25ED6AB845
Focused F2 tests: PASS
F5 provenance regression: PASS
F4 population regression: PASS
Existing NSE Identity regression: PASS
Cargo check offline: PASS
Renderer TypeScript typecheck: PASS

External network test: NO
Source-control command: NO
