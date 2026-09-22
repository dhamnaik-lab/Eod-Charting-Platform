# Identity F1-R1 — NSE Delisted Semantic Workbook Selection

Status: GREEN VALIDATED / F1 IMPLEMENTATION INSTALLED
Timestamp: 2026-09-07 14:38:49 IST

## Bound scope

- F1 only: NSE delisted workbook discovery semantics.
- F2-F5: unchanged.
- ER1+: not started.

## Root cause

Previous discovery selected the first HTTPS .xlsx occurrence from the NSE delisting page.
The provider page can contain both proposed-delisting and actually-delisted workbooks.

## Correction

Discovery now scans XLSX candidates and accepts only actual-delisted company semantics.
Proposed-delisting candidates are rejected.
Opaque XLSX URLs can be authorized by actual-delisted anchor text.
If no actual-delisted candidate is proven, the existing configured fallback is used.

## Evidence

RED evidence SHA256: EA77B3C3270B32535DDD85D6398C7664D9D1B5E87361624DE28E16254CF1FF0E
Source preimage SHA256: 2E05EF2050179305223A95F10CD0B3B2DE894F9615A78991E2D93F6ADD7542AB
Source postimage SHA256: 3124B827AFDB79A3F5ADFC2947B30C373FBD6F98FC7292E3DAF2E3AC864B9E3D

Focused semantic-selection tests: PASS
NSE delisted regression filter: PASS
Full NSE Identity Rust test module: PASS
Cargo check offline: PASS

Database access/change: NO
Network access: NO; Cargo forced offline
BSE change: NO
Official-source URL configuration change: NO
UI change: NO
Source-control command: NO
