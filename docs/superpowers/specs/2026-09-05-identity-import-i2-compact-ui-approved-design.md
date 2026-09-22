# Identity Import I2 — Compact UI Approved Design

Status: APPROVED IMPLEMENTATION SPECIFICATION  
Date: 2026-09-05  
Project root: `E:\TA Projects\EOD Charting Platform`

## Goal

Replace the flat Identity Import toolbar with a compact trading-platform workflow without changing backend identity semantics.

## Approved operator structure

```text
IDENTITY IMPORT

Exchange  [ NSE ] [ BSE ]
Source    [ Official ] [ Manual ]

NSE + Official
NSE Sources    Current Master + De-listed           [ Refresh NSE Sources ]

BSE + Official
BSE Sources    Active + De-listed + Suspended       [ Refresh BSE Sources ]

NSE + Manual
NSE Archive Root  [ path........................ ] [ Browse Folder ]
Historical NSE symbol/name chains                  [ Import Historical Identity ]

BSE + Manual
BSE Master CSV    [ path........................ ] [ Browse File ]

[ Preview Changes ]   [ Apply Reviewed Changes ]

Status / preview summary
Find [.......................................] [ Current Chart ]
Preview table
```

## Required behavior

1. `Refresh NSE Sources` performs the existing NSE current-master download followed by the existing NSE de-listed workbook download. It never calls Apply.
2. `Refresh BSE Sources` keeps the existing BSE lifecycle download, which covers Active + De-listed + Suspended data.
3. Official NSE Preview/Apply uses database-managed NSE sources.
4. Manual NSE Preview/Apply uses the selected NSE Archive Root.
5. Official BSE refresh stores the generated managed BSE master path for BSE Preview/Apply.
6. Manual BSE uses a selected CSV file path for the same BSE Preview/Apply backend operations.
7. `Preview Changes` and `Apply Reviewed Changes` remain separate controls.
8. Historical NSE identity import remains separate and is labelled `Import Historical Identity`.
9. `Current Chart` preserves the accepted I1 exchange behavior.
10. Official source URL configuration and Identity help remain available as compact utility icons.

## Browse controls

- NSE Archive Root uses the existing desktop folder picker capability through `pickPluginOutputDirectory` with an Identity-specific title.
- BSE Master CSV uses the existing single-file picker capability through `pickPluginDataFile`, filtered to CSV.
- No new backend picker command is introduced.

## Presentation constraints

- Compact controls: 24–28 px selector/button heights.
- 11–12 px Identity-specific control typography.
- No large cards or oversized blank sections.
- Preview table retains most of the window height.
- Manual Entry remains unchanged.

## Explicit non-goals

I2 does not:

- bind Apply cryptographically/state-wise to the exact reviewed Preview;
- add combined NSE+BSE preview/apply;
- add BSE historical identity import;
- change NSE/BSE backend database behavior;
- change Corporate Action Official Imports;
- change Manual Entry;
- change chart-price behavior.

## Authority transition

The original I0 characterization captured the pre-I2 visible labels. I2 intentionally supersedes those presentation labels while preserving the characterized capabilities. The characterization test is revised in I2 to assert capability semantics and the approved compact surface instead of obsolete button text.


## I1 regression-test compatibility correction

During the first I2 execution, the I1 Current regression failed even though the Current exchange resolver behavior remained unchanged. The I1 test asserted the resolver as one exact single-line source string, while I2 formatted the same ternary across multiple lines.

I2 R1A therefore intentionally evolves only the I1 test assertion:

- pre-I2 I1 test SHA is verified and preserved as evidence;
- the revised test normalizes whitespace before asserting the exact semantic resolver;
- the hard-coded NSE-only forbidden call remains explicitly rejected;
- the revised I1 test is run once against the pre-I2 production authority before I2 production is installed, then again after I2;
- I1 production behavior is not changed by this compatibility correction.
