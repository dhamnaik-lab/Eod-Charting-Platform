# CA Phase5E4 — Gate A FIX1 ManagementOS Supported Primitive Design R1

IST timestamp: 2026-10-02T15:40:03.189350+05:30

## Objective
Correct Gate A after the actual ManagementOS VMInternalNetworkAdapter failed to bind to Disconnect-VMNetworkAdapter. Freeze the documented supported ManagementOS mutation surface and ownership eligibility rules without any mutation.

## Authority
- FIX3 FIX1 package SHA256: `3A9B653E00ED8975B091B6610E9BA2CA8C22CC375E5C8FCD631CEC82E90733BA`
- FIX3 FIX1 runner SHA256: `2C8AB25EE888120D937C7E05B8F35ED8CCA23DEEF2E395505FF91322CAF7263E`
- FIX3 FIX1 evidence SHA256: `672318C60035D0E0D4722C9B1D6381F9E15EB8C9FD56D6C56D87B69A87793BBF`
- Failed Gate A package SHA256: `7A5C46EBE0DB669631F35A78CCD245B8535254803814A96123C1AB8680E2D337`
- Failed Gate A runner SHA256: `392CCEF9383D6FD07B92E98550E485EC1B107334943483E8FAF1635BC8FAEC0C`

## Previous defect / limitation
Gate A R1 assumed Disconnect/Connect-VMNetworkAdapter was a valid one-role primitive for a ManagementOS `VMInternalNetworkAdapter`. The actual `-WhatIf` binding failed before mutation.

## Final design
Candidate supported surface: `REMOVE_AND_RECREATE_MANAGEMENTOS_VNIC_R1__SUPPORTED_SURFACE_ONLY__NOT_YET_AUTHORIZED_FOR_MUTATION`. Remove/Add is not authorized automatically. `Default Switch`, HNS-correlated, and ownership-unresolved ManagementOS roles are ineligible.

