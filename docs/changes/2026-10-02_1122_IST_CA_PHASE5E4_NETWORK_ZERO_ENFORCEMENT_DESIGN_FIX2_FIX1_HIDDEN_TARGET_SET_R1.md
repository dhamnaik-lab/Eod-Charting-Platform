# CA Phase5E4 — Network Zero Enforcement Design FIX2 FIX1 Hidden Target Set R1

IST timestamp: 2026-10-02T11:22:38.775785+05:30

## Objective
Correct Design FIX2 target discovery so every `Get-NetAdapter -IncludeHidden` adapter with `AdminStatus=Up` is in the future adapter-isolation target set.

## Authority
- Parent Design FIX2 evidence SHA256: `0119BC72A7D70A5D4CF780AA2B20B1BD821D4CC687D8E3855C64738AA2C83B81`
- RESUME2 active-status diagnostic evidence SHA256: `F2F0039D9154B33637B962CFC9F460AB54A84BAB06488F92D01A4BEE72CEA278`
- Parent rehearsal STOP evidence SHA256: `D5F3BA81449B4814C7136A5EB3AD4ACE5C351530071246D9B69E70FDABB3AD73`
- Design FIX1 evidence SHA256: `B8A794FFBA42B5672E22855CA10C3B4D22D199B13007525BEB6102F13F04B675`
- Design controller evidence SHA256: `0B47B8CDD3DD52BAC57FD2CC0887B9A47F5B6233A72CCC11896621BEF955F109`

## Previous defect / limitation
Parent Design FIX2 used the narrower direct `MSFT_NetAdapter` result as target authority: 5 targets, while the same host evidence contained 18 `Get-NetAdapter -IncludeHidden` objects and 14 `AdminStatus=Up` objects. Nine admin-up hidden adapters were omitted.

## Final implementation / design
Target authority is **GET_NETADAPTER_INCLUDEHIDDEN_ADMINSTATUS_UP**. Every authoritative admin-up object is a target; `MSFT_NetAdapter` is secondary evidence only and may not remove a target. Architecture remains `TEMPORARY_MACHINE_WIDE_NETADAPTER_ADMIN_DISABLE_ALL_CURRENTLY_ADMIN_UP_R1`.

