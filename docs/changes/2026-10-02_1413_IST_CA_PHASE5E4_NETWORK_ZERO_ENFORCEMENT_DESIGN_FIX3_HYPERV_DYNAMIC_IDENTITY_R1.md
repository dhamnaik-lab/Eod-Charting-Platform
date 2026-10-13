# CA Phase5E4 — Network Zero Enforcement Design FIX3 Hyper-V Dynamic Identity R1

IST timestamp: 2026-10-02T14:13:11.624531+05:30

## Objective
Freeze a host-adaptive, role-aware, product-external network-zero validation design that handles replaceable Hyper-V vEthernet instances and remains portable across different Windows PCs.

## Authority
- RESUME1 characterization evidence SHA256: `FB9BCC24599F48E9180A2C0F0F8D171C1CF8BA070832EC04D63B00D34448E99C`
- Adapter Rehearsal STOP evidence SHA256: `7CF043D5E063EDCF87ECF868EECC8533486A84CD1BDDF82707D9B5398E26FCB4`
- Design FIX2 FIX1 evidence SHA256: `37C83597AABB0064791A162EB82EFCCE948259196FE4A4FA427F5DDC06A7B6B7`

## Previous defect / limitation
The parent full NetAdapter disable rehearsal stopped after 13/14 successful disables and proved that two Hyper-V host vEthernet Windows instances can be re-provisioned with new InterfaceGuid/MAC values. The prior GUID-bound recovery contract is therefore invalid for those roles.

## Final design
`HOST_ADAPTIVE_ROLE_AWARE_CONTROL_PLANE_NETWORK_ZERO_R1`. EOD product behaviour remains unchanged. Each host is freshly discovered and role-classified. Hyper-V ManagementOS vNICs are reserved for Hyper-V control-plane isolation after Gate A proof; switch-fabric extension adapters are monitor-only; unsupported active roles fail closed.

