# Reference Settings UI Audit — Indicator and Drawing ZIPs

**IST timestamp:** 2026-08-10 16:31 IST  
**Scope:** reference-layout audit only; community-indicator implementation remains deferred.

## Conclusion

The two uploaded repositories do **not** provide the same level of reusable settings UI.

### Indicator repository — settings UI exists, but it is input-focused

Reference: `lightweight-charts-indicators-main.zip`.

The example application contains `example/src/indicator-ui.ts` and an associated HTML/CSS layout. It dynamically builds a selected-indicator **Settings** area from each indicator's `inputConfig`. Supported input controls include:

- integer/float number inputs;
- source selectors;
- boolean checkboxes;
- string/select inputs where options are declared.

The repository's indicator definitions also expose calculation/render metadata such as `defaultInputs`, `inputConfig`, `plotConfig`, and in some cases `hlineConfig` / `fillConfig`.

However, the example is **not** a complete TradingView-style `Inputs / Style / Visibility` settings dialog. It primarily edits calculation inputs. Plot colors, widths, line styles, horizontal-line styling, and visibility metadata are mostly consumed by rendering code rather than exposed through a comprehensive end-user style editor.

**Usefulness to EOD Charting Platform:** useful reference for a future indicator-settings layout and dynamic input generation, but not a drop-in settings subsystem.

### Drawing repository — no generic Drawing Properties/settings dialog

Reference: `lightweight-charts-drawing-main.zip`.

The demo provides:

- a drawing-tool palette;
- drawing categories;
- a right-side active-drawings list;
- clear/delete controls;
- a status area;
- a text-editor modal for text drawings.

The drawing implementations carry style/options data (line colors, widths, fills, annotation options, etc.), but the demo does **not** provide a general editable Drawing Properties panel or reusable color-picker/settings dialog. Default colors are selected programmatically in the demo.

**Usefulness to EOD Charting Platform:** geometry/style-contract reference only. The current EOD Drawing Properties dialog is already a more complete general settings surface and should be repaired/evolved natively instead of replaced by UI from this ZIP.

## Recommendation for later settings work

After drawing phases D1-D5 and the selected standard-indicator expansion are stable, perform a dedicated settings-UX phase:

1. retain the EOD platform's native Drawing Properties architecture;
2. redesign its color/style controls once, shared by all drawing types;
3. use the indicator repository's dynamic `inputConfig` concept as a reference for indicator Inputs;
4. add separate Style and Visibility sections only after a complete inventory of plot/style fields;
5. do not couple settings redesign to the deferred 318 community indicators.
