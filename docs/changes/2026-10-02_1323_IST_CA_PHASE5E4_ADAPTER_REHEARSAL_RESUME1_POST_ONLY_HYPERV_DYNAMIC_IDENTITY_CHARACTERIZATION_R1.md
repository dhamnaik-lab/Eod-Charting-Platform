# CA Phase5E4 — Adapter Rehearsal RESUME1 Post-Only Hyper-V Dynamic Identity Characterization R1

IST timestamp: 2026-10-02T13:23:42.800205+05:30

## Objective
Characterize the parent adapter-rehearsal failure without further adapter/network mutation, including current host state, parent PRE→POST dynamic identity, Hyper-V ManagementOS relationships, semantic identity stability, and causality limits.

## Authority
- Parent rehearsal STOP evidence SHA256: `7CF043D5E063EDCF87ECF868EECC8533486A84CD1BDDF82707D9B5398E26FCB4`
- Parent rehearsal package SHA256: `4D00EF7F7053D6ED5C35C5AF0E41702C8C718DB2C7A3918115FB10AFA0C2FC4B`
- Parent rehearsal runner SHA256: `C21F93CF3411BEDC7111565197E155FA14DCFC69461E50A3ECB8543B5EEEAF19`
- Accepted Design FIX2 FIX1 evidence SHA256: `37C83597AABB0064791A162EB82EFCCE948259196FE4A4FA427F5DDC06A7B6B7`

## Previous defect / limitation
The parent rehearsal stopped after 13/14 successful disables with a registry-key-deletion exception. Exact GUID restoration failed because two Hyper-V vEthernet semantic roles had different POST InterfaceGuid values than PRE.

