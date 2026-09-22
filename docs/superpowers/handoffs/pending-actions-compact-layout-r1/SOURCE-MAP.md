# Current-source map and authority notes

This map describes the exact accepted FIX2 RESUME1 file, not an older pasted ER4 source diff. Re-locate named anchors after edits move line numbers.

## Verified source and evidence

| Item | Authority |
|---|---|
| Accepted evidence | `reference/accepted-fix2-resume1-evidence.zip` in the bundle, SHA256 `06B34E77ADA300A7755165B9C0180B4C3C65E1DCE793D2995B28F80DAA6A034F` |
| Dialog | `src/components/DatabaseToolsDialogs.tsx`, 376,702 bytes, SHA256 `4951C7340F534ED2C401189877635E4F122C7B22089A5B17451B7FA392E8ACEF` |
| Current-status baseline | `docs/CURRENT_WORK_STATUS.md`, SHA256 `C370375C43B54F852E574C7191DA1C943C02B6E9003354FE210ACE2287DBF72F` as captured in accepted evidence; newer documentation must be inspected, not overwritten |
| Full protected inventory | `authority/accepted-protected-source-552.json`, extracted byte-for-byte from evidence `real-final.json` |
| Read-only source text | `reference/DatabaseToolsDialogs.tsx.accepted.txt`, identical to the installed-source archive member; do not copy into product source as a patch |

The ZIP's inherited `source-authority-chain.json` contains a field called `acceptedComponentSHA256` from the earlier 550-file parent. **That old value is not the post-FIX2 dialog authority.** Prefer `real-final.json` and `SUMMARY.sourceDelta` for the installed state. The 552-path set is not the entire repository and excludes documentation/build support under the original inventory policy.

## Exact anchors

| Current symbol | Parent start line | R1 treatment |
|---|---:|---|
| `CorporateActionDialog` | 1403 | Inspect and preserve existing logic/defaults |
| `loadAndPrepareOfficialImports` | 2874 | Inspect and preserve existing logic/defaults |
| `loadOfficialImports` | 2932 | Inspect and preserve existing logic/defaults |
| `toggleImportActionType` | 2997 | Inspect and preserve existing logic/defaults |
| `updateOfficialImportSearchQuery` | 3008 | Inspect and preserve existing logic/defaults |
| `switchOfficialImportView` | 3014 | Inspect and preserve existing logic/defaults |
| `eligibleImportRows` | 3632 | Inspect and preserve existing logic/defaults |
| `officialPendingGroups` | 3638 | Inspect and preserve existing logic/defaults |
| `toggleImportSelection` | 3692 | Inspect and preserve existing logic/defaults |
| `approveOfficialImportRows` | 3730 | Inspect and preserve existing logic/defaults |
| `requestOfficialImportApproval` | 3811 | Inspect and preserve existing logic/defaults |
| `confirmOfficialImportApproval` | 3831 | Inspect and preserve existing logic/defaults |
| `renderImportActionTypeFilters` | 4096 | Inspect and preserve existing logic/defaults |
| `renderSearchBar` | 4112 | Inspect and preserve existing logic/defaults |
| `renderResolvePanel` | 4136 | Inspect and preserve existing logic/defaults |
| `renderPriceExceptionPanel` | 4424 | Inspect and preserve existing logic/defaults |
| `renderImportsTab` | 5588 | Presentation-only edit permitted |
| `officialPendingGroupHeaderStyle` | 8193 | Presentation-only edit permitted |
| `OfficialImportTaskStatus` | 9717 | Presentation-only edit permitted |

## Layout edit ranges

The old standalone task panel is at 5613–5616. The review header/control card is at 5617–5710. The Apply confirmation begins at 5993 and stays explicit. Group-header JSX and reason allocation are at approximately 6037–6071. Child actions begin at 6073 and their logic remains unchanged. The common bottom footer is at 6145–6162: suppress its Pending Review instance only after moving the canonical current message to the new status band.

`OfficialImportTaskStatus` begins at 9717. It owns the elapsed clock locally, stops on `endedAt`, and clears its interval. Keep this lifecycle exactly; change only presentation and optional inputs. `progress` is a union of existing preparation/operation progress enriched with `startedAt`/`endedAt`. A stopped task can have an end timestamp; it is not necessarily successful.

