# Sidebar Symbol Index Click Fix Report

Date: 2026-04-09

## Summary

This pass fixes the symbol sidebar alphabet index behavior.

The old interaction behaved like a drag scrubber because moving the mouse across the alphabet rail triggered symbol-group jumps through `onMouseMove`. That made the symbol list change while the user was only brushing the pointer over the index.

## What Changed

- updated `src/components/Sidebar.tsx` so the symbol alphabet rail uses click-only buttons instead of drag/hover-driven jumps
- removed the `onMouseMove` and `onMouseDown` jump behavior from the symbol index rail
- kept the temporary active-letter highlight, but reset it through a controlled timeout instead of pointer-up behavior
- moved the alphabet rail into the same scroll-body region as the symbol list so its height aligns with the list scrollbar area instead of the full framed panel
- adjusted the alphabet buttons to distribute vertically down the full symbol-list body instead of being packed at the top
- kept the alphabet rail narrow so it still fits as a slim strip beside the symbol list
- disabled letters that do not currently exist in the loaded symbol groups
- restored `flex: 1` / `min-width: 0` on the symbol-list scroll body so the symbol rows keep their width after the alphabet rail was moved into the same flex row

## Result

- moving the mouse over the alphabet strip no longer changes the visible symbol group
- clicking a letter now jumps directly to that symbol series section
- the alphabet strip now matches the symbol list body height more closely and no longer looks vertically cramped
- the symbol rows remain visible beside the alphabet rail instead of collapsing to a blank list body

## Validation

- `npm run typecheck:renderer`
- `npm run tauri:portable:win`
