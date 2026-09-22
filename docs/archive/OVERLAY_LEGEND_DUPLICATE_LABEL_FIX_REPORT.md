# Overlay Legend Duplicate Label Fix Report

Date: 2026-04-09

## Summary

This pass fixes the duplicated-looking overlay study label in the top-left chart area.

The root cause was not EMA itself. The study title was being rendered twice:

- once by the canvas overlay legend in `src/engine/ChartEngine.ts`
- once by a separate DOM overlay label block in `src/components/ChartCanvas.tsx`

Because both were positioned in the same top-left area, the study name looked doubled or blurry while the value remained single.

## What Changed

- removed the duplicate DOM overlay study-label block from `src/components/ChartCanvas.tsx`
- kept the canvas-rendered overlay legend as the single source of truth for overlay study labels and values

## Result

- overlay study labels in the top-left chart area render once
- the legend now stays consistent with the indicator value shown beside it
- EMA and other overlay studies no longer look like multiple stacked labels

## Validation

- `npm run typecheck:renderer`
- `npm run build`
