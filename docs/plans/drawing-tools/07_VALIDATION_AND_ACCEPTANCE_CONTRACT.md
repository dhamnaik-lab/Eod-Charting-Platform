# Drawing Expansion — Validation and Acceptance Contract

This contract applies to every implementation phase D1-D5.

## 1. Evidence categories

Every completion report must separate:

- Confirmed facts
- Evidence from source/command output
- Assumptions
- Recommendations
- Not yet tested

## 2. Required source reporting

For every phase report:

- files inspected
- files created
- files modified
- exact behavior changed
- behavior deliberately preserved
- risks/regressions
- validation performed
- actual results
- recommended next step

## 3. Required automated validation

Use the project scripts that actually exist in the baseline.

Minimum expected categories:

1. Focused drawing/unit tests
2. Renderer TypeScript typecheck
3. Renderer production build

When Rust/Tauri source/configuration is touched:

4. Cargo/Tauri checks

Before runtime acceptance of a meaningful drawing phase:

5. Portable Windows packaging

Never state PASS without actual command output.

## 4. Backward-compatibility suite

A saved-workspace fixture containing every original drawing type should be retained.

The suite must verify that original:

- Horizontal Line
- Vertical Line
- Text
- Trend Line
- Ray
- Arrow
- Rectangle
- Parallel Channel
- Fibonacci Retracement
- Fibonacci Extension
- Fibonacci Fan
- Gann Fan
- Measure

continue to deserialize and render after every phase.

## 5. Interaction acceptance matrix

Each new drawing must be tested for applicable operations:

| Operation | Required |
|---|---|
| Create | Yes |
| Live preview | Yes when multi-click |
| Cancel with Esc | Yes |
| Select | Yes |
| Hit test | Yes |
| Drag whole drawing | Yes where meaningful |
| Drag anchors | Yes where meaningful |
| Properties | Yes |
| Lock/unlock | Yes |
| Delete | Yes |
| Undo/clear compatibility | Yes |
| Save/reload workspace | Yes |
| Symbol switch | Yes |
| Timeframe switch | Yes |
| Zoom/pan | Yes |
| Renko | Test if tool allowed there |
| Screenshot/export | Test if drawings are exported |

## 6. Alert isolation test

Current drawing-alert eligibility must remain:

- `hline`
- `trendline`
- `ray`

No new drawing becomes an alert source merely because it has line geometry.

Any future alert expansion requires a separate feature contract.

## 7. Performance checks

At each phase:

- verify normal pointer interaction remains responsive;
- verify no unbounded recalculation on mouse move;
- avoid allocating large temporary arrays in every render where reusable calculations are possible;
- add stress fixtures for D4/D5.

## 8. Portable runtime acceptance

For phases that materially change drawing behavior:

```powershell
Set-Location "E:\TA Projects\EOD Charting Platform"
npm run tauri:portable:win
```

Then manually test the rebuilt executable.

## 9. Required IST change report

After implementation:

`docs\changes\YYYY-MM-DD_HHMM_IST_DRAWING_TOOLS_PHASE_Dx_<TOPIC>.md`

Include rollback guidance and the exact baseline used.

## 10. Stop conditions

Do not proceed to the next phase if:

- original drawings regress;
- saved workspace compatibility is uncertain;
- typecheck/build fails;
- focused drawing tests fail;
- manual runtime exhibits stale/incorrect drawing state;
- source snapshot is no longer known to be current.
