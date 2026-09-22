# Bhavcopy Compact Progress UI Fix V1

## Status

**Code validation accepted; exact screenshot-based visual acceptance not separately recorded.** The renderer change passed typecheck, the repository test suite (36 files / 235 tests), and renderer build. A later portable rebuild used the updated source during BSE Index runtime acceptance, but no dedicated screenshot was captured to close the visual-only acceptance item.

## Scope

Renderer-only UI correction for the Bhavcopy download progress display.

## Problem

The Bhavcopy progress event intentionally carries detailed backend diagnostic messages so they can be written to the Activity Log. The same raw message was also rendered in two compact status surfaces:

- the Bhavcopy window footer; and
- the application-wide status bar.

Long diagnostics such as `Bhavcopy binary write detail: ...` therefore consumed the entire footer/status line while a download was running.

## Change

- The Bhavcopy window footer now displays the running badge, progress bar, and percentage only.
- The global application status bar now displays `Download <percent>%` only while a download is active.
- Detailed progress diagnostics are **not removed from the event/store pipeline** and remain available in the Bhavcopy Activity Log.
- No Rust, Bhavcopy import, recovery, database, or Phase 2C durability behavior is changed.

## Acceptance

During a Bhavcopy run with long diagnostics:

1. Activity Log continues to show the full diagnostic line.
2. Bhavcopy footer remains compact and shows progress without the raw diagnostic text.
3. Global status bar remains compact and shows `Download <percent>%` without the raw diagnostic text.
4. Completion footer still shows `Completed`, OK/Fail counts, and row count.

## Validation

```powershell
npm run typecheck:renderer
npm test
npm run build:renderer
```
