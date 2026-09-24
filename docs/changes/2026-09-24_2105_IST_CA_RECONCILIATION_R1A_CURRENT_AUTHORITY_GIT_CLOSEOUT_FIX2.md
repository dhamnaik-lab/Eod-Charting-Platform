# CA Reconciliation R1-A — Current Authority / Git Closeout FIX2

**IST checkpoint:** 24 September 2026
**Workstream:** EOD Charting Platform
**Authorized root:** `E:\TA Projects\EOD Charting Platform`

## Objective

Close the accepted R1-A source/copy-local stage in current project documentation and publish the exact accepted R1-A state to Git before R1-B begins.

## Previous limitations

The first documentation/Git closeout attempt stopped during repository documentation-reference validation. It committed nothing and rolled all seven closeout documentation changes back cleanly.

First failure evidence SHA-256:

`F79AAE484B427B850C55ADDB8C100AA23637F1A2B3813D4B617766CE460442DD`

That validation exposed four pre-existing reference-normalization defects:

1. two bare ADR-006 references where the actual file is under `docs/architecture/decisions`;
2. one bare Gann change-record filename where the actual file is under `docs/changes`;
3. one historical external V1.14AD staging-preflight runner referenced as if it were a retained repository file.

## FIX1 documentation-reference correction

FIX1 keeps the R1-A source behavior unchanged and makes only these narrow documentation corrections:

- `HANDOFF.md`: qualify ADR-006 with its full repository-relative path;
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`: qualify ADR-006 with its full repository-relative path;
- `FILE_INVENTORY.md`: qualify the Gann implementation change record with `docs/changes/...`;
- `HANDOFF.md`: identify the V1.14AD staging-preflight operator as an external operator not retained in the clean source tree, instead of presenting it as a local repository file.

The actual target files already exist for ADR-006 and the Gann change record. No placeholder file is created for the external V1.14AD runner.


## FIX2 whitespace correction

FIX1 correctly normalized all four references: the live documentation-reference check passed. The same validation then stopped at the repository whitespace gate because the newly rewritten HANDOFF operator line ended with two Markdown hard-break spaces.

FIX1 failure evidence SHA-256:

`AE02E6BA508DCCCA0D4EEA51B426AC04DC72980F533A8025E9D6BCE8CB863308`

Exact failed line:

`Latest external operator (not retained in the clean source tree): V1.14AD-Controlled-CA-Staging-Preflight-R1A-R2.ps1  `

FIX2 changes only that generated HANDOFF line to remove the two trailing spaces. The text and meaning are otherwise identical. No source, database, Git authority, R1-A behavior, or reference-normalization rule changes.

## R1-A source authority

- Snapshot: `Eod Charting Platform Source Code 2026-09-24_201002_IST.zip`
- Snapshot SHA-256: `B4C3E9AB71B79B2E3F9B0A703E43EF68F56B0DC89B655244BBC606634AF03719`
- accepted live source: **569**
- protected source: **563**
- R1-A evidence SHA-256: `E730F28CCD592FA0FB2A4A32118EA1A150B83E35E9188B9B415A3FC02443B2DA`

## Files changed by this closeout

Documentation only:

- `HANDOFF.md`
- `PROJECT_STATE_EOD_CHARTING_PLATFORM.md`
- `FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md`
- `FILE_INVENTORY.md`
- `docs/superpowers/specs/2026-09-24-corporate-action-reconciliation-r1a-current-authority.md`
- `docs/superpowers/specs/2026-09-24-corporate-action-new-chat-handoff-after-r1a.md`
- this change record

No `src` or `src-tauri-shell` byte is changed by this closeout.

## Behavior preserved

- `AUTO_APPROVAL_SAFE_V1`;
- manual approval;
- `PENDING_ISIN_MISMATCH`;
- AUTO-ID1;
- 20MICRONS;
- duplicate protection;
- compound auto-approval exclusion;
- raw-price adjustment-on-read;
- TEST-vs-operational DB separation.

## Validation and Git publication

The Windows FIX2 closeout runner must record actual documentation-validation and Git results. It may commit only after:

- live source is 569/569 exact;
- Git branch/HEAD/origin/remote-main are exact;
- accepted pre-closeout dirty set is exact;
- normal documentation backup succeeds;
- repository docs validation passes;
- exact authorized stage set passes `git diff --cached --check`.

The resulting commit SHA is recorded in the evidence rather than embedded in this file.

## Risks / limitations

- R1-B remains NOT STARTED.
- R1-C remains NOT STARTED.
- historical coverage remains NOT_ASSESSED.
- `databaseComplete` remains false.
- Git remote verification/push requires network access.
- no automatic history rewrite/reset is authorized.

## Rollback guidance

Before commit, restore only closeout-owned documentation from the normal backup if validation fails and hashes still match the installed payload. After a commit is created, do not reset or rewrite history automatically; preserve the commit/evidence if push fails.

## Windows FIX2 execution results

- execution IST: `2026-09-24T22:26:24.739700+05:30`
- live R1-A source authority: **569/569 exact**
- protected source authority: **563 exact**
- accepted parent HEAD / remote main: `25b186587f416ba7c3ea556c1ddda433239e8f1d`
- accepted pre-closeout dirty set: **21/21 exact paths**
- repository docs validation after FIX2 normalization: **PASS**
- normal pre-edit documentation backup: `E:\TA Projects\EOD Charting Platform\backups\pre_opencode_changes_20260924_222619_CA_R1A_DOCS_GIT_CLOSEOUT_FIX2`
- DB access / repairs / CA approvals / source changes by closeout: **0 / 0 / 0 / 0**
- R1-B / R1-C: **NOT STARTED / NOT STARTED**

Git commit/push hashes are recorded in the sealed evidence after publication.

## FIX3 staged-whitespace continuation

- execution IST: `2026-09-24T22:53:19.453276+05:30`
- prior FIX2 staged-failure evidence SHA-256: `2C1BAC80666DF14E9EC21A7387CE8A79B33AA75A574B77EFA60DAF99EF423D00`
- FIX2 repository documentation validation: **PASS twice before staging**
- FIX2 `git diff --cached --check`: **STOPPED on exactly three pre-existing Markdown hard-break trailing-space lines in two 2026-09-23 Auto-Approval closeout documents**
- FIX3 normalization: **removed only those three trailing-space sequences; text/meaning unchanged**
- R1-A source changes by FIX3: **0**
- DB access / repairs / CA approvals / build-tests: **0 / 0 / 0 / 0**
- R1-B / R1-C: **NOT STARTED / NOT STARTED**

Git commit/push hashes are recorded in the sealed FIX3 evidence after publication.
