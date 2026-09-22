# V1.14AD Accelerated Phase E R2 Isolation Recovery Closeout

## IST timestamp
2026-09-01 19:24:46.045 IST

## Objective
Recover the manual runtime smoke after R1 was invalidated because the isolated portable initially auto-opened the normal/live NSE database before the operator switched to the private Phase E database.

## Previous defect or limitation
R1 CLOSEOUT correctly blocked on LIVE_DB_FAMILY_CHANGED_DURING_PHASE_E. Read-only forensic evidence showed:
- live main market-data.sqlite3 remained byte-identical to the original R1 PREPARE baseline;
- live market-data.sqlite3-wal SHA changed;
- live market-data.sqlite3-shm SHA changed;
- the operator confirmed the isolated app initially opened the normal/live DB before switching to the private DB.

R1 is therefore preserved as a failed safety run and is not reclassified as PASS.

## Files changed
- Runtime/source/config: none.
- Git index/history: none.
- Live database: no R2 mutation permitted.
- Documentation: docs\changes\2026-09-01_1924_IST_V1_14AD_ACCELERATED_PHASE_E_R2_ISOLATION_RECOVERY_CLOSEOUT.md
- External R2 evidence: E:\TA Projects\EOD Charting Platform Source Audit\V114AD_ACCELERATED_PHASE_E_R2_ISOLATION_RECOVERY_20260901_185352_299

## Final implementation
R2 reuses the already-isolated portable and private DB only after that portable has persisted the private DB selection. R2 captures a fresh current live-family baseline, then requires two launches to open directly on the private DB without any database switch. R2 performs no Corporate Action or database mutation. The prior R1 screenshots/manual observations remain functional evidence; R2 is the clean isolation/safety rerun.

## Validation commands / actual results
- Exact R1 runner SHA authority: PASS
- Exact Phase E forensic probe SHA authority: PASS
- Exact R1D reports ZIP SHA authority: PASS
- HEAD/tree/index/source sentinels: PASS
- R1 original main market-data.sqlite3 still byte-identical: PASS
- R1 sidecar drift recorded and preserved: PASS
- R2 live DB/WAL/SHM family unchanged from R2 PREPARE through R2 CLOSEOUT: PASS
- R2 tracked working tree unchanged: PASS
- R2 certified isolated portable files unchanged: PASS
- R2 manual operator gates all passed: True

## Behaviour deliberately preserved
The certified R1D portable executable and certified files are unchanged. No package rebuild is performed. No Git staging/commit is performed. The promoted portable and Phase D rollback backup are not modified. The prior R1 functional Corporate Action evidence is retained.

## Risks or limitations
- R1 did not satisfy the original live-family immutability contract because WAL/SHM changed after the unintended initial live-DB auto-open.
- The exact pre-R1 WAL/SHM byte state was not restored; R1 is explicitly not treated as a successful safety run.
- R2 proves a new clean isolation interval from its own fresh baseline and confirms the existing isolated portable now opens directly on the private DB.
- Corporate Action UI readability/operability issues observed during R1 are deferred to the separately approved Corporate Action UX Modernization phase.

## Classification
V114AD_ACCELERATED_PHASE_E_R2_ISOLATION_RECOVERY_PASSED__R1_LIVE_SIDECAR_CONTAMINATION_DOCUMENTED__V1_14AD_CLOSED

## Rollback guidance
No source/index/history/package rollback is required. R2 does not mutate the live DB. Preserve the R1 and R2 audit directories plus the Phase D real-portable-before backup until the V1.14AD evidence retention decision is made.
