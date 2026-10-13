# CA Phase5E4 — Network Zero Enforcement Rehearsal R1

IST timestamp: 2026-10-02T10:14:29.366458+05:30

## Objective
Prove the accepted machine-wide network-zero enforcement architecture can be activated, observed in effective policy, and removed with exact restoration, without launching EOD or touching the database.

## Authority
- Design controller evidence SHA256: `0B47B8CDD3DD52BAC57FD2CC0887B9A47F5B6233A72CCC11896621BEF955F109`
- Design FIX1 evidence SHA256: `B8A794FFBA42B5672E22855CA10C3B4D22D199B13007525BEB6102F13F04B675`
- Architecture: `TEMPORARY_MACHINE_WIDE_EXPLICIT_OUTBOUND_BLOCK_ALL_NON_LOOPBACK_R1`

## Files changed
Product/source/build/dist/portable/database: 0. Temporary firewall/audit-policy mutations were run-owned and restored. This change record is the only intended persistent project write.

## Actual result
```json
{
  "task": "CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_REHEARSAL_R1",
  "architecture": "TEMPORARY_MACHINE_WIDE_EXPLICIT_OUTBOUND_BLOCK_ALL_NON_LOOPBACK_R1",
  "designControllerEvidenceSha256": "0B47B8CDD3DD52BAC57FD2CC0887B9A47F5B6233A72CCC11896621BEF955F109",
  "designFix1EvidenceSha256": "B8A794FFBA42B5672E22855CA10C3B4D22D199B13007525BEB6102F13F04B675",
  "preflightPassed": true,
  "auditMutationApplied": true,
  "firewallRulesCreated": 2,
  "activationReceipt": {
    "status": "ENFORCEMENT_ACTIVE_BEFORE_RUNTIME_LAUNCH",
    "activatedAt": "2026-10-02T10:14:16.6770314+05:30",
    "persistentRulesExact": true,
    "activeRulesExact": true,
    "activePrimaryStatusOk": false,
    "allowBypassCountAfterActivation": 0,
    "ruleV4": {
      "persistent": {
        "store": "PersistentStore",
        "name": "EOD_CA_P5E4_NETZERO_59aa3a79_IPv4_BLOCK",
        "exists": true,
        "rule": {
          "Name": "EOD_CA_P5E4_NETZERO_59aa3a79_IPv4_BLOCK",
          "DisplayName": "EOD_CA_P5E4_NETZERO_59aa3a79_IPv4_BLOCK",
          "Description": "CA_PHASE5E4_NETWORK_ZERO_REHEARSAL_R1_59aa3a79",
          "Enabled": "True",
          "Profile": "Any",
          "Direction": "Outbound",
          "Action": "Block",
          "PrimaryStatus": "OK",
          "PolicyStoreSource": "PersistentStore",
          "PolicyStoreSourceType": "PersistentStore"
        },
        "address": [
          {
            "LocalAddress": "Any",
            "RemoteAddress": "0.0.0.0-126.255.255.255|128.0.0.0-255.255.255.255"
          }
        ],
        "application": [
          {
            "Program": "Any",
            "Package": ""
          }
        ],
        "port": [
          {
            "Protocol": "Any",
            "LocalPort": "Any",
            "RemotePort": "Any",
            "IcmpType": "Any",
            "DynamicTarget": "Any"
          }
        ],
        "service": [
          {
            "Service": "Any"
          }
        ],
        "interface": [
          {
            "InterfaceAlias": "Any"
          }
        ],
        "interfaceType": [
          {
            "InterfaceType": "Any"
          }
        ],
        "security": [
          {
            "Authentication": "NotRequired",
            "Encryption": "NotRequired",
            "OverrideBlockRules": "False",
            "LocalUser": "Any",
            "RemoteUser": "Any",
            "RemoteMachine": "Any"
          }
        ]
      },
      "active": {
        "store": "ActiveStore",
        "name": "EOD_CA_P5E4_NETZERO_59aa3a79_IPv4_BLOCK",
        "exists": true,
        "rule": {
          "Name": "EOD_CA_P5E4_NETZERO_59aa3a79_IPv4_BLOCK",
          "DisplayName": "EOD_CA_P5E4_NETZERO_59aa3a79_IPv4_BLOCK",
          "Description": "CA_PHASE5E4_NETWORK_ZERO_REHEARSAL_R1_59aa3a79",
          "Enabled": "True",
          "Profile": "Any",
          "Direction": "Outbound",
          "Action": "Block",
          "PrimaryStatus": "Inactive",
          "PolicyStoreSource": "PersistentStore",
          "PolicyStoreSourceType": "PersistentStore"
        },
        "address": [
          {
            "LocalAddress": "Any",
            "RemoteAddress": "0.0.0.0-126.255.255.255|128.0.0.0-255.255.255.255"
          }
        ],
        "application": [
          {
            "Program": "Any",
            "Package": ""
          }
        ],
        "port": [
          {
            "Protocol": "Any",
            "LocalPort": "Any",
            "RemotePort": "Any",
            "IcmpType": "Any",
            "DynamicTarget": "Any"
          }
        ],
        "service": [
          {
            "Service": "Any"
          }
        ],
        "interface": [
          {
            "InterfaceAlias": "Any"
          }
        ],
        "interfaceType": [
          {
            "InterfaceType": "Any"
          }
        ],
        "security": [
          {
            "Authentication": "NotRequired",
            "Encryption": "NotRequired",
            "OverrideBlockRules": "False",
            "LocalUser": "Any",
            "RemoteUser": "Any",
            "RemoteMachine": "Any"
          }
        ]
      }
    },
    "ruleV6": {
      "persistent": {
        "store": "PersistentStore",
        "name": "EOD_CA_P5E4_NETZERO_59aa3a79_IPv6_BLOCK",
        "exists": true,
        "rule": {
          "Name": "EOD_CA_P5E4_NETZERO_59aa3a79_IPv6_BLOCK",
          "DisplayName": "EOD_CA_P5E4_NETZERO_59aa3a79_IPv6_BLOCK",
          "Description": "CA_PHASE5E4_NETWORK_ZERO_REHEARSAL_R1_59aa3a79",
          "Enabled": "True",
          "Profile": "Any",
          "Direction": "Outbound",
          "Action": "Block",
          "PrimaryStatus": "OK",
          "PolicyStoreSource": "PersistentStore",
          "PolicyStoreSourceType": "PersistentStore"
        },
        "address": [
          {
            "LocalAddress": "Any",
            "RemoteAddress": "::2-ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff"
          }
        ],
        "application": [
          {
            "Program": "Any",
            "Package": ""
          }
        ],
        "port": [
          {
            "Protocol": "Any",
            "LocalPort": "Any",
            "RemotePort": "Any",
            "IcmpType": "Any",
            "DynamicTarget": "Any"
          }
        ],
        "service": [
          {
            "Service": "Any"
          }
        ],
        "interface": [
          {
            "InterfaceAlias": "Any"
          }
        ],
        "interfaceType": [
          {
            "InterfaceType": "Any"
          }
        ],
        "security": [
          {
            "Authentication": "NotRequired",
            "Encryption": "NotRequired",
            "OverrideBlockRules": "False",
            "LocalUser": "Any",
            "RemoteUser": "Any",
            "RemoteMachine": "Any"
          }
        ]
      },
      "active": {
        "store": "ActiveStore",
        "name": "EOD_CA_P5E4_NETZERO_59aa3a79_IPv6_BLOCK",
        "exists": true,
        "rule": {
          "Name": "EOD_CA_P5E4_NETZERO_59aa3a79_IPv6_BLOCK",
          "DisplayName": "EOD_CA_P5E4_NETZERO_59aa3a79_IPv6_BLOCK",
          "Description": "CA_PHASE5E4_NETWORK_ZERO_REHEARSAL_R1_59aa3a79",
          "Enabled": "True",
          "Profile": "Any",
          "Direction": "Outbound",
          "Action": "Block",
          "PrimaryStatus": "Inactive",
          "PolicyStoreSource": "PersistentStore",
          "PolicyStoreSourceType": "PersistentStore"
        },
        "address": [
          {
            "LocalAddress": "Any",
            "RemoteAddress": "::2-ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff"
          }
        ],
        "application": [
          {
            "Program": "Any",
            "Package": ""
          }
        ],
        "port": [
          {
            "Protocol": "Any",
            "LocalPort": "Any",
            "RemotePort": "Any",
            "IcmpType": "Any",
            "DynamicTarget": "Any"
          }
        ],
        "service": [
          {
            "Service": "Any"
          }
        ],
        "interface": [
          {
            "InterfaceAlias": "Any"
          }
        ],
        "interfaceType": [
          {
            "InterfaceType": "Any"
          }
        ],
        "security": [
          {
            "Authentication": "NotRequired",
            "Encryption": "NotRequired",
            "OverrideBlockRules": "False",
            "LocalUser": "Any",
            "RemoteUser": "Any",
            "RemoteMachine": "Any"
          }
        ]
      }
    }
  },
  "holdChecks": {
    "checks": []
  },
  "wfpBlockedEventCount": 0,
  "cleanupAttempted": true,
  "cleanupSucceeded": true,
  "postResidue": {
    "persistentRuleCount": 0,
    "activeRuleCount": 0,
    "persistent": [],
    "active": []
  },
  "profilePrePostExact": true,
  "persistentFirewallPrePostExact": true,
  "auditPrePostExact": true,
  "recoveryScript": {
    "path": "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_PHASE5E4_NETWORK_ZERO_REHEARSAL_2026-10-02_101355_IST_59aa3a79\\collection\\RECOVERY-EOD-CA-P5E4-NETZERO.ps1",
    "sha256": "AD22829F20BCB6C3F16E8B875105922CB41159A5A4301699F63639EC4011C681",
    "parserPassed": true,
    "ruleV4": "EOD_CA_P5E4_NETZERO_59aa3a79_IPv4_BLOCK",
    "ruleV6": "EOD_CA_P5E4_NETZERO_59aa3a79_IPv6_BLOCK",
    "connectionAuditPre": {
      "guid": "{0CCE9226-69AE-11D9-BED3-505054503030}",
      "setting": "No Auditing",
      "success": false,
      "failure": false,
      "raw": "Machine Name,Policy Target,Subcategory,Subcategory GUID,Inclusion Setting,Exclusion Setting\r\n\r\nDESKTOP-R4E4TIE,System,Filtering Platform Connection,{0CCE9226-69AE-11D9-BED3-505054503030},No Auditing,\r\n\r\n"
    },
    "packetDropAuditPre": {
      "guid": "{0CCE9225-69AE-11D9-BED3-505054503030}",
      "setting": "No Auditing",
      "success": false,
      "failure": false,
      "raw": "Machine Name,Policy Target,Subcategory,Subcategory GUID,Inclusion Setting,Exclusion Setting\r\n\r\nDESKTOP-R4E4TIE,System,Filtering Platform Packet Drop,{0CCE9225-69AE-11D9-BED3-505054503030},No Auditing,\r\n\r\n"
    }
  },
  "boundaries": {
    "eodLaunch": 0,
    "loadPrepare": 0,
    "databaseAccess": 0,
    "databaseWrite": 0,
    "databaseRestore": 0,
    "sourceWrite": 0,
    "build": 0,
    "liveDistWrite": 0,
    "standardPortableWrite": 0,
    "git": 0,
    "externalProbeTraffic": 0,
    "processTermination": 0
  },
  "status": "STOP",
  "nextRecommendedTask": "STOP_FOR_AUDIT"
}
```

## Blockers / limitations
```json
[
  "Runner recorded failure: ActiveStore PrimaryStatus is not OK for both rules.",
  "ActiveStore PrimaryStatus was not OK for both rules.",
  "Hold verification count mismatch."
]
```

## Behaviour preserved
EOD launch=0 / Load & Prepare=0 / DB access/write/restore=0 / source/build/dist/portable=0 / Git=0 / external probe traffic=0 / process termination=0. No live Phase5E4 acceptance cycle was executed.

## Rollback
The two exact run-owned PersistentStore rules were removed and the two WFP audit subcategories restored to PRE state. The run-generated recovery script remains as evidence/recovery support only.

## Next
`STOP_FOR_AUDIT`. A live network-enforced validation remains separately authorized only after this rehearsal is independently audited and explicitly approved.
