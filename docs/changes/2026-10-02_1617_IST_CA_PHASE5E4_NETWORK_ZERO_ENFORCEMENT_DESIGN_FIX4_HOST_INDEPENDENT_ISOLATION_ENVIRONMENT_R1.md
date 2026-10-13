# CA Phase5E4 — Network Zero Enforcement Design FIX4 Host-Independent Isolation Environment R1

IST timestamp: 2026-10-02T16:17:42.520125+05:30

## Objective
Replace host-network mutation with a Windows Sandbox based external acceptance environment.

## Authority
- Gate A FIX1 package SHA256: `934C32C238B08219316F3D119FBC56A443DCB4E18CF62E6FD5E8DB30351BB846`
- Gate A FIX1 runner SHA256: `4E1FAE5C1F91CD596E211CCF5D639B8244C4376C3BBB3C65AEF662F577D5FF6F`
- Gate A FIX1 evidence SHA256: `93D3397975E50C9ACCDD08652009ED6E5B0A0CD5A80E8E14E9612A3468CD12D1`

## Previous limitation
Host firewall, host-wide adapter disable, ManagementOS Disconnect/Connect and Default-Switch Remove/Add paths were rejected or ineligible. The remaining Phase5E4 blocker is strict network-zero proof, not Corporate Actions product logic.

## Final design
Primary: `WINDOWS_SANDBOX_NETWORK_DISABLED_SHA_BOUND_STAGED_ACCEPTANCE_R1`. Windows Sandbox custom configuration disables networking. Input is a SHA-bound run-owned read-only mapping copied to Sandbox-local storage. Only one dedicated initially-empty evidence/output folder may be writable. EOD product code remains unchanged.

Sandbox template SHA256: `940BEB606DF1EB5A7A4ACFF9EA85546945D890F0D175761CD087442B7246B8EF`

## Current host readiness
```json
{
  "task": "CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_DESIGN_FIX4_HOST_INDEPENDENT_ISOLATION_ENVIRONMENT_R1",
  "status": "PASS",
  "selectedArchitecture": "WINDOWS_SANDBOX_NETWORK_DISABLED_SHA_BOUND_STAGED_ACCEPTANCE_R1",
  "hostReadinessClass": "WINDOWS_SANDBOX_UNAVAILABLE__HYPERV_ZERO_NIC_FALLBACK_DESIGN_REQUIRED",
  "readinessReasons": [
    "Containers-DisposableClientVM feature is not present on this host"
  ],
  "nextRecommendedTask": "CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_FIX4_DEDICATED_HYPERV_ZERO_NIC_FALLBACK_DESIGN_R1",
  "sandboxFeature": {
    "querySucceeded": true,
    "present": false,
    "state": "NotPresentOrUnavailable",
    "featureName": "Containers-DisposableClientVM",
    "error": "Class not registered\r\n"
  },
  "os": {
    "ProductName": "Windows 10 Pro",
    "EditionID": "Professional",
    "DisplayVersion": "22H2",
    "CurrentBuildNumber": "19045",
    "UBR": 7725,
    "InstallationType": "Client"
  },
  "binaries": {
    "windowsSandboxExePresent": false,
    "windowsSandboxExePath": "",
    "wsbCliPresent": false,
    "wsbCliPath": "",
    "sandboxAppxPresent": false,
    "sandboxAppx": [],
    "wsbFileAssociationPresent": false,
    "wsbProgId": "",
    "wsbOpenCommand": ""
  },
  "sandboxPolicies": {
    "AllowNetworking": {
      "present": false,
      "value": null
    },
    "AllowMappedFolders": {
      "present": false,
      "value": null
    },
    "AllowWriteToMappedFolders": {
      "present": false,
      "value": null
    },
    "AllowClipboardRedirection": {
      "present": false,
      "value": null
    },
    "AllowAudioInput": {
      "present": false,
      "value": null
    },
    "AllowVideoInput": {
      "present": false,
      "value": null
    },
    "AllowPrinterRedirection": {
      "present": false,
      "value": null
    },
    "AllowVGPU": {
      "present": false,
      "value": null
    }
  },
  "policyAllowsMappedFolders": true,
  "policyAllowsWriteToMappedFolders": true,
  "launchSurfacePresent": false,
  "sandboxLaunchAuthorized": false,
  "windowsOptionalFeatureMutationAuthorized": false,
  "hyperVFallbackAuthorized": false,
  "eodLaunchAuthorized": false,
  "databaseAccessAuthorized": false,
  "hostNetworkMutationAuthorized": false,
  "finalPhase5E4AcceptanceAchieved": false,
  "capabilityRehearsalRequiredBeforeEod": true,
  "templateSha256": "940BEB606DF1EB5A7A4ACFF9EA85546945D890F0D175761CD087442B7246B8EF",
  "boundaries": {
    "sandboxLaunch": 0,
    "windowsOptionalFeatureMutation": 0,
    "hyperVMutation": 0,
    "hnsMutation": 0,
    "windowsNetAdapterMutation": 0,
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
  "blockers": []
}
```

## Files changed
Product/source/build/dist/database/network configuration: none. Design/evidence/docs only; this change record is the intended persistent project write.

## Behaviour preserved
Existing Phase5E4 functional evidence, strict external-egress definition, EOD product behaviour, host network state and rejected host-mutation boundaries remain unchanged.

## Validation / actual results
Exact Gate A FIX1 authority verified; Sandbox template parsed and security-relevant values checked; Windows edition/build, Sandbox optional-feature state, launch surfaces and Sandbox policy gates characterized read-only.

## Risks / limitations
This design does not launch Sandbox, EOD or a database. Windows Sandbox capability, mapped-folder round-trip, guest network state and exact EOD/WebView2 runtime compatibility remain untested until the next bounded rehearsal. Final acceptance also requires independently verified exact accepted runtime and PRE database snapshot authorities.

## Rollback guidance
Read-only design task; no host rollback required. Remove this design package/change record if rejected.

## Blockers
```json
[]
```

## Next
`CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_FIX4_DEDICATED_HYPERV_ZERO_NIC_FALLBACK_DESIGN_R1`