## Target-host read-only preflight
```json
{
  "task": "CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_DESIGN_FIX3_HYPERV_DYNAMIC_IDENTITY_R1",
  "selectedArchitecture": "HOST_ADAPTIVE_ROLE_AWARE_CONTROL_PLANE_NETWORK_ZERO_R1",
  "hostAdaptive": true,
  "productDependency": false,
  "currentAdapterCount": 18,
  "loopbackInterfaceIndices": [
    1
  ],
  "roleCounts": {
    "PRE_DOWN_UNTOUCHED": 4,
    "HARDWARE_NETADAPTER_ADMIN_CONTROL": 2,
    "PROVEN_STABLE_VIRTUAL_NETADAPTER_ADMIN_CONTROL": 8,
    "HYPERV_SWITCH_FABRIC_MONITOR_ONLY": 1,
    "HYPERV_MANAGEMENT_OS_CONTROL_PLANE": 3
  },
  "roles": [
    {
      "Name": "Ethernet (Kernel Debugger)",
      "InterfaceDescription": "Microsoft Kernel Debug Network Adapter",
      "InterfaceName": "ethernet_32768",
      "InterfaceGuid": "{37C0CA1D-AA59-4EB8-B28D-00EBC0C9024D}",
      "MacAddress": "",
      "ifIndex": 7,
      "AdminStatus": "Down",
      "Status": "Not Present",
      "Hidden": true,
      "HardwareInterface": false,
      "connectedNonLoopbackIp": false,
      "roleClass": "PRE_DOWN_UNTOUCHED",
      "reason": "administratively down",
      "hyperVMatches": []
    },
    {
      "Name": "Ethernet",
      "InterfaceDescription": "Intel(R) Ethernet Connection (2) I219-LM",
      "InterfaceName": "ethernet_32769",
      "InterfaceGuid": "{A51A08EF-67BE-4C6E-B9F6-6CAF11567555}",
      "MacAddress": "F4-8E-38-AB-92-BC",
      "ifIndex": 14,
      "AdminStatus": "Up",
      "Status": "Disconnected",
      "Hidden": false,
      "HardwareInterface": true,
      "connectedNonLoopbackIp": false,
      "roleClass": "HARDWARE_NETADAPTER_ADMIN_CONTROL",
      "reason": "hardware interface",
      "hyperVMatches": []
    },
    {
      "Name": "Local Area Connection* 6",
      "InterfaceDescription": "WAN Miniport (IP)",
      "InterfaceName": "ethernet_32770",
      "InterfaceGuid": "{15936727-2AA6-4701-BACE-4A885BE75A33}",
      "MacAddress": "",
      "ifIndex": 3,
      "AdminStatus": "Up",
      "Status": "Up",
      "Hidden": true,
      "HardwareInterface": false,
      "connectedNonLoopbackIp": false,
      "roleClass": "PROVEN_STABLE_VIRTUAL_NETADAPTER_ADMIN_CONTROL",
      "reason": "parent successful disable + same GUID/state restored; non-Hyper-V virtual role",
      "hyperVMatches": []
    },
    {
      "Name": "Local Area Connection* 7",
      "InterfaceDescription": "WAN Miniport (IPv6)",
      "InterfaceName": "ethernet_32771",
      "InterfaceGuid": "{7CE909BC-34E0-450F-938F-3CCDE20FC7B6}",
      "MacAddress": "",
      "ifIndex": 11,
      "AdminStatus": "Up",
      "Status": "Up",
      "Hidden": true,
      "HardwareInterface": false,
      "connectedNonLoopbackIp": false,
      "roleClass": "PROVEN_STABLE_VIRTUAL_NETADAPTER_ADMIN_CONTROL",
      "reason": "parent successful disable + same GUID/state restored; non-Hyper-V virtual role",
      "hyperVMatches": []
    },
    {
      "Name": "Local Area Connection* 8",
      "InterfaceDescription": "WAN Miniport (Network Monitor)",
      "InterfaceName": "ethernet_32772",
      "InterfaceGuid": "{2B14AB46-BBB8-457E-B6F4-166B3C7B6A35}",
      "MacAddress": "",
      "ifIndex": 4,
      "AdminStatus": "Up",
      "Status": "Up",
      "Hidden": true,
      "HardwareInterface": false,
      "connectedNonLoopbackIp": false,
      "roleClass": "PROVEN_STABLE_VIRTUAL_NETADAPTER_ADMIN_CONTROL",
      "reason": "parent successful disable + same GUID/state restored; non-Hyper-V virtual role",
      "hyperVMatches": []
    },
    {
      "Name": "vSwitch (Default Switch)",
      "InterfaceDescription": "Hyper-V Virtual Switch Extension Adapter",
      "InterfaceName": "ethernet_32773",
      "InterfaceGuid": "{41A1AE67-4DAA-4B41-A395-426845FF25A2}",
      "MacAddress": "",
      "ifIndex": 19,
      "AdminStatus": "Up",
      "Status": "Up",
      "Hidden": true,
      "HardwareInterface": false,
      "connectedNonLoopbackIp": false,
      "roleClass": "HYPERV_SWITCH_FABRIC_MONITOR_ONLY",
      "reason": "Hyper-V switch fabric with no connected IP interface on this ifIndex",
      "hyperVMatches": []
    },
    {
      "Name": "vEthernet (Ethernet)",
      "InterfaceDescription": "Hyper-V Virtual Ethernet Adapter",
      "InterfaceName": "ethernet_32774",
      "InterfaceGuid": "{3D5C121F-90C0-4EE5-83E9-F3F8289CF96C}",
      "MacAddress": "00-15-5D-39-39-F2",
      "ifIndex": 31,
      "AdminStatus": "Up",
      "Status": "Up",
      "Hidden": false,
      "HardwareInterface": false,
      "connectedNonLoopbackIp": true,
      "roleClass": "HYPERV_MANAGEMENT_OS_CONTROL_PLANE",
      "reason": "exact current MAC correlation to one Hyper-V ManagementOS vNIC",
      "hyperVMatches": [
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
        }
      ]
    },
    {
      "Name": "vEthernet (Wi-Fi)",
      "InterfaceDescription": "Hyper-V Virtual Ethernet Adapter #2",
      "InterfaceName": "ethernet_32775",
      "InterfaceGuid": "{0A833DAD-1019-415A-87B6-D7C02CF5564E}",
      "MacAddress": "00-15-5D-CA-2F-33",
      "ifIndex": 37,
      "AdminStatus": "Up",
      "Status": "Up",
      "Hidden": false,
      "HardwareInterface": false,
      "connectedNonLoopbackIp": true,
      "roleClass": "HYPERV_MANAGEMENT_OS_CONTROL_PLANE",
      "reason": "exact current MAC correlation to one Hyper-V ManagementOS vNIC",
      "hyperVMatches": [
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
        }
      ]
    },
    {
      "Name": "vEthernet (Default Switch)",
      "InterfaceDescription": "Hyper-V Virtual Ethernet Adapter #3",
      "InterfaceName": "ethernet_32776",
      "InterfaceGuid": "{F513E7FD-7A2A-4ADB-A4BE-93A01E10C202}",
      "MacAddress": "00-15-5D-6E-D5-A8",
      "ifIndex": 41,
      "AdminStatus": "Up",
      "Status": "Up",
      "Hidden": false,
      "HardwareInterface": false,
      "connectedNonLoopbackIp": true,
      "roleClass": "HYPERV_MANAGEMENT_OS_CONTROL_PLANE",
      "reason": "exact current MAC correlation to one Hyper-V ManagementOS vNIC",
      "hyperVMatches": [
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
      ]
    },
    {
      "Name": "Local Area Connection* 5",
      "InterfaceDescription": "WAN Miniport (PPPOE)",
      "InterfaceName": "ppp_32768",
      "InterfaceGuid": "{CC8D9A1E-8FE9-49E7-9EDC-543D61A64F6E}",
      "MacAddress": "",
      "ifIndex": 18,
      "AdminStatus": "Up",
      "Status": "Disconnected",
      "Hidden": true,
      "HardwareInterface": false,
      "connectedNonLoopbackIp": false,
      "roleClass": "PROVEN_STABLE_VIRTUAL_NETADAPTER_ADMIN_CONTROL",
      "reason": "parent successful disable + same GUID/state restored; non-Hyper-V virtual role",
      "hyperVMatches": []
    },
    {
      "Name": "Teredo Tunneling Pseudo-Interface",
      "InterfaceDescription": "",
      "InterfaceName": "tunnel_32512",
      "InterfaceGuid": "{93123211-9629-4E04-82F0-EA2E4F221468}",
      "MacAddress": "",
      "ifIndex": 13,
      "AdminStatus": "Down",
      "Status": "Not Present",
      "Hidden": true,
      "HardwareInterface": false,
      "connectedNonLoopbackIp": false,
      "roleClass": "PRE_DOWN_UNTOUCHED",
      "reason": "administratively down",
      "hyperVMatches": []
    },
    {
      "Name": "Microsoft IP-HTTPS Platform Interface",
      "InterfaceDescription": "",
      "InterfaceName": "tunnel_32513",
      "InterfaceGuid": "{2EE2C70C-A092-4D88-A654-98C8D7645CD5}",
      "MacAddress": "",
      "ifIndex": 5,
      "AdminStatus": "Down",
      "Status": "Not Present",
      "Hidden": true,
      "HardwareInterface": false,
      "connectedNonLoopbackIp": false,
      "roleClass": "PRE_DOWN_UNTOUCHED",
      "reason": "administratively down",
      "hyperVMatches": []
    },
    {
      "Name": "6to4 Adapter",
      "InterfaceDescription": "",
      "InterfaceName": "tunnel_32514",
      "InterfaceGuid": "{07374750-E68B-490E-9330-9FD785CD71B6}",
      "MacAddress": "",
      "ifIndex": 2,
      "AdminStatus": "Down",
      "Status": "Not Present",
      "Hidden": true,
      "HardwareInterface": false,
      "connectedNonLoopbackIp": false,
      "roleClass": "PRE_DOWN_UNTOUCHED",
      "reason": "administratively down",
      "hyperVMatches": []
    },
    {
      "Name": "Local Area Connection* 1",
      "InterfaceDescription": "WAN Miniport (SSTP)",
      "InterfaceName": "tunnel_32768",
      "InterfaceGuid": "{63E122A4-B18E-4FB3-9A40-FB21D662064E}",
      "MacAddress": "",
      "ifIndex": 10,
      "AdminStatus": "Up",
      "Status": "Disconnected",
      "Hidden": true,
      "HardwareInterface": false,
      "connectedNonLoopbackIp": false,
      "roleClass": "PROVEN_STABLE_VIRTUAL_NETADAPTER_ADMIN_CONTROL",
      "reason": "parent successful disable + same GUID/state restored; non-Hyper-V virtual role",
      "hyperVMatches": []
    },
    {
      "Name": "Local Area Connection* 2",
      "InterfaceDescription": "WAN Miniport (IKEv2)",
      "InterfaceName": "tunnel_32769",
      "InterfaceGuid": "{31620748-C8C8-4620-A16D-E6EF920BC425}",
      "MacAddress": "",
      "ifIndex": 6,
      "AdminStatus": "Up",
      "Status": "Disconnected",
      "Hidden": true,
      "HardwareInterface": false,
      "connectedNonLoopbackIp": false,
      "roleClass": "PROVEN_STABLE_VIRTUAL_NETADAPTER_ADMIN_CONTROL",
      "reason": "parent successful disable + same GUID/state restored; non-Hyper-V virtual role",
      "hyperVMatches": []
    },
    {
      "Name": "Local Area Connection* 3",
      "InterfaceDescription": "WAN Miniport (L2TP)",
      "InterfaceName": "tunnel_32770",
      "InterfaceGuid": "{91F1522C-556C-4722-8F39-6AE2A7E1F2DF}",
      "MacAddress": "",
      "ifIndex": 12,
      "AdminStatus": "Up",
      "Status": "Disconnected",
      "Hidden": true,
      "HardwareInterface": false,
      "connectedNonLoopbackIp": false,
      "roleClass": "PROVEN_STABLE_VIRTUAL_NETADAPTER_ADMIN_CONTROL",
      "reason": "parent successful disable + same GUID/state restored; non-Hyper-V virtual role",
      "hyperVMatches": []
    },
    {
      "Name": "Local Area Connection* 4",
      "InterfaceDescription": "WAN Miniport (PPTP)",
      "InterfaceName": "tunnel_32771",
      "InterfaceGuid": "{CAA39361-81B8-4029-9258-A25D96AABA51}",
      "MacAddress": "",
      "ifIndex": 17,
      "AdminStatus": "Up",
      "Status": "Disconnected",
      "Hidden": true,
      "HardwareInterface": false,
      "connectedNonLoopbackIp": false,
      "roleClass": "PROVEN_STABLE_VIRTUAL_NETADAPTER_ADMIN_CONTROL",
      "reason": "parent successful disable + same GUID/state restored; non-Hyper-V virtual role",
      "hyperVMatches": []
    },
    {
      "Name": "Wi-Fi",
      "InterfaceDescription": "Realtek RTL8191SU Wireless LAN 802.11n USB 2.0 Network Adapter",
      "InterfaceName": "wireless_32768",
      "InterfaceGuid": "{B9828310-BB01-4549-A726-F2CF45386A3A}",
      "MacAddress": "00-1E-A6-11-E8-A3",
      "ifIndex": 16,
      "AdminStatus": "Up",
      "Status": "Up",
      "Hidden": false,
      "HardwareInterface": true,
      "connectedNonLoopbackIp": true,
      "roleClass": "HARDWARE_NETADAPTER_ADMIN_CONTROL",
      "reason": "hardware interface",
      "hyperVMatches": []
    }
  ],
  "ambiguousRoleCount": 0,
  "currentSemanticMembershipMatchesAcceptedPost": true,
  "hyperVStatus": "OK",
  "hyperVSwitchCount": 1,
  "hyperVManagementAdapterCount": 3,
  "disconnectCapability": {
    "present": true,
    "commandType": "Cmdlet",
    "moduleName": "Hyper-V",
    "parameters": [
      "CimSession",
      "ComputerName",
      "Confirm",
      "Credential",
      "Debug",
      "ErrorAction",
      "ErrorVariable",
      "InformationAction",
      "InformationVariable",
      "Name",
      "OutBuffer",
      "OutVariable",
      "Passthru",
      "PipelineVariable",
      "ProgressAction",
      "Verbose",
      "VMName",
      "VMNetworkAdapter",
      "WarningAction",
      "WarningVariable",
      "WhatIf"
    ],
    "parameterSets": [
      {
        "name": "Name",
        "parameters": [
          "CimSession",
          "ComputerName",
          "Confirm",
          "Credential",
          "Debug",
          "ErrorAction",
          "ErrorVariable",
          "InformationAction",
          "InformationVariable",
          "Name",
          "OutBuffer",
          "OutVariable",
          "Passthru",
          "PipelineVariable",
          "ProgressAction",
          "Verbose",
          "VMName",
          "WarningAction",
          "WarningVariable",
          "WhatIf"
        ]
      },
      {
        "name": "Obj",
        "parameters": [
          "Confirm",
          "Debug",
          "ErrorAction",
          "ErrorVariable",
          "InformationAction",
          "InformationVariable",
          "OutBuffer",
          "OutVariable",
          "Passthru",
          "PipelineVariable",
          "ProgressAction",
          "Verbose",
          "VMNetworkAdapter",
          "WarningAction",
          "WarningVariable",
          "WhatIf"
        ]
      }
    ]
  },
  "connectCapability": {
    "present": true,
    "commandType": "Cmdlet",
    "moduleName": "Hyper-V",
    "parameters": [
      "CimSession",
      "ComputerName",
      "Confirm",
      "Credential",
      "Debug",
      "ErrorAction",
      "ErrorVariable",
      "InformationAction",
      "InformationVariable",
      "Name",
      "OutBuffer",
      "OutVariable",
      "Passthru",
      "PipelineVariable",
      "ProgressAction",
      "SwitchName",
      "UseAutomaticConnection",
      "Verbose",
      "VMName",
      "VMNetworkAdapter",
      "VMSwitch",
      "WarningAction",
      "WarningVariable",
      "WhatIf"
    ],
    "parameterSets": [
      {
        "name": "Name_SwitchName",
        "parameters": [
          "CimSession",
          "ComputerName",
          "Confirm",
          "Credential",
          "Debug",
          "ErrorAction",
          "ErrorVariable",
          "InformationAction",
          "InformationVariable",
          "Name",
          "OutBuffer",
          "OutVariable",
          "Passthru",
          "PipelineVariable",
          "ProgressAction",
          "SwitchName",
          "Verbose",
          "VMName",
          "WarningAction",
          "WarningVariable",
          "WhatIf"
        ]
      },
      {
        "name": "Object_SwitchName",
        "parameters": [
          "Confirm",
          "Debug",
          "ErrorAction",
          "ErrorVariable",
          "InformationAction",
          "InformationVariable",
          "OutBuffer",
          "OutVariable",
          "Passthru",
          "PipelineVariable",
          "ProgressAction",
          "SwitchName",
          "Verbose",
          "VMNetworkAdapter",
          "WarningAction",
          "WarningVariable",
          "WhatIf"
        ]
      },
      {
        "name": "Object_SwitchObject",
        "parameters": [
          "Confirm",
          "Debug",
          "ErrorAction",
          "ErrorVariable",
          "InformationAction",
          "InformationVariable",
          "OutBuffer",
          "OutVariable",
          "Passthru",
          "PipelineVariable",
          "ProgressAction",
          "Verbose",
          "VMNetworkAdapter",
          "VMSwitch",
          "WarningAction",
          "WarningVariable",
          "WhatIf"
        ]
      },
      {
        "name": "Object_UseAutomaticConnection",
        "parameters": [
          "Confirm",
          "Debug",
          "ErrorAction",
          "ErrorVariable",
          "InformationAction",
          "InformationVariable",
          "OutBuffer",
          "OutVariable",
          "Passthru",
          "PipelineVariable",
          "ProgressAction",
          "UseAutomaticConnection",
          "Verbose",
          "VMNetworkAdapter",
          "WarningAction",
          "WarningVariable",
          "WhatIf"
        ]
      },
      {
        "name": "Name_SwitchObject",
        "parameters": [
          "Confirm",
          "Debug",
          "ErrorAction",
          "ErrorVariable",
          "InformationAction",
          "InformationVariable",
          "Name",
          "OutBuffer",
          "OutVariable",
          "Passthru",
          "PipelineVariable",
          "ProgressAction",
          "Verbose",
          "VMName",
          "VMSwitch",
          "WarningAction",
          "WarningVariable",
          "WhatIf"
        ]
      },
      {
        "name": "Name_UseAutomaticConnection",
        "parameters": [
          "CimSession",
          "ComputerName",
          "Confirm",
          "Credential",
          "Debug",
          "ErrorAction",
          "ErrorVariable",
          "InformationAction",
          "InformationVariable",
          "Name",
          "OutBuffer",
          "OutVariable",
          "Passthru",
          "PipelineVariable",
          "ProgressAction",
          "UseAutomaticConnection",
          "Verbose",
          "VMName",
          "WarningAction",
          "WarningVariable",
          "WhatIf"
        ]
      }
    ]
  },
  "gateARequired": true,
  "gateATask": "CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_FIX3_GATE_A_HYPERV_CONTROL_PLANE_MICRO_REHEARSAL_R1",
  "designFeasibleForGateA": true,
  "hardCodedMachineIdentityAuthorized": false,
  "eodProductChangeRequired": false,
  "boundaries": {
    "adapterMutation": 0,
    "hyperVMutation": 0,
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
  "nextRecommendedTask": "CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_FIX3_GATE_A_HYPERV_CONTROL_PLANE_MICRO_REHEARSAL_R1"
}
```

## Files changed
Product/source/build/dist/portable/database/network configuration: none. This design change record is the only intended persistent project write.

## Behaviour preserved
Corporate Actions product behaviour, strict network-zero acceptance intent, loopback-only local IPC allowance, current host network state, and the prohibition on the obsolete GUID-bound recovery script remain unchanged.

## Validation / actual results
Exact authority ZIPs/manifests, current adapter/IP/route/Hyper-V inventories, command capability metadata, role classification, current semantic membership, and ambiguity gates were evaluated read-only.

## Risks / limitations
This design does not prove that Hyper-V Disconnect/Connect preserves a deterministic recovery role on this host. Gate A is mandatory before any revised full isolation rehearsal. Another PC may classify differently or fail closed; that is validation-harness behaviour, not an EOD product compatibility failure.

## Rollback guidance
Read-only design task; no system rollback required.

## Blockers
```json
[]
```

## Next
`CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_FIX3_GATE_A_HYPERV_CONTROL_PLANE_MICRO_REHEARSAL_R1`. No Hyper-V mutation, revised adapter rehearsal, or EOD live validation is authorized by this design.