## Final characterization
```json
{
  "task": "CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_ADAPTER_REHEARSAL_RESUME1_POST_ONLY_HYPERV_DYNAMIC_IDENTITY_CHARACTERIZATION_R1",
  "parentRehearsalStopEvidenceSha256": "7CF043D5E063EDCF87ECF868EECC8533486A84CD1BDDF82707D9B5398E26FCB4",
  "parentFailure": "Illegal operation attempted on a registry key that has been marked for deletion. ",
  "parentTargetCount": 14,
  "parentDisableAttemptCount": 13,
  "parentDisableSuccessCount": 13,
  "parentUnattemptedTargetGuid": "{F513E7FD-7A2A-4ADB-A4BE-93A01E10C202}",
  "parentMutationChronology": [
    {
      "order": 1,
      "Name": "Local Area Connection* 6",
      "InterfaceGuid": "{15936727-2AA6-4701-BACE-4A885BE75A33}",
      "success": true,
      "afterAdminStatus": "Down",
      "disableIssuedAt": "2026-10-02T11:53:35.0593365+05:30"
    },
    {
      "order": 2,
      "Name": "Local Area Connection* 8",
      "InterfaceGuid": "{2B14AB46-BBB8-457E-B6F4-166B3C7B6A35}",
      "success": true,
      "afterAdminStatus": "Down",
      "disableIssuedAt": "2026-10-02T11:53:56.3106380+05:30"
    },
    {
      "order": 3,
      "Name": "Local Area Connection* 2",
      "InterfaceGuid": "{31620748-C8C8-4620-A16D-E6EF920BC425}",
      "success": true,
      "afterAdminStatus": "Down",
      "disableIssuedAt": "2026-10-02T11:53:56.5910287+05:30"
    },
    {
      "order": 4,
      "Name": "vSwitch (Default Switch)",
      "InterfaceGuid": "{41A1AE67-4DAA-4B41-A395-426845FF25A2}",
      "success": true,
      "afterAdminStatus": "Down",
      "disableIssuedAt": "2026-10-02T11:53:56.8615812+05:30"
    },
    {
      "order": 5,
      "Name": "Local Area Connection* 1",
      "InterfaceGuid": "{63E122A4-B18E-4FB3-9A40-FB21D662064E}",
      "success": true,
      "afterAdminStatus": "Down",
      "disableIssuedAt": "2026-10-02T11:53:57.4053838+05:30"
    },
    {
      "order": 6,
      "Name": "Local Area Connection* 7",
      "InterfaceGuid": "{7CE909BC-34E0-450F-938F-3CCDE20FC7B6}",
      "success": true,
      "afterAdminStatus": "Down",
      "disableIssuedAt": "2026-10-02T11:53:57.7781491+05:30"
    },
    {
      "order": 7,
      "Name": "Local Area Connection* 3",
      "InterfaceGuid": "{91F1522C-556C-4722-8F39-6AE2A7E1F2DF}",
      "success": true,
      "afterAdminStatus": "Down",
      "disableIssuedAt": "2026-10-02T11:53:58.0359806+05:30"
    },
    {
      "order": 8,
      "Name": "vEthernet (Wi-Fi)",
      "InterfaceGuid": "{95C61755-A0A4-4CFA-ACFA-B52985E9F601}",
      "success": true,
      "afterAdminStatus": "Down",
      "disableIssuedAt": "2026-10-02T11:53:58.2985515+05:30"
    },
    {
      "order": 9,
      "Name": "vEthernet (Ethernet)",
      "InterfaceGuid": "{99C2752A-CC08-45D7-AD7C-66675FAD680B}",
      "success": true,
      "afterAdminStatus": "Down",
      "disableIssuedAt": "2026-10-02T11:53:58.9169717+05:30"
    },
    {
      "order": 10,
      "Name": "Ethernet",
      "InterfaceGuid": "{A51A08EF-67BE-4C6E-B9F6-6CAF11567555}",
      "success": true,
      "afterAdminStatus": "Down",
      "disableIssuedAt": "2026-10-02T11:53:59.2191032+05:30"
    },
    {
      "order": 11,
      "Name": "Wi-Fi",
      "InterfaceGuid": "{B9828310-BB01-4549-A726-F2CF45386A3A}",
      "success": true,
      "afterAdminStatus": "Down",
      "disableIssuedAt": "2026-10-02T11:54:00.4048516+05:30"
    },
    {
      "order": 12,
      "Name": "Local Area Connection* 4",
      "InterfaceGuid": "{CAA39361-81B8-4029-9258-A25D96AABA51}",
      "success": true,
      "afterAdminStatus": "Down",
      "disableIssuedAt": "2026-10-02T11:54:01.1029054+05:30"
    },
    {
      "order": 13,
      "Name": "Local Area Connection* 5",
      "InterfaceGuid": "{CC8D9A1E-8FE9-49E7-9EDC-543D61A64F6E}",
      "success": true,
      "afterAdminStatus": "Down",
      "disableIssuedAt": "2026-10-02T11:54:07.4725647+05:30"
    }
  ],
  "preAdapterCount": 18,
  "postAdapterCount": 18,
  "currentAdapterCount": 18,
  "semanticMembershipEqualPrePostCurrent": true,
  "semanticTripletUniqueCurrent": true,
  "currentAdminOperationalStateMatchesPost": true,
  "currentAdminOperationalStateMatchesPre": true,
  "semanticIdentityClassification": "SEMANTIC_TRIPLET_OBSERVED_STABLE_PRE_POST_CURRENT__NOT_MUTATION_AUTHORITY",
  "currentSemanticStateClassification": "SEMANTIC_MEMBERSHIP_AND_ADMIN_OPERATIONAL_STATE_MATCH_PARENT_POST",
  "dynamicGuidRowCount": 2,
  "dynamicGuidRows": [
    {
      "Name": "vEthernet (Ethernet)",
      "InterfaceDescription": "Hyper-V Virtual Ethernet Adapter",
      "InterfaceName": "ethernet_32774",
      "preGuid": "{99C2752A-CC08-45D7-AD7C-66675FAD680B}",
      "postGuid": "{3D5C121F-90C0-4EE5-83E9-F3F8289CF96C}",
      "currentGuid": "{3D5C121F-90C0-4EE5-83E9-F3F8289CF96C}",
      "preMac": "00-15-5D-20-86-29",
      "postMac": "00-15-5D-39-39-F2",
      "currentMac": "00-15-5D-39-39-F2",
      "preIfIndex": 27,
      "postIfIndex": 31,
      "currentIfIndex": 31,
      "preAdminStatus": "Up",
      "postAdminStatus": "Up",
      "currentAdminStatus": "Up",
      "preStatus": "Up",
      "postStatus": "Up",
      "currentStatus": "Up",
      "guidChangedPrePost": true,
      "currentGuidEqualsPost": true,
      "currentGuidEqualsPre": false
    },
    {
      "Name": "vEthernet (Wi-Fi)",
      "InterfaceDescription": "Hyper-V Virtual Ethernet Adapter #2",
      "InterfaceName": "ethernet_32775",
      "preGuid": "{95C61755-A0A4-4CFA-ACFA-B52985E9F601}",
      "postGuid": "{0A833DAD-1019-415A-87B6-D7C02CF5564E}",
      "currentGuid": "{0A833DAD-1019-415A-87B6-D7C02CF5564E}",
      "preMac": "00-15-5D-42-C2-40",
      "postMac": "00-15-5D-CA-2F-33",
      "currentMac": "00-15-5D-CA-2F-33",
      "preIfIndex": 37,
      "postIfIndex": 37,
      "currentIfIndex": 37,
      "preAdminStatus": "Up",
      "postAdminStatus": "Up",
      "currentAdminStatus": "Up",
      "preStatus": "Up",
      "postStatus": "Up",
      "currentStatus": "Up",
      "guidChangedPrePost": true,
      "currentGuidEqualsPost": true,
      "currentGuidEqualsPre": false
    }
  ],
  "noFurtherGuidChurnSinceParentPostForDynamicRows": true,
  "causalityClassification": "CAUSATIVE_DISABLE_OPERATION_UNRESOLVED_FROM_PARENT_EVIDENCE",
  "hyperVStatus": "OK",
  "hyperVRelationshipClassification": "HYPERV_MANAGEMENT_OS_RELATIONSHIP_CONFIRMED",
  "hyperVAffectedRowsConfirmed": true,
  "hyperVRelationships": [
    {
      "netAdapter": {
        "Name": "vEthernet (Ethernet)",
        "InterfaceDescription": "Hyper-V Virtual Ethernet Adapter",
        "InterfaceGuid": "{3D5C121F-90C0-4EE5-83E9-F3F8289CF96C}",
        "InterfaceName": "ethernet_32774",
        "ifIndex": 31,
        "Status": "Up",
        "AdminStatus": "Up",
        "Hidden": false,
        "HardwareInterface": false,
        "MediaType": "802.3",
        "PhysicalMediaType": "Unspecified",
        "MacAddress": "00-15-5D-39-39-F2",
        "LinkSpeed": "10 Gbps",
        "PnPDeviceID": "ROOT\\VMS_MP\\0000",
        "DriverDescription": "Hyper-V Virtual Ethernet Adapter"
      },
      "derivedSwitchLabel": "Ethernet",
      "candidateCount": 1,
      "confirmedCount": 1,
      "matches": [
        {
          "managementAdapter": {
            "Name": "Container NIC 163416b9",
            "SwitchName": "Default Switch",
            "SwitchId": "c08cb7b8-9b3c-408e-8e30-5e16a3aeb444",
            "Id": "Microsoft:C08CB7B8-9B3C-408E-8E30-5E16A3AEB444\\C9819460-098D-4A07-A1C3-7C8F1BD84DC1",
            "MacAddress": "00155D3939F2",
            "Status": "Ok",
            "IsManagementOs": true,
            "DeviceNaming": "",
            "VMName": ""
          },
          "reasons": [
            "MacAddress"
          ]
        }
      ],
      "switchExists": false
    },
    {
      "netAdapter": {
        "Name": "vEthernet (Wi-Fi)",
        "InterfaceDescription": "Hyper-V Virtual Ethernet Adapter #2",
        "InterfaceGuid": "{0A833DAD-1019-415A-87B6-D7C02CF5564E}",
        "InterfaceName": "ethernet_32775",
        "ifIndex": 37,
        "Status": "Up",
        "AdminStatus": "Up",
        "Hidden": false,
        "HardwareInterface": false,
        "MediaType": "802.3",
        "PhysicalMediaType": "Unspecified",
        "MacAddress": "00-15-5D-CA-2F-33",
        "LinkSpeed": "10 Gbps",
        "PnPDeviceID": "ROOT\\VMS_MP\\0001",
        "DriverDescription": "Hyper-V Virtual Ethernet Adapter"
      },
      "derivedSwitchLabel": "Wi-Fi",
      "candidateCount": 1,
      "confirmedCount": 1,
      "matches": [
        {
          "managementAdapter": {
            "Name": "Container NIC 95dc04c8",
            "SwitchName": "Default Switch",
            "SwitchId": "c08cb7b8-9b3c-408e-8e30-5e16a3aeb444",
            "Id": "Microsoft:C08CB7B8-9B3C-408E-8E30-5E16A3AEB444\\2E498A91-9FB2-4396-9070-1A6D7D40DA23",
            "MacAddress": "00155DCA2F33",
            "Status": "Ok",
            "IsManagementOs": true,
            "DeviceNaming": "",
            "VMName": ""
          },
          "reasons": [
            "MacAddress"
          ]
        }
      ],
      "switchExists": false
    },
    {
      "netAdapter": {
        "Name": "vEthernet (Default Switch)",
        "InterfaceDescription": "Hyper-V Virtual Ethernet Adapter #3",
        "InterfaceGuid": "{F513E7FD-7A2A-4ADB-A4BE-93A01E10C202}",
        "InterfaceName": "ethernet_32776",
        "ifIndex": 41,
        "Status": "Up",
        "AdminStatus": "Up",
        "Hidden": false,
        "HardwareInterface": false,
        "MediaType": "802.3",
        "PhysicalMediaType": "Unspecified",
        "MacAddress": "00-15-5D-6E-D5-A8",
        "LinkSpeed": "10 Gbps",
        "PnPDeviceID": "ROOT\\VMS_MP\\0002",
        "DriverDescription": "Hyper-V Virtual Ethernet Adapter"
      },
      "derivedSwitchLabel": "Default Switch",
      "candidateCount": 3,
      "confirmedCount": 3,
      "matches": [
        {
          "managementAdapter": {
            "Name": "Container NIC 163416b9",
            "SwitchName": "Default Switch",
            "SwitchId": "c08cb7b8-9b3c-408e-8e30-5e16a3aeb444",
            "Id": "Microsoft:C08CB7B8-9B3C-408E-8E30-5E16A3AEB444\\C9819460-098D-4A07-A1C3-7C8F1BD84DC1",
            "MacAddress": "00155D3939F2",
            "Status": "Ok",
            "IsManagementOs": true,
            "DeviceNaming": "",
            "VMName": ""
          },
          "reasons": [
            "SwitchName"
          ]
        },
        {
          "managementAdapter": {
            "Name": "Container NIC 95dc04c8",
            "SwitchName": "Default Switch",
            "SwitchId": "c08cb7b8-9b3c-408e-8e30-5e16a3aeb444",
            "Id": "Microsoft:C08CB7B8-9B3C-408E-8E30-5E16A3AEB444\\2E498A91-9FB2-4396-9070-1A6D7D40DA23",
            "MacAddress": "00155DCA2F33",
            "Status": "Ok",
            "IsManagementOs": true,
            "DeviceNaming": "",
            "VMName": ""
          },
          "reasons": [
            "SwitchName"
          ]
        },
        {
          "managementAdapter": {
            "Name": "Container NIC ba7417a9",
            "SwitchName": "Default Switch",
            "SwitchId": "c08cb7b8-9b3c-408e-8e30-5e16a3aeb444",
            "Id": "Microsoft:C08CB7B8-9B3C-408E-8E30-5E16A3AEB444\\007AD1C0-9586-4777-BA84-81F5166A9361",
            "MacAddress": "00155D6ED5A8",
            "Status": "Ok",
            "IsManagementOs": true,
            "DeviceNaming": "",
            "VMName": ""
          },
          "reasons": [
            "MacAddress",
            "SwitchName"
          ]
        }
      ],
      "switchExists": true
    }
  ],
  "hyperVSwitches": [
    {
      "Name": "Default Switch",
      "Id": "c08cb7b8-9b3c-408e-8e30-5e16a3aeb444",
      "SwitchType": "Internal",
      "NetAdapterInterfaceDescription": "",
      "NetAdapterInterfaceGuid": "",
      "AllowManagementOS": true,
      "Notes": ""
    }
  ],
  "hyperVManagementAdapters": [
    {
      "Name": "Container NIC 163416b9",
      "SwitchName": "Default Switch",
      "SwitchId": "c08cb7b8-9b3c-408e-8e30-5e16a3aeb444",
      "Id": "Microsoft:C08CB7B8-9B3C-408E-8E30-5E16A3AEB444\\C9819460-098D-4A07-A1C3-7C8F1BD84DC1",
      "MacAddress": "00155D3939F2",
      "Status": "Ok",
      "IsManagementOs": true,
      "DeviceNaming": "",
      "VMName": ""
    },
    {
      "Name": "Container NIC 95dc04c8",
      "SwitchName": "Default Switch",
      "SwitchId": "c08cb7b8-9b3c-408e-8e30-5e16a3aeb444",
      "Id": "Microsoft:C08CB7B8-9B3C-408E-8E30-5E16A3AEB444\\2E498A91-9FB2-4396-9070-1A6D7D40DA23",
      "MacAddress": "00155DCA2F33",
      "Status": "Ok",
      "IsManagementOs": true,
      "DeviceNaming": "",
      "VMName": ""
    },
    {
      "Name": "Container NIC ba7417a9",
      "SwitchName": "Default Switch",
      "SwitchId": "c08cb7b8-9b3c-408e-8e30-5e16a3aeb444",
      "Id": "Microsoft:C08CB7B8-9B3C-408E-8E30-5E16A3AEB444\\007AD1C0-9586-4777-BA84-81F5166A9361",
      "MacAddress": "00155D6ED5A8",
      "Status": "Ok",
      "IsManagementOs": true,
      "DeviceNaming": "",
      "VMName": ""
    }
  ],
  "loopbackIPv4Count": 1,
  "loopbackIPv6Count": 1,
  "obsoleteRecoveryScriptShouldBeRun": false,
  "obsoleteRecoveryReason": "Parent recovery script is GUID-bound and parent evidence proves two original vEthernet GUIDs disappeared; this post-only task performs no recovery mutation.",
  "boundaries": {
    "adapterMutation": 0,
    "firewallMutation": 0,
    "auditPolicyMutation": 0,
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
    "networkCommand": 0,
    "processTermination": 0
  },
  "blockers": [],
  "status": "PASS",
  "nextRecommendedTask": "CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_DESIGN_FIX3_HYPERV_DYNAMIC_IDENTITY_R1"
}
```

## Files changed
Product/source/build/dist/portable/database/network configuration: none. This change record is the only intended persistent project write.

## Behaviour preserved
No adapter enable/disable, Hyper-V mutation, firewall/audit-policy mutation, EOD launch, Load & Prepare, DB access/write/restore, Git, external-network command, or process termination.

## Validation / actual results
Exact authority hashes/manifests were verified. Parent PRE/POST semantic identities and mutation chronology were independently recomputed. Current visible+hidden adapter/IP/route state and local Hyper-V switch/ManagementOS vNIC relationships were captured read-only and compared by exact rules.

## Risks / limitations
This characterization does not prove a safe future mutation identity. Even if the semantic triplet is observed stable across PRE/POST/current, it remains explicitly non-authoritative until a redesigned recovery contract is independently reviewed. Exact causative disable operation remains unresolved unless direct parent evidence proves it.

## Rollback guidance
Read-only/post-only task; no rollback required. Do not run the obsolete parent GUID-bound recovery script based on this characterization.

## Blockers
```json
[]
```

## Next
`CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_DESIGN_FIX3_HYPERV_DYNAMIC_IDENTITY_R1`. No adapter rehearsal rerun or EOD live validation is authorized by this characterization.
