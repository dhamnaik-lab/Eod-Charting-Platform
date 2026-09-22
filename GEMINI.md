# GEMINI.md - EOD Charting Platform Project Instructions

## Project Scope
Work only inside:
E:\TA Projects\EOD Charting Platform

This is a Tauri-only desktop app.
Do not assume Electron is active.
Do not reintroduce Electron files, scripts, or runtime paths.

## Current Safe Baseline
Before editing, always run:

git status --short

If the working tree is not clean, stop and report.

Safe baseline tag:
baseline-eod-source-gemini-ready-20260512

## Mandatory Workflow
1. Investigate first.
2. Do not edit files during investigation.
3. Give exact files, functions, and line ranges.
4. Propose the smallest possible fix.
5. Wait for approval before editing.
6. Do not rewrite large files.
7. Preserve existing working behavior.

## Dangerous Files
Be very careful with:
- src/engine/ChartEngine.ts
- src/components/ChartCanvas.tsx
- src/engine/Renderer.ts
- src/engine/ScaleManager.ts
- src/store/chartStore.ts

Never rewrite these files wholesale.
Make small targeted edits only.

## Chart Regression Context
The May 11 performance pass fixed freezes by deferring axisWidthChange events with setTimeout.
Do not remove this behavior unless it is proven to be the exact cause and a safer alternative is provided.

## Indicator Context
TA-Lib-style indicator expansion is already implemented.
technicalindicators@3.1.0 is installed.
Do not reinstall or redesign the indicator system unless explicitly requested.

## Validation Commands
After code edits, prefer:

npm run typecheck:renderer
npm run test
npm run tauri:check

For release preview:

powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\run-release-preview.ps1"

## Git Safety
After edits, always report:

git diff --stat
git diff --name-only

If changes are broad, stop and explain before continuing.
