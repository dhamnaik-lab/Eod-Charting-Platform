# CA Phase5E4 — FIX4 Dedicated Hyper-V Zero-NIC Fallback Design R1

IST timestamp: 2026-10-02T19:52:28.841221+05:30

## Objective
Freeze the dedicated Hyper-V zero-network-adapter fallback architecture and current host control-plane readiness without creating/mutating any VM, VHDX, switch, host adapter or product/database state.

## Exact authority
- FIX4 package `2DBE1BD0D49515223AA2FC777D2FCBE206F6C434E4C1741F769AD5147037767A`
- FIX4 runner `9286D454F5DD417DAEC1D1F5BF0FBAD488D09C3FB761D191C5A1F0B30463CC0A`
- FIX4 FIX1 package `204FBC59DDC478489BED73A05661CFF157341F5E6CBD7E78309FE2C1DDC1A995`
- FIX4 FIX1 runner `4DA3E41162008836EA23660E15752170C00C2B0AFA6A96F1B0323021A0082076`
- FIX4 FIX1 evidence `14102163D70BE8D0E7610B8075F721F3DEFA632151E89C25F10EB4198D4BE229`

## Final result
```json
{
  "task": "CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_FIX4_DEDICATED_HYPERV_ZERO_NIC_FALLBACK_DESIGN_R1",
  "status": "PASS",
  "selectedFallbackArchitecture": "DEDICATED_HYPERV_VM_ZERO_NETWORK_ADAPTER_POWERSHELL_DIRECT_SHA_BOUND_STAGED_ACCEPTANCE_R1",
  "primaryArchitecture": "WINDOWS_SANDBOX_NETWORK_DISABLED_SHA_BOUND_STAGED_ACCEPTANCE_R1",
  "primaryCurrentReadiness": "WINDOWS_SANDBOX_FEATURE_AVAILABLE_BUT_DISABLED",
  "fallbackDoesNotReplacePrimary": true,
  "hostReadinessClass": "HYPERV_ZERO_NIC_HOST_CONTROL_PLANE_READY__GUEST_IMAGE_AUTHORITY_REQUIRED",
  "hyperVHostQuerySucceeded": true,
  "hyperVHost": {
    "ComputerName": "DESKTOP-R4E4TIE",
    "VirtualHardDiskPath": "C:\\ProgramData\\Microsoft\\Windows\\Virtual Hard Disks",
    "VirtualMachinePath": "C:\\ProgramData\\Microsoft\\Windows\\Hyper-V",
    "EnableEnhancedSessionMode": true,
    "LogicalProcessorCount": 8,
    "MemoryCapacity": 12805091328,
    "SupportedVmVersions": [
      "8.0",
      "8.1",
      "8.2",
      "8.3",
      "9.0",
      "9.1",
      "9.2"
    ]
  },
  "requiredHyperVCommandsPresent": true,
  "requiredHyperVParameterSurfacesPresent": true,
  "powerShellDirectReady": true,
  "existingVmCount": 0,
  "existingSwitchCount": 1,
  "existingVmNetworkAdapterCount": 3,
  "existingTopologyCountsAreDiagnosticOnly": true,
  "guestImageAuthorityAvailable": false,
  "guestImageAuthorityStatus": "NOT_PROVEN_BY_THIS_DESIGN_TASK",
  "vmCreationAuthorized": false,
  "vhdCreationAuthorized": false,
  "vmNetworkAdapterMutationAuthorized": false,
  "vmSwitchMutationAuthorized": false,
  "eodLaunchAuthorized": false,
  "databaseAccessAuthorized": false,
  "finalPhase5E4AcceptanceAchieved": false,
  "blockers": [],
  "boundaries": {
    "vmCreate": 0,
    "vmRemove": 0,
    "vmStart": 0,
    "vmStop": 0,
    "vhdCreate": 0,
    "vhdMount": 0,
    "vmNetworkAdapterMutation": 0,
    "vmSwitchMutation": 0,
    "hyperVManagementOsMutation": 0,
    "hnsMutation": 0,
    "windowsNetAdapterMutation": 0,
    "firewallMutation": 0,
    "auditPolicyMutation": 0,
    "sandboxLaunch": 0,
    "windowsOptionalFeatureMutation": 0,
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
  "nextRecommendedTask": "CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_FIX4_HYPERV_ZERO_NIC_GUEST_IMAGE_AUTHORITY_PREFLIGHT_R1"
}
```

## Files changed
Product/source/build/dist/database/Hyper-V configuration: none. This design/change record is the only intended persistent project write.

## Final implementation
Design only: run-owned Generation-2 VM; all auto-created VM network adapters removed before first boot; exact zero VMNetworkAdapter objects throughout acceptance; no VMSwitch attachment; PowerShell Direct over VMbus for guest control/input/output; hash-bound immutable Windows base VHDX plus per-run differencing disk.

## Behaviour preserved
Primary Windows Sandbox branch remains valid and disabled-feature readiness is retained. EOD runtime/product behavior is unchanged. Host Wi-Fi/Ethernet/Default Switch/HNS/ManagementOS/firewall/existing VM topology are untouched.

## Validation results
Authority manifests/hashes verified; design package selftests completed before delivery; current host command/parameter capability analyzed read-only. No VM/VHD/EOD/DB action executed.

## Risks / limitations
An appropriate Windows guest base VHDX authority is not proven by this task. Final acceptance cannot proceed on this fallback until guest-image authority and a zero-NIC capability rehearsal pass. The fallback may take longer than enabling the already-present Windows Sandbox feature.

## Rollback
Read-only design task; no system rollback required. Future mutation rollback is run-owned VM/differencing-VHD deletion only, after evidence preservation.

## Blockers
```json
[]
```

## Next
`CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_FIX4_HYPERV_ZERO_NIC_GUEST_IMAGE_AUTHORITY_PREFLIGHT_R1`
