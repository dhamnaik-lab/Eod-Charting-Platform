# Identity Recovery & AI Handoff Export R1

Status: AUTOMATED PASS / MANUAL EXPORT CHECK REQUIRED
Generated: 2026-09-06 17:34:11 IST

## Goal

Expose the already-documented future recovery handoff as three built-in Markdown exports from the existing Identity Import Info dialog.

## Implemented

- Recovery & AI Handoff section inside Identity Import Info.
- Export Source Recovery Brief.
- Export Identity Investigation Brief.
- Export Recovery Guide.
- Resources bundled through Vite raw Markdown imports.
- Existing saveTextExport desktop bridge reused unchanged.

## Boundaries

- Database behavior change: NO
- Network/web behavior change: NO
- AI provider/API dependency: NO
- Rust/backend command change: NO
- I3/I4 reviewed authority change: NO
- Official/Manual source behavior change: NO
- Source-control command: NO

## Postimage

- DatabaseToolsDialogs.tsx: F3886CE568B2726CDA93472B995A8643287C2B32FBC8422015093F7C1BFC681A
- identityRecoveryDocuments.ts: F80BABCF1C9FAEC01AE9F76A9B18EE333D526EDE1A5C72F53E16E0BBA88A3CE6
- rawMarkdown.d.ts: BB3FE833B4113BBD30109A6E752627BCD088945B7F1D0650E323998141193722
- Source Recovery Brief: 06D7F5574D9B9D288AFB3DC89D34DCCAD3107E6AFDFEA78E67621BA3AAA3932F
- Identity Investigation Brief: 98DC99958285507DAF155E20B2190648F3CC5F26FC14E672E2390A5E1CB0BD03
- Recovery Guide: 1C236AFE396C78F7559AAEBFC91E8D2E17B7E024EA5BF17DC4846F9F19CF27D1
- Focused test: 74CDFE50D5D00887B2AAF2220EA508E78B83CD6790BAC38D0030EA1B3C04197C

## Automated validation

- TDD RED: PASS
- Focused new test: PASS
- Focused Identity/I3/I4/Official Imports regression: PASS
- Renderer typecheck: PASS
- Renderer build: PASS
- Bundled Markdown sentinels: PASS

## Manual checkpoint

Open Corporate Actions / Identity > Identity Import > ? > Recovery & AI Handoff and save all three exports. Confirm each Save As succeeds and the saved Markdown opens with the expected content.
