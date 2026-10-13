# CA Phase5E4 — FIX4 FIX1 Sandbox Feature Query Authority R1

IST timestamp: 2026-10-02T16:43:38.506141+05:30

## Objective
Correct the parent FIX4 readiness defect that converted a failed `Get-WindowsOptionalFeature` query into a false feature-absence conclusion.

## Authority
- Parent FIX4 package SHA256: `2DBE1BD0D49515223AA2FC777D2FCBE206F6C434E4C1741F769AD5147037767A`
- Parent FIX4 runner SHA256: `9286D454F5DD417DAEC1D1F5BF0FBAD488D09C3FB761D191C5A1F0B30463CC0A`
- Parent FIX4 evidence SHA256: `CF9A2C7DFDBAC26655640DAF1E137EFE42C1192B0B3D245A34783E20665AA454`

## Previous defect / limitation
Parent evidence recorded `Class not registered` while also recording `querySucceeded=true`, `present=false`, so the Hyper-V zero-NIC fallback branch was selected without proving Sandbox absence.

## Final implementation
PowerShell optional-feature query is corroborating only when successful. DISM `/Get-Features` is the primary presence/absence authority; for a present feature DISM `/Get-FeatureInfo` is the primary state authority. PowerShell failure does not imply absence. Successful contradictions, DISM failure, unrecognized state, or pending servicing state fail closed.

Sandbox template remains byte-exact SHA256 `940BEB606DF1EB5A7A4ACFF9EA85546945D890F0D175761CD087442B7246B8EF`.

