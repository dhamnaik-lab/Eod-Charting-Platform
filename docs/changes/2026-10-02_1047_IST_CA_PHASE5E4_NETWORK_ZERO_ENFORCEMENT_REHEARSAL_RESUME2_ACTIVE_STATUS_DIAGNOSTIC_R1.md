# CA Phase5E4 — Network Zero Enforcement Rehearsal RESUME2 Active Status Diagnostic R1

IST timestamp: 2026-10-02T10:47:14.062112+05:30

## Objective
Diagnose why the parent rehearsal's exact ActiveStore rules reported `PrimaryStatus=Inactive` by capturing the complete ActiveStore status/enforcement fields while preserving the same firewall-only architecture and exact cleanup.

## Authority
- Design controller evidence SHA256: `0B47B8CDD3DD52BAC57FD2CC0887B9A47F5B6233A72CCC11896621BEF955F109`
- Design FIX1 evidence SHA256: `B8A794FFBA42B5672E22855CA10C3B4D22D199B13007525BEB6102F13F04B675`
- Parent rehearsal STOP evidence SHA256: `D5F3BA81449B4814C7136A5EB3AD4ACE5C351530071246D9B69E70FDABB3AD73`
- Parent rehearsal package SHA256: `CEDCA118003DD87428BA95FE3DA73819A8E00D0AE003EB0FA75737BF53AA8894`

## Files changed
Product/source/build/dist/portable/database: 0. Temporary firewall/audit-policy mutations were run-owned and restored. This change record is the only intended persistent project write.

