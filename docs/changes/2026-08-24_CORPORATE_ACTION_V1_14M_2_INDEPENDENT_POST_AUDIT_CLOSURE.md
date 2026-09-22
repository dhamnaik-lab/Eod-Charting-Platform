# Corporate Action V1.14M.2 Independent Post-Audit Closure

Date: 2026-08-24 IST  
Scope: independent closure of the exact V1.14M three-row production-candidate repair.  
Final exact-tranche status: **`CLOSED / FULL_SUCCESS`**.

<!-- CA-V1.14M.2-AUG24-CANONICAL-CLOSURE -->

## Closure authority

V1.14M.2 opened only a fresh private DB/WAL/SHM snapshot in SQLite `mode=ro` with `query_only=1`. It independently re-derived the exact committed V1.14M.1.1 rows and returned `FULL_SUCCESS`. The V1.14M.2 report ZIP SHA-256 is `d56b3038d55e310ff3555c3821d620c47ab37f56e1b97f5863847d74baf92e99` and the independent post-audit fingerprint is `817d6bbccbc02fee7b8e28770616f76eb46723c5f273763573ea9dcf6c78daa2`.

## Exact final rows

| Import ID | Final symbol | Preserved official event ISIN | Review status | Approved CA ID |
|---:|---|---|---|---|
| 43286 | PDSL | INE111Q01013 | PENDING_ISIN_MISMATCH | NULL |
| 43419 | ANDHRAPAP | INE435A01028 | PENDING_ISIN_MISMATCH | NULL |
| 43501 | AVANTIFEED | INE871C01012 | PENDING_ISIN_MISMATCH | NULL |

All prior dedupe keys are absent. Each new production dedupe key is uniquely owned by its intended import.

## Independent closure fingerprints

- Production source SHA-256: `2e05315fa4bf7fe78f28e787edd2bd9a1fef23fb06cab66cc79c8ede9a1b5cfb`.
- Apply-plan fingerprint: `5981c3ebd141f443af2cf38f69ae3f704c04f97abb039973a45c44635b089f98`.
- Mutation fingerprint: `153f999d2087d396943cabffadbd3b33817055f2b1874975fb7b8d7c23723821`.
- Target post-state fingerprint: `829f70a4714b24516282399c1ba880c87c0e733841d589a3745a106592ff532a`.
- Non-target import fingerprint: `ef1450c462e1192664ed7c0adad472cb27e79529a88e4d2a7c81c8fec270258a`.
- Protected-table fingerprint: `252c70ac7231c288320b24916ec640cad1c741c4095bbe32efafcffc69f2bbd4`.
- Schema-safety fingerprint: `64246fe499d3093a52901bcddd26447e350cd08eb7457f80227fdd56715a10f2`.
- Independent post-audit fingerprint: `817d6bbccbc02fee7b8e28770616f76eb46723c5f273763573ea9dcf6c78daa2`.

## Integrity and write boundary

V1.14M.2 reported `quick_check=ok`, foreign-key violations `0`, and zero database, identity-history, ISIN-history, Corporate Action, resolution, decision, evidence, Quick Resolve, or approval writes. The live DB/WAL/SHM family remained byte-identical across the post-audit.

## Final boundary

The **exact three-row repair workstream** for imports `43286`, `43419`, and `43501` is now `CLOSED / FULL_SUCCESS`.

This closure does **not** mean all Corporate Action development, historical cleanup, approvals, or future audit work is complete. The three imports remain unapproved `PENDING_ISIN_MISMATCH` records and continue through the normal review/approval policy.