## Current host corrected readiness
```json
{
  "task": "CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_DESIGN_FIX4_FIX1_SANDBOX_FEATURE_QUERY_AUTHORITY_R1",
  "status": "PASS",
  "selectedArchitecture": "WINDOWS_SANDBOX_NETWORK_DISABLED_SHA_BOUND_STAGED_ACCEPTANCE_R1",
  "hostReadinessClass": "WINDOWS_SANDBOX_FEATURE_AVAILABLE_BUT_DISABLED",
  "readinessReasons": [
    "Windows Sandbox feature state=Disabled"
  ],
  "nextRecommendedTask": "CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_FIX4_WINDOWS_SANDBOX_ENABLEMENT_DESIGN_R1",
  "sandboxFeatureAuthority": {
    "powershell": {
      "commandPresent": true,
      "querySucceeded": false,
      "present": false,
      "state": "",
      "featureName": "Containers-DisposableClientVM",
      "error": "Class not registered\r\n"
    },
    "dism": {
      "exePresent": true,
      "exePath": "C:\\WINDOWS\\System32\\dism.exe",
      "listQuerySucceeded": true,
      "listExitCode": 0,
      "listFeaturePresent": true,
      "listState": "Disabled",
      "listStdout": "\r\nDeployment Image Servicing and Management tool\r\nVersion: 10.0.19041.3636\r\n\r\nImage Version: 10.0.19045.7725\r\n\r\nFeatures listing for package : Microsoft-Windows-Foundation-Package~31bf3856ad364e35~amd64~~10.0.19041.1\r\n\r\n\r\n------------------------------------------- | --------\r\nFeature Name                                | State   \r\n------------------------------------------- | --------\r\nPrinting-PrintToPDFServices-Features        | Enabled \r\nWindows-Defender-Default-Definitions        | Disabled\r\nPrinting-XPSServices-Features               | Enabled \r\nMSRDC-Infrastructure                        | Enabled \r\nTFTP                                        | Disabled\r\nTIFFIFilter                                 | Disabled\r\nLegacyComponents                            | Disabled\r\nDirectPlay                                  | Disabled\r\nSimpleTCP                                   | Disabled\r\nClient-DeviceLockdown                       | Disabled\r\nClient-EmbeddedShellLauncher                | Disabled\r\nClient-EmbeddedBootExp                      | Disabled\r\nClient-EmbeddedLogon                        | Disabled\r\nClient-KeyboardFilter                       | Disabled\r\nClient-UnifiedWriteFilter                   | Disabled\r\nNetFx3                                      | Enabled \r\nIIS-WebServerRole                           | Disabled\r\nIIS-WebServer                               | Disabled\r\nIIS-CommonHttpFeatures                      | Disabled\r\nIIS-HttpErrors                              | Disabled\r\nIIS-HttpRedirect                            | Disabled\r\nIIS-ApplicationDevelopment                  | Disabled\r\nIIS-Security                                | Disabled\r\nIIS-RequestFiltering                        | Disabled\r\nIIS-NetFxExtensibility                      | Disabled\r\nIIS-NetFxExtensibility45                    | Disabled\r\nIIS-HealthAndDiagnostics                    | Disabled\r\nIIS-HttpLogging                             | Disabled\r\nIIS-LoggingLibraries                        | Disabled\r\nIIS-RequestMonitor                          | Disabled\r\nIIS-HttpTracing                             | Disabled\r\nIIS-URLAuthorization                        | Disabled\r\nIIS-IPSecurity                              | Disabled\r\nIIS-Performance                             | Disabled\r\nIIS-HttpCompressionDynamic                  | Disabled\r\nIIS-WebServerManagementTools                | Disabled\r\nIIS-ManagementScriptingTools                | Disabled\r\nIIS-IIS6ManagementCompatibility             | Disabled\r\nIIS-Metabase                                | Disabled\r\nWAS-WindowsActivationService                | Disabled\r\nWAS-ProcessModel                            | Disabled\r\nWAS-NetFxEnvironment                        | Disabled\r\nWAS-ConfigurationAPI                        | Disabled\r\nIIS-HostableWebCore                         | Disabled\r\nIIS-CertProvider                            | Disabled\r\nIIS-WindowsAuthentication                   | Disabled\r\nIIS-DigestAuthentication                    | Disabled\r\nIIS-ClientCertificateMappingAuthentication  | Disabled\r\nIIS-IISCertificateMappingAuthentication     | Disabled\r\nIIS-ODBCLogging                             | Disabled\r\nWCF-HTTP-Activation                         | Disabled\r\nWCF-NonHTTP-Activation                      | Disabled\r\nWCF-Services45                              | Enabled \r\nWCF-HTTP-Activation45                       | Disabled\r\nWCF-TCP-Activation45                        | Disabled\r\nWCF-Pipe-Activation45                       | Disabled\r\nWCF-MSMQ-Activation45                       | Disabled\r\nWCF-TCP-PortSharing45                       | Enabled \r\nIIS-StaticContent                           | Disabled\r\nIIS-DefaultDocument                         | Disabled\r\nIIS-DirectoryBrowsing                       | Disabled\r\nIIS-WebDAV                                  | Disabled\r\nIIS-WebSockets                              | Disabled\r\nIIS-ApplicationInit                         | Disabled\r\nIIS-ASPNET                                  | Disabled\r\nIIS-ASPNET45                                | Disabled\r\nIIS-ASP                                     | Disabled\r\nIIS-CGI                                     | Disabled\r\nIIS-ISAPIExtensions                         | Disabled\r\nIIS-ISAPIFilter                             | Disabled\r\nIIS-ServerSideIncludes                      | Disabled\r\nIIS-CustomLogging                           | Disabled\r\nIIS-BasicAuthentication                     | Disabled\r\nIIS-HttpCompressionStatic                   | Disabled\r\nIIS-ManagementConsole                       | Disabled\r\nIIS-ManagementService                       | Disabled\r\nIIS-WMICompatibility                        | Disabled\r\nIIS-LegacyScripts                           | Disabled\r\nIIS-LegacySnapIn                            | Disabled\r\nIIS-FTPServer                               | Disabled\r\nIIS-FTPSvc                                  | Disabled\r\nIIS-FTPExtensibility                        | Disabled\r\nMSMQ-Container                              | Disabled\r\nMSMQ-DCOMProxy                              | Disabled\r\nMSMQ-Server                                 | Disabled\r\nMSMQ-ADIntegration                          | Disabled\r\nMSMQ-HTTP                                   | Disabled\r\nMSMQ-Multicast                              | Disabled\r\nMSMQ-Triggers                               | Disabled\r\nNetFx4-AdvSrvs                              | Enabled \r\nNetFx4Extended-ASPNET45                     | Disabled\r\nSMB1Protocol-Deprecation                    | Disabled\r\nSmbDirect                                   | Enabled \r\nMediaPlayback                               | Enabled \r\nWindowsMediaPlayer                          | Enabled \r\nInternet-Explorer-Optional-amd64            | Enabled \r\nSearchEngine-Client-Package                 | Enabled \r\nWindows-Identity-Foundation                 | Disabled\r\nDataCenterBridging                          | Disabled\r\nAppServerClient                             | Disabled\r\nTelnetClient                                | Disabled\r\nWorkFolders-Client                          | Enabled \r\nPrinting-Foundation-Features                | Enabled \r\nPrinting-Foundation-InternetPrinting-Client | Enabled \r\nPrinting-Foundation-LPDPrintService         | Disabled\r\nPrinting-Foundation-LPRPortMonitor          | Disabled\r\nMicrosoftWindowsPowerShellV2Root            | Enabled \r\nMicrosoftWindowsPowerShellV2                | Enabled \r\nMicrosoft-Windows-Subsystem-Linux           | Enabled \r\nHypervisorPlatform                          | Disabled\r\nVirtualMachinePlatform                      | Enabled \r\nClient-ProjFS                               | Disabled\r\nContainers-DisposableClientVM               | Disabled\r\nMicrosoft-Hyper-V-All                       | Enabled \r\nMicrosoft-Hyper-V                           | Enabled \r\nMicrosoft-Hyper-V-Tools-All                 | Enabled \r\nMicrosoft-Hyper-V-Management-PowerShell     | Enabled \r\nMicrosoft-Hyper-V-Hypervisor                | Enabled \r\nMicrosoft-Hyper-V-Services                  | Enabled \r\nMicrosoft-Hyper-V-Management-Clients        | Enabled \r\nHostGuardian                                | Disabled\r\nDirectoryServices-ADAM-Client               | Disabled\r\nWindows-Defender-ApplicationGuard           | Enabled \r\nServicesForNFS-ClientOnly                   | Disabled\r\nClientForNFS-Infrastructure                 | Disabled\r\nNFS-Administration                          | Disabled\r\nContainers                                  | Disabled\r\nSMB1Protocol                                | Disabled\r\nSMB1Protocol-Client                         | Disabled\r\nSMB1Protocol-Server                         | Disabled\r\nMultiPoint-Connector                        | Disabled\r\nMultiPoint-Connector-Services               | Disabled\r\nMultiPoint-Tools                            | Disabled\r\n\r\nThe operation completed successfully.\r\n",
      "listStderr": "",
      "infoQueryAttempted": true,
      "infoQuerySucceeded": true,
      "infoExitCode": 0,
      "infoState": "Disabled",
      "infoStdout": "\r\nDeployment Image Servicing and Management tool\r\nVersion: 10.0.19041.3636\r\n\r\nImage Version: 10.0.19045.7725\r\n\r\nFeature Information:\r\n\r\nFeature Name : Containers-DisposableClientVM\r\nDisplay Name : Windows Sandbox\r\nDescription : Enables the dependencies required to run Windows Sandbox scenarios.\r\nRestart Required : Possible\r\nState : Disabled\r\n\r\nCustom Properties:\r\n\r\n(No custom properties found)\r\n\r\nThe operation completed successfully.\r\n",
      "infoStderr": "",
      "error": ""
    }
  },
  "reconciledSandboxFeature": {
    "querySucceeded": true,
    "present": true,
    "state": "Disabled",
    "authority": "DISM_GET_FEATURES_PLUS_GET_FEATURE_INFO",
    "powershellCorroborated": false,
    "powershellQuerySucceeded": false,
    "powershellError": "Class not registered\r\n",
    "dismListQuerySucceeded": true,
    "dismInfoQuerySucceeded": true,
    "diagnostics": [
      "PowerShell optional-feature query failed; DISM remains authority"
    ]
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
Product/source/build/dist/database/network configuration: none. Design/readiness controller/tests/docs only; this change record is the intended persistent project write.

## Behaviour preserved
`WINDOWS_SANDBOX_NETWORK_DISABLED_SHA_BOUND_STAGED_ACCEPTANCE_R1`, Networking=Disable Sandbox template semantics, product-external isolation, exact Phase5E4 network-zero definition, no host-network mutation, and all EOD/DB boundaries remain unchanged.

## Validation / actual results
Exact parent FIX4 package/runner/evidence verified; parent defect located; Sandbox template hash preserved; dual-authority feature reconciliation exercised by focused selftests; runner remains read-only.

## Risks / limitations
This task does not enable or launch Windows Sandbox. A successful DISM result determines only readiness branching; capability rehearsal remains mandatory before EOD/DB use.

## Rollback guidance
Read-only readiness-design correction; no host rollback required. Reverting to parent FIX4 would restore the rejected false-absence defect.

## Blockers
```json
[]
```

## Next
`CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_FIX4_WINDOWS_SANDBOX_ENABLEMENT_DESIGN_R1`