## Actual result
```json
{
  "task": "CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_REHEARSAL_RESUME2_ACTIVE_STATUS_DIAGNOSTIC_R1",
  "architecture": "TEMPORARY_MACHINE_WIDE_EXPLICIT_OUTBOUND_BLOCK_ALL_NON_LOOPBACK_R1",
  "classification": "ACTIVE_ENFORCEMENT_NOT_FULL__EXPLANATION_CAPTURED",
  "activationDiagnostic": {
    "status": "ACTIVE_STATUS_DIAGNOSTIC_CAPTURED",
    "capturedAt": "2026-10-02T10:46:46.4107676+05:30",
    "persistentRulesExact": true,
    "activeRulesExact": true,
    "allowBypassCountAfterActivation": 0,
    "ruleV4": {
      "persistent": {
        "store": "PersistentStore",
        "name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
        "exists": true,
        "count": 1,
        "rule": {
          "Name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
          "DisplayName": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
          "Description": "CA_PHASE5E4_NETWORK_ZERO_REHEARSAL_RESUME2_dfc86b77",
          "Enabled": "True",
          "Profile": "Any",
          "Direction": "Outbound",
          "Action": "Block"
        },
        "diagnostics": {
          "PrimaryStatus": "OK",
          "PrimaryStatusRaw": [
            1
          ],
          "Status": "The rule was parsed successfully from the store. (65536)",
          "StatusCode": 65536,
          "EnforcementStatus": [
            "NotApplicable"
          ],
          "EnforcementStatusRaw": [
            null
          ],
          "PolicyStoreSource": "PersistentStore",
          "PolicyStoreSourceType": "Local",
          "Enabled": "True",
          "Profile": "Any",
          "Direction": "Outbound",
          "Action": "Block",
          "InstanceID": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
          "PolicyRuleName": "",
          "CimClassName": "MSFT_NetFirewallRule"
        },
        "trace": [],
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
        "name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
        "exists": true,
        "count": 1,
        "rule": {
          "Name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
          "DisplayName": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
          "Description": "CA_PHASE5E4_NETWORK_ZERO_REHEARSAL_RESUME2_dfc86b77",
          "Enabled": "True",
          "Profile": "Any",
          "Direction": "Outbound",
          "Action": "Block"
        },
        "diagnostics": {
          "PrimaryStatus": "Inactive",
          "PrimaryStatusRaw": [
            2
          ],
          "Status": "The rule was parsed successfully from the store. (65536)",
          "StatusCode": 65536,
          "EnforcementStatus": [
            "CategoryDisabled"
          ],
          "EnforcementStatusRaw": [
            null
          ],
          "PolicyStoreSource": "PersistentStore",
          "PolicyStoreSourceType": "Local",
          "Enabled": "True",
          "Profile": "Any",
          "Direction": "Outbound",
          "Action": "Block",
          "InstanceID": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
          "PolicyRuleName": "",
          "CimClassName": "MSFT_NetFirewallRule"
        },
        "trace": [
          {
            "Name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
            "PolicyStoreSource": "PersistentStore",
            "PolicyStoreSourceType": "Local",
            "PrimaryStatus": "Inactive",
            "Status": "The rule was parsed successfully from the store. (65536)",
            "StatusCode": 65536,
            "EnforcementStatus": [
              "CategoryDisabled"
            ],
            "EnforcementStatusRaw": [
              null
            ]
          }
        ],
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
        "name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
        "exists": true,
        "count": 1,
        "rule": {
          "Name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
          "DisplayName": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
          "Description": "CA_PHASE5E4_NETWORK_ZERO_REHEARSAL_RESUME2_dfc86b77",
          "Enabled": "True",
          "Profile": "Any",
          "Direction": "Outbound",
          "Action": "Block"
        },
        "diagnostics": {
          "PrimaryStatus": "OK",
          "PrimaryStatusRaw": [
            1
          ],
          "Status": "The rule was parsed successfully from the store. (65536)",
          "StatusCode": 65536,
          "EnforcementStatus": [
            "NotApplicable"
          ],
          "EnforcementStatusRaw": [
            null
          ],
          "PolicyStoreSource": "PersistentStore",
          "PolicyStoreSourceType": "Local",
          "Enabled": "True",
          "Profile": "Any",
          "Direction": "Outbound",
          "Action": "Block",
          "InstanceID": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
          "PolicyRuleName": "",
          "CimClassName": "MSFT_NetFirewallRule"
        },
        "trace": [],
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
        "name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
        "exists": true,
        "count": 1,
        "rule": {
          "Name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
          "DisplayName": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
          "Description": "CA_PHASE5E4_NETWORK_ZERO_REHEARSAL_RESUME2_dfc86b77",
          "Enabled": "True",
          "Profile": "Any",
          "Direction": "Outbound",
          "Action": "Block"
        },
        "diagnostics": {
          "PrimaryStatus": "Inactive",
          "PrimaryStatusRaw": [
            2
          ],
          "Status": "The rule was parsed successfully from the store. (65536)",
          "StatusCode": 65536,
          "EnforcementStatus": [
            "CategoryDisabled"
          ],
          "EnforcementStatusRaw": [
            null
          ],
          "PolicyStoreSource": "PersistentStore",
          "PolicyStoreSourceType": "Local",
          "Enabled": "True",
          "Profile": "Any",
          "Direction": "Outbound",
          "Action": "Block",
          "InstanceID": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
          "PolicyRuleName": "",
          "CimClassName": "MSFT_NetFirewallRule"
        },
        "trace": [
          {
            "Name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
            "PolicyStoreSource": "PersistentStore",
            "PolicyStoreSourceType": "Local",
            "PrimaryStatus": "Inactive",
            "Status": "The rule was parsed successfully from the store. (65536)",
            "StatusCode": 65536,
            "EnforcementStatus": [
              "CategoryDisabled"
            ],
            "EnforcementStatusRaw": [
              null
            ]
          }
        ],
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
    },
    "activeProfiles": [
      {
        "Name": "Domain",
        "Enabled": "True",
        "DefaultInboundAction": "Block",
        "DefaultOutboundAction": "Allow",
        "AllowInboundRules": "True",
        "AllowLocalFirewallRules": "True",
        "DisabledInterfaceAliases": ""
      },
      {
        "Name": "Private",
        "Enabled": "True",
        "DefaultInboundAction": "Block",
        "DefaultOutboundAction": "Allow",
        "AllowInboundRules": "True",
        "AllowLocalFirewallRules": "True",
        "DisabledInterfaceAliases": ""
      },
      {
        "Name": "Public",
        "Enabled": "True",
        "DefaultInboundAction": "Block",
        "DefaultOutboundAction": "Allow",
        "AllowInboundRules": "True",
        "AllowLocalFirewallRules": "True",
        "DisabledInterfaceAliases": ""
      }
    ],
    "networkMetadata": {
      "connectionProfiles": [
        {
          "Name": "Airtel_dhar_8398",
          "InterfaceAlias": "Wi-Fi",
          "InterfaceIndex": 16,
          "NetworkCategory": 1,
          "IPv4Connectivity": 4,
          "IPv6Connectivity": 4
        }
      ],
      "adapters": [
        {
          "Name": "Ethernet",
          "InterfaceDescription": "Intel(R) Ethernet Connection (2) I219-LM",
          "ifIndex": 14,
          "Status": "Disconnected",
          "MacAddress": "F4-8E-38-AB-92-BC",
          "LinkSpeed": "0 bps"
        },
        {
          "Name": "Wi-Fi",
          "InterfaceDescription": "Realtek RTL8191SU Wireless LAN 802.11n USB 2.0 Network Adapter",
          "ifIndex": 16,
          "Status": "Up",
          "MacAddress": "00-1E-A6-11-E8-A3",
          "LinkSpeed": "144.5 Mbps"
        },
        {
          "Name": "vEthernet (Ethernet)",
          "InterfaceDescription": "Hyper-V Virtual Ethernet Adapter",
          "ifIndex": 27,
          "Status": "Up",
          "MacAddress": "00-15-5D-20-86-29",
          "LinkSpeed": "10 Gbps"
        },
        {
          "Name": "vEthernet (Wi-Fi)",
          "InterfaceDescription": "Hyper-V Virtual Ethernet Adapter #2",
          "ifIndex": 37,
          "Status": "Up",
          "MacAddress": "00-15-5D-42-C2-40",
          "LinkSpeed": "10 Gbps"
        },
        {
          "Name": "vEthernet (Default Switch)",
          "InterfaceDescription": "Hyper-V Virtual Ethernet Adapter #3",
          "ifIndex": 41,
          "Status": "Up",
          "MacAddress": "00-15-5D-6E-D5-A8",
          "LinkSpeed": "10 Gbps"
        }
      ]
    }
  },
  "holdDiagnostics": {
    "checks": [
      {
        "index": 1,
        "capturedAt": "2026-10-02T10:46:51.1778419+05:30",
        "rulesExact": true,
        "allowBypassCount": 0,
        "v4": {
          "store": "ActiveStore",
          "name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
          "exists": true,
          "count": 1,
          "rule": {
            "Name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
            "DisplayName": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
            "Description": "CA_PHASE5E4_NETWORK_ZERO_REHEARSAL_RESUME2_dfc86b77",
            "Enabled": "True",
            "Profile": "Any",
            "Direction": "Outbound",
            "Action": "Block"
          },
          "diagnostics": {
            "PrimaryStatus": "Inactive",
            "PrimaryStatusRaw": [
              2
            ],
            "Status": "The rule was parsed successfully from the store. (65536)",
            "StatusCode": 65536,
            "EnforcementStatus": [
              "CategoryDisabled"
            ],
            "EnforcementStatusRaw": [
              null
            ],
            "PolicyStoreSource": "PersistentStore",
            "PolicyStoreSourceType": "Local",
            "Enabled": "True",
            "Profile": "Any",
            "Direction": "Outbound",
            "Action": "Block",
            "InstanceID": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
            "PolicyRuleName": "",
            "CimClassName": "MSFT_NetFirewallRule"
          },
          "trace": [
            {
              "Name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
              "PolicyStoreSource": "PersistentStore",
              "PolicyStoreSourceType": "Local",
              "PrimaryStatus": "Inactive",
              "Status": "The rule was parsed successfully from the store. (65536)",
              "StatusCode": 65536,
              "EnforcementStatus": [
                "CategoryDisabled"
              ],
              "EnforcementStatusRaw": [
                null
              ]
            }
          ],
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
        "v6": {
          "store": "ActiveStore",
          "name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
          "exists": true,
          "count": 1,
          "rule": {
            "Name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
            "DisplayName": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
            "Description": "CA_PHASE5E4_NETWORK_ZERO_REHEARSAL_RESUME2_dfc86b77",
            "Enabled": "True",
            "Profile": "Any",
            "Direction": "Outbound",
            "Action": "Block"
          },
          "diagnostics": {
            "PrimaryStatus": "Inactive",
            "PrimaryStatusRaw": [
              2
            ],
            "Status": "The rule was parsed successfully from the store. (65536)",
            "StatusCode": 65536,
            "EnforcementStatus": [
              "CategoryDisabled"
            ],
            "EnforcementStatusRaw": [
              null
            ],
            "PolicyStoreSource": "PersistentStore",
            "PolicyStoreSourceType": "Local",
            "Enabled": "True",
            "Profile": "Any",
            "Direction": "Outbound",
            "Action": "Block",
            "InstanceID": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
            "PolicyRuleName": "",
            "CimClassName": "MSFT_NetFirewallRule"
          },
          "trace": [
            {
              "Name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
              "PolicyStoreSource": "PersistentStore",
              "PolicyStoreSourceType": "Local",
              "PrimaryStatus": "Inactive",
              "Status": "The rule was parsed successfully from the store. (65536)",
              "StatusCode": 65536,
              "EnforcementStatus": [
                "CategoryDisabled"
              ],
              "EnforcementStatusRaw": [
                null
              ]
            }
          ],
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
        "activeProfiles": [
          {
            "Name": "Domain",
            "Enabled": "True",
            "DefaultInboundAction": "Block",
            "DefaultOutboundAction": "Allow",
            "AllowInboundRules": "True",
            "AllowLocalFirewallRules": "True",
            "DisabledInterfaceAliases": ""
          },
          {
            "Name": "Private",
            "Enabled": "True",
            "DefaultInboundAction": "Block",
            "DefaultOutboundAction": "Allow",
            "AllowInboundRules": "True",
            "AllowLocalFirewallRules": "True",
            "DisabledInterfaceAliases": ""
          },
          {
            "Name": "Public",
            "Enabled": "True",
            "DefaultInboundAction": "Block",
            "DefaultOutboundAction": "Allow",
            "AllowInboundRules": "True",
            "AllowLocalFirewallRules": "True",
            "DisabledInterfaceAliases": ""
          }
        ],
        "networkMetadata": {
          "connectionProfiles": [
            {
              "Name": "Airtel_dhar_8398",
              "InterfaceAlias": "Wi-Fi",
              "InterfaceIndex": 16,
              "NetworkCategory": 1,
              "IPv4Connectivity": 4,
              "IPv6Connectivity": 4
            }
          ],
          "adapters": [
            {
              "Name": "Ethernet",
              "InterfaceDescription": "Intel(R) Ethernet Connection (2) I219-LM",
              "ifIndex": 14,
              "Status": "Disconnected",
              "MacAddress": "F4-8E-38-AB-92-BC",
              "LinkSpeed": "0 bps"
            },
            {
              "Name": "Wi-Fi",
              "InterfaceDescription": "Realtek RTL8191SU Wireless LAN 802.11n USB 2.0 Network Adapter",
              "ifIndex": 16,
              "Status": "Up",
              "MacAddress": "00-1E-A6-11-E8-A3",
              "LinkSpeed": "144.5 Mbps"
            },
            {
              "Name": "vEthernet (Ethernet)",
              "InterfaceDescription": "Hyper-V Virtual Ethernet Adapter",
              "ifIndex": 27,
              "Status": "Up",
              "MacAddress": "00-15-5D-20-86-29",
              "LinkSpeed": "10 Gbps"
            },
            {
              "Name": "vEthernet (Wi-Fi)",
              "InterfaceDescription": "Hyper-V Virtual Ethernet Adapter #2",
              "ifIndex": 37,
              "Status": "Up",
              "MacAddress": "00-15-5D-42-C2-40",
              "LinkSpeed": "10 Gbps"
            },
            {
              "Name": "vEthernet (Default Switch)",
              "InterfaceDescription": "Hyper-V Virtual Ethernet Adapter #3",
              "ifIndex": 41,
              "Status": "Up",
              "MacAddress": "00-15-5D-6E-D5-A8",
              "LinkSpeed": "10 Gbps"
            }
          ]
        }
      },
      {
        "index": 2,
        "capturedAt": "2026-10-02T10:46:55.7045863+05:30",
        "rulesExact": true,
        "allowBypassCount": 0,
        "v4": {
          "store": "ActiveStore",
          "name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
          "exists": true,
          "count": 1,
          "rule": {
            "Name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
            "DisplayName": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
            "Description": "CA_PHASE5E4_NETWORK_ZERO_REHEARSAL_RESUME2_dfc86b77",
            "Enabled": "True",
            "Profile": "Any",
            "Direction": "Outbound",
            "Action": "Block"
          },
          "diagnostics": {
            "PrimaryStatus": "Inactive",
            "PrimaryStatusRaw": [
              2
            ],
            "Status": "The rule was parsed successfully from the store. (65536)",
            "StatusCode": 65536,
            "EnforcementStatus": [
              "CategoryDisabled"
            ],
            "EnforcementStatusRaw": [
              null
            ],
            "PolicyStoreSource": "PersistentStore",
            "PolicyStoreSourceType": "Local",
            "Enabled": "True",
            "Profile": "Any",
            "Direction": "Outbound",
            "Action": "Block",
            "InstanceID": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
            "PolicyRuleName": "",
            "CimClassName": "MSFT_NetFirewallRule"
          },
          "trace": [
            {
              "Name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
              "PolicyStoreSource": "PersistentStore",
              "PolicyStoreSourceType": "Local",
              "PrimaryStatus": "Inactive",
              "Status": "The rule was parsed successfully from the store. (65536)",
              "StatusCode": 65536,
              "EnforcementStatus": [
                "CategoryDisabled"
              ],
              "EnforcementStatusRaw": [
                null
              ]
            }
          ],
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
        "v6": {
          "store": "ActiveStore",
          "name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
          "exists": true,
          "count": 1,
          "rule": {
            "Name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
            "DisplayName": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
            "Description": "CA_PHASE5E4_NETWORK_ZERO_REHEARSAL_RESUME2_dfc86b77",
            "Enabled": "True",
            "Profile": "Any",
            "Direction": "Outbound",
            "Action": "Block"
          },
          "diagnostics": {
            "PrimaryStatus": "Inactive",
            "PrimaryStatusRaw": [
              2
            ],
            "Status": "The rule was parsed successfully from the store. (65536)",
            "StatusCode": 65536,
            "EnforcementStatus": [
              "CategoryDisabled"
            ],
            "EnforcementStatusRaw": [
              null
            ],
            "PolicyStoreSource": "PersistentStore",
            "PolicyStoreSourceType": "Local",
            "Enabled": "True",
            "Profile": "Any",
            "Direction": "Outbound",
            "Action": "Block",
            "InstanceID": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
            "PolicyRuleName": "",
            "CimClassName": "MSFT_NetFirewallRule"
          },
          "trace": [
            {
              "Name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
              "PolicyStoreSource": "PersistentStore",
              "PolicyStoreSourceType": "Local",
              "PrimaryStatus": "Inactive",
              "Status": "The rule was parsed successfully from the store. (65536)",
              "StatusCode": 65536,
              "EnforcementStatus": [
                "CategoryDisabled"
              ],
              "EnforcementStatusRaw": [
                null
              ]
            }
          ],
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
        "activeProfiles": [
          {
            "Name": "Domain",
            "Enabled": "True",
            "DefaultInboundAction": "Block",
            "DefaultOutboundAction": "Allow",
            "AllowInboundRules": "True",
            "AllowLocalFirewallRules": "True",
            "DisabledInterfaceAliases": ""
          },
          {
            "Name": "Private",
            "Enabled": "True",
            "DefaultInboundAction": "Block",
            "DefaultOutboundAction": "Allow",
            "AllowInboundRules": "True",
            "AllowLocalFirewallRules": "True",
            "DisabledInterfaceAliases": ""
          },
          {
            "Name": "Public",
            "Enabled": "True",
            "DefaultInboundAction": "Block",
            "DefaultOutboundAction": "Allow",
            "AllowInboundRules": "True",
            "AllowLocalFirewallRules": "True",
            "DisabledInterfaceAliases": ""
          }
        ],
        "networkMetadata": {
          "connectionProfiles": [
            {
              "Name": "Airtel_dhar_8398",
              "InterfaceAlias": "Wi-Fi",
              "InterfaceIndex": 16,
              "NetworkCategory": 1,
              "IPv4Connectivity": 4,
              "IPv6Connectivity": 4
            }
          ],
          "adapters": [
            {
              "Name": "Ethernet",
              "InterfaceDescription": "Intel(R) Ethernet Connection (2) I219-LM",
              "ifIndex": 14,
              "Status": "Disconnected",
              "MacAddress": "F4-8E-38-AB-92-BC",
              "LinkSpeed": "0 bps"
            },
            {
              "Name": "Wi-Fi",
              "InterfaceDescription": "Realtek RTL8191SU Wireless LAN 802.11n USB 2.0 Network Adapter",
              "ifIndex": 16,
              "Status": "Up",
              "MacAddress": "00-1E-A6-11-E8-A3",
              "LinkSpeed": "144.5 Mbps"
            },
            {
              "Name": "vEthernet (Ethernet)",
              "InterfaceDescription": "Hyper-V Virtual Ethernet Adapter",
              "ifIndex": 27,
              "Status": "Up",
              "MacAddress": "00-15-5D-20-86-29",
              "LinkSpeed": "10 Gbps"
            },
            {
              "Name": "vEthernet (Wi-Fi)",
              "InterfaceDescription": "Hyper-V Virtual Ethernet Adapter #2",
              "ifIndex": 37,
              "Status": "Up",
              "MacAddress": "00-15-5D-42-C2-40",
              "LinkSpeed": "10 Gbps"
            },
            {
              "Name": "vEthernet (Default Switch)",
              "InterfaceDescription": "Hyper-V Virtual Ethernet Adapter #3",
              "ifIndex": 41,
              "Status": "Up",
              "MacAddress": "00-15-5D-6E-D5-A8",
              "LinkSpeed": "10 Gbps"
            }
          ]
        }
      },
      {
        "index": 3,
        "capturedAt": "2026-10-02T10:47:00.7572522+05:30",
        "rulesExact": true,
        "allowBypassCount": 0,
        "v4": {
          "store": "ActiveStore",
          "name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
          "exists": true,
          "count": 1,
          "rule": {
            "Name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
            "DisplayName": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
            "Description": "CA_PHASE5E4_NETWORK_ZERO_REHEARSAL_RESUME2_dfc86b77",
            "Enabled": "True",
            "Profile": "Any",
            "Direction": "Outbound",
            "Action": "Block"
          },
          "diagnostics": {
            "PrimaryStatus": "Inactive",
            "PrimaryStatusRaw": [
              2
            ],
            "Status": "The rule was parsed successfully from the store. (65536)",
            "StatusCode": 65536,
            "EnforcementStatus": [
              "CategoryDisabled"
            ],
            "EnforcementStatusRaw": [
              null
            ],
            "PolicyStoreSource": "PersistentStore",
            "PolicyStoreSourceType": "Local",
            "Enabled": "True",
            "Profile": "Any",
            "Direction": "Outbound",
            "Action": "Block",
            "InstanceID": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
            "PolicyRuleName": "",
            "CimClassName": "MSFT_NetFirewallRule"
          },
          "trace": [
            {
              "Name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
              "PolicyStoreSource": "PersistentStore",
              "PolicyStoreSourceType": "Local",
              "PrimaryStatus": "Inactive",
              "Status": "The rule was parsed successfully from the store. (65536)",
              "StatusCode": 65536,
              "EnforcementStatus": [
                "CategoryDisabled"
              ],
              "EnforcementStatusRaw": [
                null
              ]
            }
          ],
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
        "v6": {
          "store": "ActiveStore",
          "name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
          "exists": true,
          "count": 1,
          "rule": {
            "Name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
            "DisplayName": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
            "Description": "CA_PHASE5E4_NETWORK_ZERO_REHEARSAL_RESUME2_dfc86b77",
            "Enabled": "True",
            "Profile": "Any",
            "Direction": "Outbound",
            "Action": "Block"
          },
          "diagnostics": {
            "PrimaryStatus": "Inactive",
            "PrimaryStatusRaw": [
              2
            ],
            "Status": "The rule was parsed successfully from the store. (65536)",
            "StatusCode": 65536,
            "EnforcementStatus": [
              "CategoryDisabled"
            ],
            "EnforcementStatusRaw": [
              null
            ],
            "PolicyStoreSource": "PersistentStore",
            "PolicyStoreSourceType": "Local",
            "Enabled": "True",
            "Profile": "Any",
            "Direction": "Outbound",
            "Action": "Block",
            "InstanceID": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
            "PolicyRuleName": "",
            "CimClassName": "MSFT_NetFirewallRule"
          },
          "trace": [
            {
              "Name": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
              "PolicyStoreSource": "PersistentStore",
              "PolicyStoreSourceType": "Local",
              "PrimaryStatus": "Inactive",
              "Status": "The rule was parsed successfully from the store. (65536)",
              "StatusCode": 65536,
              "EnforcementStatus": [
                "CategoryDisabled"
              ],
              "EnforcementStatusRaw": [
                null
              ]
            }
          ],
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
        "activeProfiles": [
          {
            "Name": "Domain",
            "Enabled": "True",
            "DefaultInboundAction": "Block",
            "DefaultOutboundAction": "Allow",
            "AllowInboundRules": "True",
            "AllowLocalFirewallRules": "True",
            "DisabledInterfaceAliases": ""
          },
          {
            "Name": "Private",
            "Enabled": "True",
            "DefaultInboundAction": "Block",
            "DefaultOutboundAction": "Allow",
            "AllowInboundRules": "True",
            "AllowLocalFirewallRules": "True",
            "DisabledInterfaceAliases": ""
          },
          {
            "Name": "Public",
            "Enabled": "True",
            "DefaultInboundAction": "Block",
            "DefaultOutboundAction": "Allow",
            "AllowInboundRules": "True",
            "AllowLocalFirewallRules": "True",
            "DisabledInterfaceAliases": ""
          }
        ],
        "networkMetadata": {
          "connectionProfiles": [
            {
              "Name": "Airtel_dhar_8398",
              "InterfaceAlias": "Wi-Fi",
              "InterfaceIndex": 16,
              "NetworkCategory": 1,
              "IPv4Connectivity": 4,
              "IPv6Connectivity": 4
            }
          ],
          "adapters": [
            {
              "Name": "Ethernet",
              "InterfaceDescription": "Intel(R) Ethernet Connection (2) I219-LM",
              "ifIndex": 14,
              "Status": "Disconnected",
              "MacAddress": "F4-8E-38-AB-92-BC",
              "LinkSpeed": "0 bps"
            },
            {
              "Name": "Wi-Fi",
              "InterfaceDescription": "Realtek RTL8191SU Wireless LAN 802.11n USB 2.0 Network Adapter",
              "ifIndex": 16,
              "Status": "Up",
              "MacAddress": "00-1E-A6-11-E8-A3",
              "LinkSpeed": "144.5 Mbps"
            },
            {
              "Name": "vEthernet (Ethernet)",
              "InterfaceDescription": "Hyper-V Virtual Ethernet Adapter",
              "ifIndex": 27,
              "Status": "Up",
              "MacAddress": "00-15-5D-20-86-29",
              "LinkSpeed": "10 Gbps"
            },
            {
              "Name": "vEthernet (Wi-Fi)",
              "InterfaceDescription": "Hyper-V Virtual Ethernet Adapter #2",
              "ifIndex": 37,
              "Status": "Up",
              "MacAddress": "00-15-5D-42-C2-40",
              "LinkSpeed": "10 Gbps"
            },
            {
              "Name": "vEthernet (Default Switch)",
              "InterfaceDescription": "Hyper-V Virtual Ethernet Adapter #3",
              "ifIndex": 41,
              "Status": "Up",
              "MacAddress": "00-15-5D-6E-D5-A8",
              "LinkSpeed": "10 Gbps"
            }
          ]
        }
      }
    ]
  },
  "wfpBlockedEventCount": 0,
  "preflightPassed": true,
  "auditMutationApplied": true,
  "firewallRulesCreated": 2,
  "cleanupAttempted": true,
  "cleanupSucceeded": true,
  "profilePrePostExact": true,
  "persistentFirewallPrePostExact": true,
  "auditPrePostExact": true,
  "postResidue": {
    "persistentRuleCount": 0,
    "activeRuleCount": 0,
    "persistent": [],
    "active": []
  },
  "recoveryScript": {
    "path": "E:\\TA Projects\\EOD Charting Platform\\tmp\\CA_PHASE5E4_NETWORK_ZERO_REHEARSAL_RESUME2_2026-10-02_104621_IST_dfc86b77\\collection\\RECOVERY-EOD-CA-P5E4-NETZERO.ps1",
    "sha256": "79A4E08DB7F6830CB8517298628C3804F06AD6A72B772AB2A352AD01D028DA4E",
    "parserPassed": true,
    "ruleV4": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv4_BLOCK",
    "ruleV6": "EOD_CA_P5E4_NETZERO_dfc86b77_IPv6_BLOCK",
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
  "status": "PASS",
  "nextRecommendedTask": "CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_DESIGN_FIX2_R1"
}
```

## Blockers / limitations
```json
[]
```

## Behaviour preserved
EOD launch=0 / Load & Prepare=0 / DB access/write/restore=0 / source/build/dist/portable=0 / Git=0 / external probe traffic=0 / process termination=0.

## Rollback
The exact two run-owned PersistentStore rules were removed and the two WFP audit subcategories restored to PRE state. The run-generated recovery script remains as evidence only.

## Next
`CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_DESIGN_FIX2_R1`. No live network-enforced EOD validation is authorized by this diagnostic.