## Target-host read-only result
```json
{
  "task": "CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_DESIGN_FIX2_FIX1_HIDDEN_TARGET_SET_R1",
  "selectedArchitecture": "TEMPORARY_MACHINE_WIDE_NETADAPTER_ADMIN_DISABLE_ALL_CURRENTLY_ADMIN_UP_R1",
  "targetDiscoveryAuthority": "GET_NETADAPTER_INCLUDEHIDDEN_ADMINSTATUS_UP",
  "enforcementAuthority": "NETWORK_ADAPTER_ADMINISTRATIVE_STATE_NOT_WINDOWS_FIREWALL_POLICY",
  "allNetAdapterCount": 18,
  "authoritativeAdminUpCount": 14,
  "targetAdapterCount": 14,
  "targetAdapters": [
    {
      "Name": "vEthernet (Ethernet)",
      "InterfaceDescription": "Hyper-V Virtual Ethernet Adapter",
      "InterfaceGuid": "{99C2752A-CC08-45D7-AD7C-66675FAD680B}",
      "InterfaceName": "ethernet_32774",
      "ifIndex": 27,
      "Status": "Up",
      "AdminStatus": "Up",
      "Hidden": false,
      "HardwareInterface": false,
      "MediaType": "802.3",
      "PhysicalMediaType": "Unspecified",
      "MacAddress": "00-15-5D-20-86-29",
      "LinkSpeed": "10 Gbps"
    },
    {
      "Name": "vEthernet (Wi-Fi)",
      "InterfaceDescription": "Hyper-V Virtual Ethernet Adapter #2",
      "InterfaceGuid": "{95C61755-A0A4-4CFA-ACFA-B52985E9F601}",
      "InterfaceName": "ethernet_32775",
      "ifIndex": 37,
      "Status": "Up",
      "AdminStatus": "Up",
      "Hidden": false,
      "HardwareInterface": false,
      "MediaType": "802.3",
      "PhysicalMediaType": "Unspecified",
      "MacAddress": "00-15-5D-42-C2-40",
      "LinkSpeed": "10 Gbps"
    },
    {
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
      "LinkSpeed": "10 Gbps"
    },
    {
      "Name": "vSwitch (Default Switch)",
      "InterfaceDescription": "Hyper-V Virtual Switch Extension Adapter",
      "InterfaceGuid": "{41A1AE67-4DAA-4B41-A395-426845FF25A2}",
      "InterfaceName": "ethernet_32773",
      "ifIndex": 19,
      "Status": "Up",
      "AdminStatus": "Up",
      "Hidden": true,
      "HardwareInterface": false,
      "MediaType": "802.3",
      "PhysicalMediaType": "Unspecified",
      "MacAddress": "",
      "LinkSpeed": "10 Gbps"
    },
    {
      "Name": "Ethernet",
      "InterfaceDescription": "Intel(R) Ethernet Connection (2) I219-LM",
      "InterfaceGuid": "{A51A08EF-67BE-4C6E-B9F6-6CAF11567555}",
      "InterfaceName": "ethernet_32769",
      "ifIndex": 14,
      "Status": "Disconnected",
      "AdminStatus": "Up",
      "Hidden": false,
      "HardwareInterface": true,
      "MediaType": "802.3",
      "PhysicalMediaType": "802.3",
      "MacAddress": "F4-8E-38-AB-92-BC",
      "LinkSpeed": "0 bps"
    },
    {
      "Name": "Wi-Fi",
      "InterfaceDescription": "Realtek RTL8191SU Wireless LAN 802.11n USB 2.0 Network Adapter",
      "InterfaceGuid": "{B9828310-BB01-4549-A726-F2CF45386A3A}",
      "InterfaceName": "wireless_32768",
      "ifIndex": 16,
      "Status": "Up",
      "AdminStatus": "Up",
      "Hidden": false,
      "HardwareInterface": true,
      "MediaType": "Native 802.11",
      "PhysicalMediaType": "Native 802.11",
      "MacAddress": "00-1E-A6-11-E8-A3",
      "LinkSpeed": "144.5 Mbps"
    },
    {
      "Name": "Local Area Connection* 2",
      "InterfaceDescription": "WAN Miniport (IKEv2)",
      "InterfaceGuid": "{31620748-C8C8-4620-A16D-E6EF920BC425}",
      "InterfaceName": "tunnel_32769",
      "ifIndex": 6,
      "Status": "Disconnected",
      "AdminStatus": "Up",
      "Hidden": true,
      "HardwareInterface": false,
      "MediaType": "Connection Oriented WAN",
      "PhysicalMediaType": "Unspecified",
      "MacAddress": "",
      "LinkSpeed": "0 bps"
    },
    {
      "Name": "Local Area Connection* 6",
      "InterfaceDescription": "WAN Miniport (IP)",
      "InterfaceGuid": "{15936727-2AA6-4701-BACE-4A885BE75A33}",
      "InterfaceName": "ethernet_32770",
      "ifIndex": 3,
      "Status": "Up",
      "AdminStatus": "Up",
      "Hidden": true,
      "HardwareInterface": false,
      "MediaType": "802.3",
      "PhysicalMediaType": "Unspecified",
      "MacAddress": "",
      "LinkSpeed": "0 bps"
    },
    {
      "Name": "Local Area Connection* 7",
      "InterfaceDescription": "WAN Miniport (IPv6)",
      "InterfaceGuid": "{7CE909BC-34E0-450F-938F-3CCDE20FC7B6}",
      "InterfaceName": "ethernet_32771",
      "ifIndex": 11,
      "Status": "Up",
      "AdminStatus": "Up",
      "Hidden": true,
      "HardwareInterface": false,
      "MediaType": "802.3",
      "PhysicalMediaType": "Unspecified",
      "MacAddress": "",
      "LinkSpeed": "0 bps"
    },
    {
      "Name": "Local Area Connection* 3",
      "InterfaceDescription": "WAN Miniport (L2TP)",
      "InterfaceGuid": "{91F1522C-556C-4722-8F39-6AE2A7E1F2DF}",
      "InterfaceName": "tunnel_32770",
      "ifIndex": 12,
      "Status": "Disconnected",
      "AdminStatus": "Up",
      "Hidden": true,
      "HardwareInterface": false,
      "MediaType": "Connection Oriented WAN",
      "PhysicalMediaType": "Unspecified",
      "MacAddress": "",
      "LinkSpeed": "0 bps"
    },
    {
      "Name": "Local Area Connection* 8",
      "InterfaceDescription": "WAN Miniport (Network Monitor)",
      "InterfaceGuid": "{2B14AB46-BBB8-457E-B6F4-166B3C7B6A35}",
      "InterfaceName": "ethernet_32772",
      "ifIndex": 4,
      "Status": "Up",
      "AdminStatus": "Up",
      "Hidden": true,
      "HardwareInterface": false,
      "MediaType": "802.3",
      "PhysicalMediaType": "Unspecified",
      "MacAddress": "",
      "LinkSpeed": "0 bps"
    },
    {
      "Name": "Local Area Connection* 5",
      "InterfaceDescription": "WAN Miniport (PPPOE)",
      "InterfaceGuid": "{CC8D9A1E-8FE9-49E7-9EDC-543D61A64F6E}",
      "InterfaceName": "ppp_32768",
      "ifIndex": 18,
      "Status": "Disconnected",
      "AdminStatus": "Up",
      "Hidden": true,
      "HardwareInterface": false,
      "MediaType": "Connection Oriented WAN",
      "PhysicalMediaType": "Unspecified",
      "MacAddress": "",
      "LinkSpeed": "0 bps"
    },
    {
      "Name": "Local Area Connection* 4",
      "InterfaceDescription": "WAN Miniport (PPTP)",
      "InterfaceGuid": "{CAA39361-81B8-4029-9258-A25D96AABA51}",
      "InterfaceName": "tunnel_32771",
      "ifIndex": 17,
      "Status": "Disconnected",
      "AdminStatus": "Up",
      "Hidden": true,
      "HardwareInterface": false,
      "MediaType": "Connection Oriented WAN",
      "PhysicalMediaType": "Unspecified",
      "MacAddress": "",
      "LinkSpeed": "0 bps"
    },
    {
      "Name": "Local Area Connection* 1",
      "InterfaceDescription": "WAN Miniport (SSTP)",
      "InterfaceGuid": "{63E122A4-B18E-4FB3-9A40-FB21D662064E}",
      "InterfaceName": "tunnel_32768",
      "ifIndex": 10,
      "Status": "Disconnected",
      "AdminStatus": "Up",
      "Hidden": true,
      "HardwareInterface": false,
      "MediaType": "Connection Oriented WAN",
      "PhysicalMediaType": "Unspecified",
      "MacAddress": "",
      "LinkSpeed": "0 bps"
    }
  ],
  "hiddenTargetCount": 9,
  "visibleTargetCount": 5,
  "virtualTargetCount": 12,
  "physicalTargetCount": 2,
  "omittedAdminUpCount": 0,
  "extraTargetCount": 0,
  "uniqueNonEmptyTargetGuidCount": 14,
  "secondaryMsftNetAdapterCount": 5,
  "secondaryMsftNetAdapterTargetMatches": 5,
  "targetsWithoutSecondaryMsftNetAdapterMatch": 9,
  "loopbackIPv4Count": 1,
  "loopbackIPv6Count": 1,
  "loopbackInterfaceIndices": [
    1
  ],
  "commands": {
    "Get-NetAdapter": true,
    "Disable-NetAdapter": true,
    "Enable-NetAdapter": true,
    "Get-NetIPInterface": true,
    "Get-NetIPAddress": true,
    "Get-NetRoute": true,
    "Get-CimInstance": true,
    "Get-NetFirewallProfile": true
  },
  "hostOs": {
    "caption": "Microsoft Windows 10 Pro",
    "version": "10.0.19045",
    "buildNumber": "19045",
    "osArchitecture": "64-bit",
    "computerName": "DESKTOP-R4E4TIE",
    "manufacturer": "Dell Inc.",
    "model": "OptiPlex 7040"
  },
  "targetSetComplete": true,
  "feasibleForAdapterRehearsalCandidate": true,
  "blockers": [],
  "nextRecommendedTask": "CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_ADAPTER_REHEARSAL_R1"
}
```

## Files changed
Product/source/build/dist/portable/database/firewall/audit/adapter state: none. This design change record is the only intended persistent project write.

## Behaviour preserved
Strict network=0, loopback-only allowance, RESUME5 functional/database evidence, and rejection of Windows Firewall policy as enforcement authority remain unchanged. No EOD runtime or Load & Prepare cycle was executed.

## Validation / actual results
Exact authority ZIPs, parent defect counts, package manifest, full visible+hidden adapter inventory, admin-up target completeness, unique InterfaceGuid identity, loopback separation, and required future cmdlet presence were validated by the controller.

## Risks / limitations
This design proves complete target discovery only. It does not prove that all hidden/WAN/virtual targets can be disabled and restored safely; that is the purpose of the separately approved adapter-only rehearsal.

## Rollback guidance
Read-only design change; no system rollback required.

## Blockers
```json
[]
```

## Next
`CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_ADAPTER_REHEARSAL_R1`. No adapter rehearsal or live Phase5E4 cycle is authorized by this design run.
