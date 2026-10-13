# CA Phase5E4 RESUME5 RESUME3 — Security audit-policy continuity and log-integrity R1

IST timestamp: 2026-10-02T08:16:01.885765+05:30

## Objective
Determine whether retained Windows Security evidence shows a relevant audit-policy change or Security-log integrity interruption between a pre-cycle anchor and the RESUME2 elevated recovery.

## Previous limitation
RESUME2 recovered no 4688/4689 or 5156/5158 process/WFP telemetry and captured the relevant audit categories as No Auditing at 03:30 IST. Historical continuity between the live cycle and that recovery remained uncharacterized.

## Files changed
Product source/build/live dist/standard portable/database: 0. This audit record is the only intended active-project write.

## Final implementation
Administrator-only, local Security 4719 plus 1100/1101/1102/1104 characterization over 2026-10-02 00:30–03:35 IST; current auditpol capture; relevant-subcategory auditpol capture; Security-log retained-range and bounded-window coverage anchors. No EOD, DB, Git, network lookup or process termination.

## Actual result
```json
{
  "task": "CA_PHASE5E4_RESUME5_RESUME3_SECURITY_AUDIT_POLICY_CONTINUITY_AND_LOG_INTEGRITY_R1",
  "parentResume2EvidenceSha256": "A3C88D04618CE842987C7778760B26AF88296FB3722A431DB8BAA324D2260F8A",
  "continuityWindowLocal": {
    "start": "2026-10-02T00:30:00+05:30",
    "end": "2026-10-02T03:35:00+05:30"
  },
  "liveCycleWindowLocal": {
    "start": "2026-10-02T01:10:00+05:30",
    "end": "2026-10-02T01:35:00+05:30"
  },
  "currentAuditPolicySettings": {
    "Process Creation": "No Auditing",
    "Process Termination": "No Auditing",
    "Filtering Platform Connection": "No Auditing",
    "Filtering Platform Packet Drop": "No Auditing",
    "Audit Policy Change": "Success"
  },
  "parentResume2AuditPolicySettings": {
    "Process Creation": "No Auditing",
    "Process Termination": "No Auditing",
    "Filtering Platform Connection": "No Auditing",
    "Filtering Platform Packet Drop": "No Auditing",
    "Audit Policy Change": "Success"
  },
  "currentRelevantSubcategoriesNoAuditing": true,
  "parentRelevantSubcategoriesNoAuditing": true,
  "currentAuditPolicyChangeSuccess": true,
  "parentAuditPolicyChangeSuccess": true,
  "auditPolicyChangeEventCount": 0,
  "relevantAuditPolicyChangeEvents": [],
  "logIntegrityEventCount": 0,
  "relevantLogIntegrityEvents": [],
  "securityLogCoverage": {
    "oldestRetainedEvent": {
      "logName": "Security",
      "providerName": "Microsoft-Windows-Security-Auditing",
      "id": 4624,
      "recordId": 2176846,
      "timeCreated": "2026-10-01T01:58:04.3830536+05:30",
      "machineName": "DESKTOP-R4E4TIE",
      "eventData": [
        {
          "name": "SubjectUserSid",
          "value": "S-1-5-18"
        },
        {
          "name": "SubjectUserName",
          "value": "DESKTOP-R4E4TIE$"
        },
        {
          "name": "SubjectDomainName",
          "value": "WORKGROUP"
        },
        {
          "name": "SubjectLogonId",
          "value": "0x3e7"
        },
        {
          "name": "TargetUserSid",
          "value": "S-1-5-18"
        },
        {
          "name": "TargetUserName",
          "value": "SYSTEM"
        },
        {
          "name": "TargetDomainName",
          "value": "NT AUTHORITY"
        },
        {
          "name": "TargetLogonId",
          "value": "0x3e7"
        },
        {
          "name": "LogonType",
          "value": "5"
        },
        {
          "name": "LogonProcessName",
          "value": "Advapi  "
        },
        {
          "name": "AuthenticationPackageName",
          "value": "Negotiate"
        },
        {
          "name": "WorkstationName",
          "value": "-"
        },
        {
          "name": "LogonGuid",
          "value": "{00000000-0000-0000-0000-000000000000}"
        },
        {
          "name": "TransmittedServices",
          "value": "-"
        },
        {
          "name": "LmPackageName",
          "value": "-"
        },
        {
          "name": "KeyLength",
          "value": "0"
        },
        {
          "name": "ProcessId",
          "value": "0x488"
        },
        {
          "name": "ProcessName",
          "value": "C:\\Windows\\System32\\services.exe"
        },
        {
          "name": "IpAddress",
          "value": "-"
        },
        {
          "name": "IpPort",
          "value": "-"
        },
        {
          "name": "ImpersonationLevel",
          "value": "%%1833"
        },
        {
          "name": "RestrictedAdminMode",
          "value": "-"
        },
        {
          "name": "TargetOutboundUserName",
          "value": "-"
        },
        {
          "name": "TargetOutboundDomainName",
          "value": "-"
        },
        {
          "name": "VirtualAccount",
          "value": "%%1843"
        },
        {
          "name": "TargetLinkedLogonId",
          "value": "0x0"
        },
        {
          "name": "ElevatedToken",
          "value": "%%1842"
        }
      ],
      "message": "An account was successfully logged on.\r\n\r\nSubject:\r\n\tSecurity ID:\t\tS-1-5-18\r\n\tAccount Name:\t\tDESKTOP-R4E4TIE$\r\n\tAccount Domain:\t\tWORKGROUP\r\n\tLogon ID:\t\t0x3E7\r\n\r\nLogon Information:\r\n\tLogon Type:\t\t5\r\n\tRestricted Admin Mode:\t-\r\n\tVirtual Account:\t\tNo\r\n\tElevated Token:\t\tYes\r\n\r\nImpersonation Level:\t\tImpersonation\r\n\r\nNew Logon:\r\n\tSecurity ID:\t\tS-1-5-18\r\n\tAccount Name:\t\tSYSTEM\r\n\tAccount Domain:\t\tNT AUTHORITY\r\n\tLogon ID:\t\t0x3E7\r\n\tLinked Logon ID:\t\t0x0\r\n\tNetwork Account Name:\t-\r\n\tNetwork Account Domain:\t-\r\n\tLogon GUID:\t\t{00000000-0000-0000-0000-000000000000}\r\n\r\nProcess Information:\r\n\tProcess ID:\t\t0x488\r\n\tProcess Name:\t\tC:\\Windows\\System32\\services.exe\r\n\r\nNetwork Information:\r\n\tWorkstation Name:\t-\r\n\tSource Network Address:\t-\r\n\tSource Port:\t\t-\r\n\r\nDetailed Authentication Information:\r\n\tLogon Process:\t\tAdvapi  \r\n\tAuthentication Package:\tNegotiate\r\n\tTransited Services:\t-\r\n\tPackage Name (NTLM only):\t-\r\n\tKey Length:\t\t0\r\n\r\nThis event is generated when a logon session is created. It is generated on the computer that was accessed.\r\n\r\nThe subject fields indicate the account on the local system which requested the logon. This is most commonly a service such as the Server service, or a local process such as Winlogon.exe or Services.exe.\r\n\r\nThe logon type field indicates the kind of logon that occurred. The most common types are 2 (interactive) and 3 (network).\r\n\r\nThe New Logon fields indicate the account for whom the new logon was created, i.e. the account that was logged on.\r\n\r\nThe network fields indicate where a remote logon request originated. Workstation name is not always available and may be left blank in some cases.\r\n\r\nThe impersonation level field indicates the extent to which a process in the logon session can impersonate.\r\n\r\nThe authentication information fields provide detailed information about this specific logon request.\r\n\t- Logon GUID is a unique identifier that can be used to correlate this event with a KDC event.\r\n\t- Transited services indicate which intermediate services have participated in this logon request.\r\n\t- Package name indicates which sub-protocol was used among the NTLM protocols.\r\n\t- Key length indicates the length of the generated session key. This will be 0 if no session key was requested."
    },
    "newestRetainedEvent": {
      "logName": "Security",
      "providerName": "Microsoft-Windows-Security-Auditing",
      "id": 4799,
      "recordId": 2211454,
      "timeCreated": "2026-10-02T08:14:44.4710976+05:30",
      "machineName": "DESKTOP-R4E4TIE",
      "eventData": [
        {
          "name": "TargetUserName",
          "value": "Administrators"
        },
        {
          "name": "TargetDomainName",
          "value": "Builtin"
        },
        {
          "name": "TargetSid",
          "value": "S-1-5-32-544"
        },
        {
          "name": "SubjectUserSid",
          "value": "S-1-5-21-4206229455-509413405-3212636208-1001"
        },
        {
          "name": "SubjectUserName",
          "value": "dharm"
        },
        {
          "name": "SubjectDomainName",
          "value": "DESKTOP-R4E4TIE"
        },
        {
          "name": "SubjectLogonId",
          "value": "0x17616"
        },
        {
          "name": "CallerProcessId",
          "value": "0x30c"
        },
        {
          "name": "CallerProcessName",
          "value": "C:\\Windows\\System32\\taskhostw.exe"
        }
      ],
      "message": "A security-enabled local group membership was enumerated.\r\n\r\nSubject:\r\n\tSecurity ID:\t\tS-1-5-21-4206229455-509413405-3212636208-1001\r\n\tAccount Name:\t\tdharm\r\n\tAccount Domain:\t\tDESKTOP-R4E4TIE\r\n\tLogon ID:\t\t0x17616\r\n\r\nGroup:\r\n\tSecurity ID:\t\tS-1-5-32-544\r\n\tGroup Name:\t\tAdministrators\r\n\tGroup Domain:\t\tBuiltin\r\n\r\nProcess Information:\r\n\tProcess ID:\t\t0x30c\r\n\tProcess Name:\t\tC:\\Windows\\System32\\taskhostw.exe"
    },
    "firstEventInContinuityWindow": {
      "logName": "Security",
      "providerName": "Microsoft-Windows-Security-Auditing",
      "id": 4799,
      "recordId": 2208967,
      "timeCreated": "2026-10-02T00:31:05.3876861+05:30",
      "machineName": "DESKTOP-R4E4TIE",
      "eventData": [
        {
          "name": "TargetUserName",
          "value": "Administrators"
        },
        {
          "name": "TargetDomainName",
          "value": "Builtin"
        },
        {
          "name": "TargetSid",
          "value": "S-1-5-32-544"
        },
        {
          "name": "SubjectUserSid",
          "value": "S-1-5-21-4206229455-509413405-3212636208-1001"
        },
        {
          "name": "SubjectUserName",
          "value": "dharm"
        },
        {
          "name": "SubjectDomainName",
          "value": "DESKTOP-R4E4TIE"
        },
        {
          "name": "SubjectLogonId",
          "value": "0x17616"
        },
        {
          "name": "CallerProcessId",
          "value": "0x30c"
        },
        {
          "name": "CallerProcessName",
          "value": "C:\\Windows\\System32\\taskhostw.exe"
        }
      ],
      "message": "A security-enabled local group membership was enumerated.\r\n\r\nSubject:\r\n\tSecurity ID:\t\tS-1-5-21-4206229455-509413405-3212636208-1001\r\n\tAccount Name:\t\tdharm\r\n\tAccount Domain:\t\tDESKTOP-R4E4TIE\r\n\tLogon ID:\t\t0x17616\r\n\r\nGroup:\r\n\tSecurity ID:\t\tS-1-5-32-544\r\n\tGroup Name:\t\tAdministrators\r\n\tGroup Domain:\t\tBuiltin\r\n\r\nProcess Information:\r\n\tProcess ID:\t\t0x30c\r\n\tProcess Name:\t\tC:\\Windows\\System32\\taskhostw.exe"
    },
    "lastEventInContinuityWindow": {
      "logName": "Security",
      "providerName": "Microsoft-Windows-Security-Auditing",
      "id": 4799,
      "recordId": 2210635,
      "timeCreated": "2026-10-02T03:33:16.7238142+05:30",
      "machineName": "DESKTOP-R4E4TIE",
      "eventData": [
        {
          "name": "TargetUserName",
          "value": "Administrators"
        },
        {
          "name": "TargetDomainName",
          "value": "Builtin"
        },
        {
          "name": "TargetSid",
          "value": "S-1-5-32-544"
        },
        {
          "name": "SubjectUserSid",
          "value": "S-1-5-21-4206229455-509413405-3212636208-1001"
        },
        {
          "name": "SubjectUserName",
          "value": "dharm"
        },
        {
          "name": "SubjectDomainName",
          "value": "DESKTOP-R4E4TIE"
        },
        {
          "name": "SubjectLogonId",
          "value": "0x17616"
        },
        {
          "name": "CallerProcessId",
          "value": "0x30c"
        },
        {
          "name": "CallerProcessName",
          "value": "C:\\Windows\\System32\\taskhostw.exe"
        }
      ],
      "message": "A security-enabled local group membership was enumerated.\r\n\r\nSubject:\r\n\tSecurity ID:\t\tS-1-5-21-4206229455-509413405-3212636208-1001\r\n\tAccount Name:\t\tdharm\r\n\tAccount Domain:\t\tDESKTOP-R4E4TIE\r\n\tLogon ID:\t\t0x17616\r\n\r\nGroup:\r\n\tSecurity ID:\t\tS-1-5-32-544\r\n\tGroup Name:\t\tAdministrators\r\n\tGroup Domain:\t\tBuiltin\r\n\r\nProcess Information:\r\n\tProcess ID:\t\t0x30c\r\n\tProcess Name:\t\tC:\\Windows\\System32\\taskhostw.exe"
    },
    "logCoversContinuityStart": true,
    "logCoversContinuityEnd": true,
    "anchorsBracketWindowWithinFiveMinutes": true
  },
  "continuityConclusion": "NO_RELEVANT_POLICY_CHANGE_OR_LOG_INTEGRITY_EVENT_OBSERVED__CONSISTENT_WITH_NO_AUDITING_CONTINUITY",
  "historicalSecurityProvenanceRecoveryConclusion": "EXHAUSTED_NO_PROCESS_OR_WFP_TELEMETRY_AVAILABLE__CONSISTENT_WITH_NO_AUDITING",
  "directHistoricalProcessOrWfpProvenanceRecovered": false,
  "strictNetworkZeroSatisfied": false,
  "strictNetworkZeroConclusion": "UNSATISFIED",
  "observedExternalTcpConnections": 6,
  "acceptanceBoundaryChangeGranted": false,
  "boundaries": {
    "eodLaunch": 0,
    "loadPrepare": 0,
    "databaseAccess": 0,
    "databaseCopy": 0,
    "databaseWrite": 0,
    "databaseRestore": 0,
    "sourceWrite": 0,
    "build": 0,
    "liveDistWrite": 0,
    "standardPortableWrite": 0,
    "git": 0,
    "newNetworkAccess": 0,
    "processTermination": 0
  },
  "limitations": [
    "A clean continuity result is consistency evidence, not a direct historical snapshot of the four audit subcategories at 01:20 IST.",
    "No process-image or WFP application provenance for PIDs 13932/15528 is created by this task.",
    "The six observed external TCP connections remain incompatible with the original literal network=0 boundary."
  ]
}
```

## Blockers / limitations
```json
[
  "Original strict network=0 contract remains unsatisfied because six external TCP connections were observed; this task cannot waive that boundary."
]
```

## Behaviour preserved
EOD launch=0 / Load & Prepare=0 / DB access/copy/write/restore=0 / source/build/dist/portable=0 / Git=0 / new network access=0 / process termination=0. The strict network=0 boundary is not relaxed.

## Rollback
None. This task performs no product/database mutation. Existing RESUME5 rollback backups remain untouched.

## Next
Independent audit. If continuity is clean, historical Security process/WFP provenance is documented as exhausted at this layer; the six observed TCP connections still do not satisfy literal network=0.