The Symbol selector's exact onChange currently sets `officialReviewSymbolFilter`, clears `selectedImportIds`, and clears `officialApprovalConfirmation`. Find delegates to `updateOfficialImportSearchQuery`, whose Dispatch/SetStateAction type was deliberately corrected in FIX1. Types delegate to `toggleImportActionType`. Do not add filtering state or change the clear behavior.

The existing group-selection predicate is `busy || !officialPreparationComplete || readyRows.length === 0`. Child selection uses `busy || !canApprove`. The group reason span uses `maxWidth:'55%'` inside its header allocation; this is the approved width/wrap correction, not authority to replace reason calculation.

## Shared styles — no global shrink

`buttonRowStyle` (8240), `modalButtonStyle`, `primaryButtonStyle`, `utilityInputStyle` (8407), `utilityStatusStyle` (8437), `officialImportSectionCardStyle` (8510), `officialImportSectionHeaderStyle` (8521), `officialImportFieldGroupStyle` (8536), `corporateActionPanelStyle` (8543), `corporateImportToolbarStyle` (8559) and `corporateSearchRowStyle` (around 9193) have other callers. Introduce opt-in private Pending Review styles rather than changing these definitions globally. Existing primary buttons are about 34 CSS px high and utility inputs 30; use them as the readable baseline.

The confirmation and exception panels are allowed to exceed the normal toolbar-height target. `corporateImportTableStyle` is also shared; do not change its global minimum height to claim recovered space. Preserve the original conditional hiding of the pending table while a resolve/price-exception panel is active.

## Preservation regions

`authority/protected-dialog-regions.json` records anchored LF-normalized SHA256s of critical unchanged blocks: preparation/load/filter lifecycle, eligibility/grouping, ordinary Apply, review request/confirmation, and shared filter/search helper functions. These hashes do not replace a full diff; they make accidental behavior edits obvious. Regions were derived from the exact source in this packet. If a proposed layout edit requires changing one of them, first look for a presentation-only alternative; scope expansion is not implicit permission.

## Protected-inventory policy from the accepted controller

Enumerate `src` and `src-tauri-shell`; reject symlink/reparse-point surprises; skip the same excluded directory names as the archived controller: `node_modules`, `target`, `dist`, `build`, `out`, `output`, `release`, `releases`, `debug`, `portable`, `portable-output`, `installer`, `installers`, `artifacts`, `coverage`, `.git`, `.cache`, `.turbo`, `.vite`, `.parcel-cache`, `cache`, `temp`, `tmp`, `logs`.

The original policy excludes `.md` and `.markdown` files and `.png` files under `src-tauri-shell` from the **protected 552 count**. Such runtime resources may still be necessary build support and must be copied/captured as support. Do not drop them from a sandbox just because they are outside the count. Do not change this inventory definition to make a mismatch disappear.

The sole generated source exception is `src-tauri-shell/gen/build-info.json`: existing file size at most 4096 bytes; keys exactly `buildNumber`, `builtAt`, `version`; version `0.1.0`; parseable timestamp in the existing `YYYY-MM-DDTHH:mm:ss±HH:mm` form; build number corresponds to `YYYYMMDD.HHmmss`. Capture live bytes/hash and preserve them through layout work. Only a separately run build can legitimately regenerate it.

## Source/support evidence limits

The September 18 snapshot SHA256 is `0EF8966CD8F4C29DAE0F032372322B88827FF44985968688AE1C4BFA6897666F`. It is an older 548-file source baseline, not the current root. During handoff preparation, its package/config/build-script contents were consulted only to explain the existing tool choices. Live support files require preflight reading/hash capture. The unchanged validation-policy source was separately matched to the 552-path manifest; no policy edits are planned.

The current full R1 UX test path appears in the 552 manifest but is not one of this evidence archive's twelve source members: read it from the local root. Do not invent its contents. The packet contains complete FIX2 tests and the current characterization test inside the accepted evidence archive.

## Prior verification, not future results

Archive JSON reports independently read for this handoff: focused FIX2 23/23; CA/Identity 237/237; full Vitest 875/875; installed focused 26/26. The command journal reports renderer typecheck/build and native gates. These are historical parent results. No application test, compile, portable or runtime trace was executed while authoring this packet.
