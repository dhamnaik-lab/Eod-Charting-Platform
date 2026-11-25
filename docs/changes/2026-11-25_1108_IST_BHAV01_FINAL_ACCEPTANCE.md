# BHAV-01 / RECOVERY-01A — Final acceptance

Acceptance evidence timestamp: 2026-11-25T11:08:36.422059+05:30 (IST). Owner approved documentation and guarded integration after final verification.

## Scope and authority

- Workstream: EOD Charting Platform; Windows root `E:\TA Projects\EOD Charting Platform`. Test database: `New Database` only.
- Original main: `eaaea26d86f66e6ae3f08cac89282bae2e7a569e`; BHAV-01: `b12bea2a7ef806efbcbafe39b1269d1acf9b0f11`; accepted RECOVERY-01A: `7705a8dcfced706bb8049c28b9aafa66d1fa13d4`; tree `173802ca8653eea150c8878192b6c4b6e0994ea4`.
- Previous defects: source rejection/absence conflation, coverage and post-import reporting errors, journal normalization mismatch and rollback preflight failure.
- Implementation is recorded in [BHAV-01](2026-11-24_1834_IST_BHAV01_DOWNLOAD_OUTCOME_INTEGRITY.md) and [RECOVERY-01A](2026-11-25_0022_IST_BHAV_RECOVERY_01A_JOURNAL_INTEGRITY.md). These two accepted commits are the only runtime changes authorized here. Closure changes documentation only.
- Journal and binary writer share normalized previous-close values and admission masks; rollback verifies all append targets before truncation. Structured outcomes and latest attempts remain distinct from successful historical coverage. Existing format, source validation, admission, worker bounds and deferred append-only durability are retained. No new dependencies.

## Actual validation

- BHAV-01 Windows canonical Rustfmt and git diff --check PASS; focused Rust 12 PASS; Bhavcopy module 180 PASS / 4 ignored; renderer Vitest 47 PASS across 7 files; typecheck and renderer build PASS. See original change record for exact commands.
- RECOVERY-01A canonical Rustfmt and whitespace PASS; shared Cargo offline/locked serial filters: bhav_recovery01a_ 3 PASS; bhavcopy_recovery:: 19 PASS; bhavcopy:: 182 PASS / 4 ignored; database::binary_eod:: 29 PASS (230 distinct passing module tests; focused tests overlap). No full workspace suite claimed.
- Isolated exact-source Windows portable: all 1,220 raw Git blobs verified, npm run typecheck:renderer PASS, Tauri build --config tauri.conf.json --no-bundle -- --offline --locked PASS (Vite renderer 9.30s, release compilation 3m00s). Build 20261125.033003, executable SHA-256 A7A76BB3DC6E96DF5BE909395C0C931BA7ADDFC4E351CDAC5287F96D19353E91. The first archive-based export was blocked before compilation; the raw blob export corrected the export mismatch without changing runtime source.
- Native test 10–20 Nov: 53,831 inserted, 7,184 unchanged, zero reported binary write errors, 6,509 deferred append files checkpointed in 3,704 ms, physical fallback exercised. Retry: 0 inserts, 1,104 identical NSE Index comparisons, no conflicts or recovery error reported. Initial physical verification: 13,635 valid binary files, 1,858,218 records, 32/32 lower-bound checks, zero pending sessions.
- Existing Rust maintenance test `database::eod_binary_state::tests::v11_real_database_bootstrap_audit` PASS (1 passed; 6.46s), generation 1, 13,635 verified, 0 dirty/unknown; all 13,635 quotation file hashes and main SQLite bytes preserved.
- Native indexed download 23–24 Nov: 9,078 inserted (NSE 3,616, BSE 5,245, NSE Index 138, BSE Index 79), 9,068/9,068 eligible fast-path appends, 10 new files, 0 changed dates / write errors / fallback, checkpoint completed in 10,150 ms. No holiday records imported.
- Final read-only Windows verifier: 13,645 valid files, 1,867,296 quotations, 13,645 matching sidecar rows, 0 binary errors / missing instruments / missing prior files / pending recovery sessions / foreign-key violations, SQLite and sidecar integrity ok. 4,567 unchanged file hashes; 9,068 historical prefixes reconstructed with original header count and matched to baseline hashes; 10 new one-record files. Prior daily coverage preserved; zero quotations on 10 and 24 Nov. Inspection left test database unchanged.
- Independent evidence review in ChatGPT: all five ZIP SHA-256 values and CRC verified; previous physical inventory, bootstrap pre-hashes and final CSV inventory reconciled (unchanged hashes, appended count increments, new-file dates, prior daily coverage, no recorded errors). Prefix reconstruction itself executed by the Windows verifier, not re-executed against original physical files here.

## Evidence (retained externally, not committed)

| ZIP | SHA-256 |
| --- | --- |
| BHAV-Recovery01A-Evidence-20261125-003721-279.zip | 0DC31E1DF380CA90DBFB67996717F1B3E92285DD8947DE9404E780C9F000B692 |
| BHAV-Recovery01A-PortableEvidence-20261125-033000-217805.zip | 84716F45423DEF66F177B2F6AD671F75F54E9AD4CDCC2BA87278D0CB8B9AF667 |
| BHAV01-TestDB-Evidence-20261125-100448-677982.zip | AEA2DC720F5FDD72AC9AD44F93E1FC8CF01819A98EE976D9E84DF5DC98502B8E |
| BHAV01-TestIndex-Evidence-20261125-101342-597448.zip | FBC700270EA935ADA73ED227FDCB86DC4D9BCBF76703ADBA3C20EDC086FFBB7A |
| BHAV01-Final-Evidence-20261125-110836-420397.zip | ABF36C49E6135A06497A5D7A6D158587918FE94C7CEA48D2C0BF5617067A07F4 |

## Limitations, remaining work and rollback

- Functional acceptance PASS for the pinned runtime; integration and standard portable/local synchronization require separate command/remote evidence. Existing unused calendar helper warning remains. No independent source-price parity or full historical coverage certification; first import has lower-bound rather than exact pre-import byte evidence. Native acceptance covers normal checkpoint/retry, not forced power loss or every external-writer/I/O scenario.
- Production database recovery remains HOLD: prior RECOVERY_ERROR journal and 89 pre-existing historical conflicting-date files are separate from this accepted runtime. RECOVERY-01B remains unpublished and excluded. Do not launch production downloads or delete journals until the separately authorized recovery plan passes. BHAV-02 (database-backed calendar, single concise outcome line with holiday context, original error/warning retained) and BHAV-03 (missing-date coverage/retry) remain separate. No new calendar or retry behavior in this closure.
- Remote original commits and local backups remain rollback authority. Preserve local unpublished 01B fixture files and both protected build files; never reset, clean, stash, overwrite or switch a dirty checkout blindly. If integration is blocked, preserve the exact candidate and evidence. No automatic database rollback, repair, or portable replacement.