## Target-host read-only characterization
```json
{
  "task": "CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_FIX3_GATE_A_FIX1_MANAGEMENTOS_SUPPORTED_PRIMITIVE_DESIGN_R1",
  "status": "PASS",
  "selectedArchitecture": "HOST_ADAPTIVE_ROLE_AWARE_CONTROL_PLANE_NETWORK_ZERO_R1",
  "candidatePrimitive": "REMOVE_AND_RECREATE_MANAGEMENTOS_VNIC_R1__SUPPORTED_SURFACE_ONLY__NOT_YET_AUTHORIZED_FOR_MUTATION",
  "supportedSurface": {
    "getManagementOs": true,
    "removeManagementOs": true,
    "addManagementOs": true,
    "setManagementOs": true,
    "disconnectManagementOsSetPresent": false,
    "connectManagementOsSetPresent": false
  },
  "managementOsRoleCount": 3,
  "roles": [
    {
      "Name": "Container NIC 163416b9",
      "Id": "Microsoft:C08CB7B8-9B3C-408E-8E30-5E16A3AEB444\\C9819460-098D-4A07-A1C3-7C8F1BD84DC1",
      "MacAddress": "00155D3939F2",
      "SwitchId": "c08cb7b8-9b3c-408e-8e30-5e16a3aeb444",
      "SwitchName": "Default Switch",
      "Status": "Ok",
      "IsManagementOs": true,
      "windowsCorrelationCount": 1,
      "windows": {
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
      "switchResolveCount": 1,
      "switch": {
        "Name": "Default Switch",
        "Id": "c08cb7b8-9b3c-408e-8e30-5e16a3aeb444",
        "SwitchType": "Internal",
        "NetAdapterInterfaceDescription": "",
        "NetAdapterInterfaceGuid": "",
        "AllowManagementOS": true,
        "Notes": ""
      },
      "ifIndex": 31,
      "ipAddressCount": 2,
      "routeCount": 8,
      "carriesDefaultRoute": false,
      "containerNicNameSensitivitySignal": true,
      "hnsCorrelation": {
        "available": true,
        "signals": {
          "mac": false,
          "switchId": true,
          "hyperVId": false,
          "windowsGuid": true,
          "windowsName": false,
          "managementName": true
        },
        "correlated": true
      },
      "eligibilityClass": "DEFAULT_SWITCH_MANAGEMENTOS_INELIGIBLE",
      "reason": "system-managed Default Switch excluded from remove/add micro-rehearsal"
    },
    {
      "Name": "Container NIC 95dc04c8",
      "Id": "Microsoft:C08CB7B8-9B3C-408E-8E30-5E16A3AEB444\\2E498A91-9FB2-4396-9070-1A6D7D40DA23",
      "MacAddress": "00155DCA2F33",
      "SwitchId": "c08cb7b8-9b3c-408e-8e30-5e16a3aeb444",
      "SwitchName": "Default Switch",
      "Status": "Ok",
      "IsManagementOs": true,
      "windowsCorrelationCount": 1,
      "windows": {
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
      "switchResolveCount": 1,
      "switch": {
        "Name": "Default Switch",
        "Id": "c08cb7b8-9b3c-408e-8e30-5e16a3aeb444",
        "SwitchType": "Internal",
        "NetAdapterInterfaceDescription": "",
        "NetAdapterInterfaceGuid": "",
        "AllowManagementOS": true,
        "Notes": ""
      },
      "ifIndex": 37,
      "ipAddressCount": 2,
      "routeCount": 8,
      "carriesDefaultRoute": false,
      "containerNicNameSensitivitySignal": true,
      "hnsCorrelation": {
        "available": true,
        "signals": {
          "mac": false,
          "switchId": true,
          "hyperVId": false,
          "windowsGuid": true,
          "windowsName": false,
          "managementName": true
        },
        "correlated": true
      },
      "eligibilityClass": "DEFAULT_SWITCH_MANAGEMENTOS_INELIGIBLE",
      "reason": "system-managed Default Switch excluded from remove/add micro-rehearsal"
    },
    {
      "Name": "Container NIC ba7417a9",
      "Id": "Microsoft:C08CB7B8-9B3C-408E-8E30-5E16A3AEB444\\007AD1C0-9586-4777-BA84-81F5166A9361",
      "MacAddress": "00155D6ED5A8",
      "SwitchId": "c08cb7b8-9b3c-408e-8e30-5e16a3aeb444",
      "SwitchName": "Default Switch",
      "Status": "Ok",
      "IsManagementOs": true,
      "windowsCorrelationCount": 1,
      "windows": {
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
      "switchResolveCount": 1,
      "switch": {
        "Name": "Default Switch",
        "Id": "c08cb7b8-9b3c-408e-8e30-5e16a3aeb444",
        "SwitchType": "Internal",
        "NetAdapterInterfaceDescription": "",
        "NetAdapterInterfaceGuid": "",
        "AllowManagementOS": true,
        "Notes": ""
      },
      "ifIndex": 41,
      "ipAddressCount": 2,
      "routeCount": 8,
      "carriesDefaultRoute": false,
      "containerNicNameSensitivitySignal": true,
      "hnsCorrelation": {
        "available": true,
        "signals": {
          "mac": false,
          "switchId": true,
          "hyperVId": false,
          "windowsGuid": true,
          "windowsName": false,
          "managementName": true
        },
        "correlated": true
      },
      "eligibilityClass": "DEFAULT_SWITCH_MANAGEMENTOS_INELIGIBLE",
      "reason": "system-managed Default Switch excluded from remove/add micro-rehearsal"
    }
  ],
  "eligibleRoleCount": 0,
  "defaultSwitchIneligibleCount": 3,
  "hnsIneligibleCount": 0,
  "ownershipUnresolvedCount": 0,
  "currentHostDefaultSwitchOnly": true,
  "removeAddMutationAuthorized": false,
  "failedDisconnectConnectPrimitiveRemainsRejected": true,
  "conclusion": "SUPPORTED_REMOVE_ADD_SURFACE_CONFIRMED__CURRENT_DEFAULT_SWITCH_MANAGEMENTOS_ROLES_INELIGIBLE_FOR_MUTATION__NO_GATE_A_REMOVE_ADD_AUTHORIZED",
  "blockers": [],
  "boundaries": {
    "windowsNetAdapterMutation": 0,
    "hyperVMutation": 0,
    "vmSwitchMutation": 0,
    "hnsMutation": 0,
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
    "externalNetworkCommand": 0,
    "processTermination": 0
  },
  "nextRecommendedTask": "CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_DESIGN_FIX4_HOST_INDEPENDENT_ISOLATION_ENVIRONMENT_R1"
}
```

## Files changed
Product/source/build/dist/portable/database/network configuration: none. Design package/controller/tests/docs changed; this change record is the only intended project write.

## Behaviour preserved
Strict zero-egress acceptance intent, EOD product portability, fail-closed host adaptation, and the rejection of the failed Disconnect/Connect ManagementOS primitive.

## Validation
Exact FIX3 FIX1 evidence authority, current command parameter sets, Hyper-V/Windows/HNS inventory, role correlation, default-route state, and ownership eligibility were checked read-only.

## Risks / limitations
Remove/Add recreates a ManagementOS vNIC and may alter object ID, Windows InterfaceGuid, MAC, ifIndex, IP/routes, or service-owned state. No remove/add mutation is authorized by this design. HNS correlation is evidence, not a complete ownership oracle; ambiguity remains fail-closed.

## Rollback guidance
Read-only design task; no system rollback required.

## Blockers
```json
[]
```

## Next
`CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_DESIGN_FIX4_HOST_INDEPENDENT_ISOLATION_ENVIRONMENT_R1`
