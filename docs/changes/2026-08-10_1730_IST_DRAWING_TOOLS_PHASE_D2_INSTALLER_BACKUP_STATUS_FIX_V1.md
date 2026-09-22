# Drawing Tools Phase D2 — Installer Backup Status Fix V1

**IST timestamp:** 2026-08-10 17:30 IST  
**Project:** EOD Charting Platform  
**Project root:** `E:\TA Projects\EOD Charting Platform`  
**Implementation baseline:** `Eod Charting Platform Source Code 2026-08-10_170038_IST`

## Objective

Correct the Phase D2 package installer so a successful PowerShell project-backup script cannot be misclassified as failed because of a stale native-process `$LASTEXITCODE` value.

## Previous limitation

The original D2 V1 installer executed:

```powershell
$backupRoot = & $backupScript -ShortName 'drawing_tools_phase_d2_v1' -Paths $backupPaths
if ($LASTEXITCODE -ne 0) {
  throw "Project backup failed with exit code $LASTEXITCODE"
}
```

`create-project-backup.ps1` is another PowerShell script. A successful PowerShell-script invocation does not reliably reset `$LASTEXITCODE`, which represents the exit code of the last native process. A stale nonzero value could therefore trigger a false installer failure even though the backup script itself completed.

The reported D2 V1 run stopped at this check before the payload copy step.

## Files changed in packaging

- `Apply-Drawing-Tools-Phase-D2-V1-1.ps1`
- package `README.md`
- package manifest and payload hashes
- this evidence report under `docs\changes\`

No D2 drawing implementation behavior was changed by this packaging correction.

## Final implementation

The repaired installer:

1. invokes the existing project backup script inside PowerShell `try/catch`;
2. does not use `$LASTEXITCODE` to judge that PowerShell-script invocation;
3. requires a non-empty backup path result;
4. verifies the returned backup directory exists;
5. verifies `backup-manifest.json` exists inside that directory;
6. only then proceeds to the guarded payload copy.

This preserves the mandatory backup requirement rather than bypassing it.

## Validation performed while preparing package

- Reused the same D2 implementation payload from V1.
- Rebuilt the payload ZIP after adding this report.
- Recomputed payload and file SHA-256 values.
- Verified all modified baseline hashes against the uploaded `170038_IST` snapshot.
- Verified all new D2 paths are absent from that baseline.
- Verified outer ZIP CRC/integrity.

## Validation still required on Windows

Run the repaired installer with `-RunValidation`. It must confirm:

- project backup and backup manifest created;
- post-copy SHA-256 verification passes;
- focused D1/D2/timeframe/workspace/magnet/alert tests pass;
- renderer TypeScript typecheck passes;
- renderer production build passes.

Then build the portable Windows application and perform D2 manual acceptance.

## Risks / limitations

The installer assumes the current project backup script returns the created backup directory, which the verified baseline implementation does.

## Rollback guidance

The failed D2 V1 attempt stopped before payload copy, so it did not apply D2 source files. If D2 V1.1 later applies but must be rolled back, restore the files from the backup directory printed by the repaired installer.
