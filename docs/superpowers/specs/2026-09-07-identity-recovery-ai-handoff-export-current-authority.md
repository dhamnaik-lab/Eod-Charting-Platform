# Identity Recovery & AI Handoff Export — Current Authority

**Status:** CURRENT AUTHORITY / R1 ACCEPTED  
**Date:** 2026-09-07 IST  
**Project root:** `E:\TA Projects\EOD Charting Platform`

## Accepted capability

The existing **Identity Import Info** dialog now includes:

```text
Recovery & AI Handoff
├─ Export Source Recovery Brief
├─ Export Identity Investigation Brief
└─ Export Recovery Guide
```

The implementation reuses the existing `saveTextExport` seam. It adds no new Rust command, database behavior, network/AI integration, source-URL mutation path, or reviewed-Apply bypass.

## Primary user workflow

```text
official NSE/BSE source breaks
→ Identity Import Info
→ Export Source Recovery Brief
→ save Markdown
→ give file to any AI or human researcher
→ receive candidate official URL/evidence
→ validate independently
→ existing reviewed workflow remains final authority
```

## Automated acceptance

Evidence:

`E:\TA Projects\EOD Charting Platform Source Audit\IDENTITY_RECOVERY_AI_HANDOFF_EXPORT_R1_2026-09-06_173411_IST_evidence.zip`

SHA-256:

`B339D066DB0BDE36F26FA840FA73896896A377CDBF5AE6B5E0FE2E3475B88163`

Accepted automated results:

- TDD RED: PASS.
- focused export test: 3/3 PASS.
- Identity/I3/I4/Official Imports regression: 7 files / 37 tests PASS.
- renderer typecheck: PASS.
- renderer build: PASS.
- bundled Markdown sentinels: PASS.
- preservation postcheck: PASS.

## Manual + portable acceptance

Windows portable rebuild completed successfully.

Portable executable SHA-256:

`1B10964A6405843AA3DD29164D7FD25A3B5D8887EEFF76D10C0835BDA3406A87`

Portable root:

`E:\TA Projects\EOD Charting Platform\release\tauri-portable-win\EOD Chart Portable`

Manual acceptance against the rebuilt portable confirmed:

- Recovery & AI Handoff section visible.
- all three export buttons visible.
- all three Save As operations succeeded.
- all three exported Markdown files were readable and matched bundled content.

Accepted document SHA-256 values:

- `Official-Source-Recovery-Brief-For-Any-AI.md` — `06D7F5574D9B9D288AFB3DC89D34DCCAD3107E6AFDFEA78E67621BA3AAA3932F`
- `Identity-Investigation-Brief-For-Any-AI.md` — `98DC99958285507DAF155E20B2190648F3CC5F26FC14E672E2390A5E1CB0BD03`
- `Identity-Recovery-Guide.md` — `1C236AFE396C78F7559AAEBFC91E8D2E17B7E024EA5BF17DC4846F9F19CF27D1`

The portable build emitted the existing non-fatal dead-code warning for `apply_nse_current_universe_sync_internal`. That warning is unrelated to this feature and is not an acceptance failure.

## Current production authority

- `src\components\DatabaseToolsDialogs.tsx` — `F3886CE568B2726CDA93472B995A8643287C2B32FBC8422015093F7C1BFC681A`
- `src\features\identityRecovery\identityRecoveryDocuments.ts` — `F80BABCF1C9FAEC01AE9F76A9B18EE333D526EDE1A5C72F53E16E0BBA88A3CE6`
- `src\features\identityRecovery\rawMarkdown.d.ts` — `BB3FE833B4113BBD30109A6E752627BCD088945B7F1D0650E323998141193722`
- `src\features\identityRecovery\resources\Official-Source-Recovery-Brief-For-Any-AI.md` — `06D7F5574D9B9D288AFB3DC89D34DCCAD3107E6AFDFEA78E67621BA3AAA3932F`
- `src\features\identityRecovery\resources\Identity-Investigation-Brief-For-Any-AI.md` — `98DC99958285507DAF155E20B2190648F3CC5F26FC14E672E2390A5E1CB0BD03`
- `src\features\identityRecovery\resources\Identity-Recovery-Guide.md` — `1C236AFE396C78F7559AAEBFC91E8D2E17B7E024EA5BF17DC4846F9F19CF27D1`
- `src\features\corporateActions\__tests__\corporateActionIdentityRecoveryHandoffExport.test.ts` — `74CDFE50D5D00887B2AAF2220EA508E78B83CD6790BAC38D0030EA1B3C04197C`

## Preserved authorities

These remain unchanged:

- `src\types\desktop.ts` — `01F4525AFA562122315D6CFBA8CF5A3328978A99CEE8AC704DADBCB72AACDEC7`
- `src\platform\types.ts` — `8877AAB6F78CDC0502CF2B153A05585B2C34A185D898E65ECBB2B41A5908C606`
- `src\platform\tauriDesktop.ts` — `620A1DDE53EECEFBD55B109ED531B9B54FF084504E6685A0F86185BBF5F0ACEC`
- `src-tauri-shell\src\main.rs` — `A97A3AF97310D0C681111EDC45D320FD9CEF064FFFFB354E746B949005BD54C2`
- `src-tauri-shell\src\imports.rs` — `133A40E6881B1EB0AB38B796D43E773742C5B93D9283A3CC60D3CD0F715D787F`
- `src-tauri-shell\src\database\nse_identity_imports.rs` — `2E05EF2050179305223A95F10CD0B3B2DE894F9615A78991E2D93F6ADD7542AB`
- `src-tauri-shell\src\database\bse_identity_imports.rs` — `F7F5F8F753785E530EABA22126B84385E7395E24A1B4296751879F73CF0CEC1E`
- `src-tauri-shell\src\database\instrument_mutations.rs` — `39A37CEC5360648654FCC1FE3F66105655CDC68E9B907BFF77B68984F29B4C82`
- `package.json` — `62CA8FA100A46242C669877064C2332D93C842B16CC95B72045EC02A17F9F9EA`
- `package-lock.json` — `051C0060536DFE588CD67F0645888D719E7DF365E63E04F8F896429A88D002BC`

## Identity authority boundary

I3/I4 remain the reviewed-write authority:

```text
NSE Official
→ primary routine Identity source

NSE Manual historical archive
→ fallback/recovery

I3
→ current-universe reviewed Preview → Apply

I4
→ historical reviewed Preview → atomic Apply
```

The export feature only makes recovery documents easy to obtain.

## External-AI boundary

```text
AI may help find evidence.
AI never becomes Identity authority.
```

External research returns candidates only. Candidate URLs/evidence are not automatically approved, promoted, or applied.

Future ER0+ work remains separate and deferred.
