# Classic CA visual QA — 23 October 2026

**Result: PASS for the approved layout direction, with minor visual differences.** Native desktop acceptance remains pending rebuild. Documentation is in Docs as requested by the user.

Reference: [approved image](assets/ca-classic-20261023/approved-mockup.png).
Implementation: [wide screenshot](assets/ca-classic-20261023/implemented-1586x992.png).
Combined comparison: [reference and implementation together](assets/ca-classic-20261023/visual-comparison.png).

The combined comparison was inspected as one image. The implementation preserves the reference's compact classic menus, two toolbars, full-height seven-column list, restrained blue header/selection treatment and slim status bar. Twenty-four sample events fit in the wide view. Reports and diagnostic text do not occupy expanding sections above the list.

## Severity review

- **P1/P2: none observed in the inspected presentation.** Existing eligibility authority and explicit confirmation remain separate from display grouping and selection.
- **P3:** text commands omit decorative toolbar icons/status dots in the concept. Readable status labels and Ready/Needs review colors remain. Existing FloatingWindow title controls are preserved.
- **P3:** numeric symbol sorting, sample dates, records and some column proportions differ from the generated concept; these are deliberate working-table behaviors, not missing rows.
- **P3:** at minimum size, columns and filters scroll horizontally to preserve readable text and the fixed two-row toolbar. No claim of a phone-sized layout is made.

## Interaction evidence

- Search restricts the displayed events and approval scope; preview confirmation showed only IDs 5 and 17 for BAJFINANCE.
- Non-Ready rows have disabled selection. A blocked component cannot make a compound event Ready.
- Reports open in an overlay; Escape closes it. Dialogs trap focus and restore prior focus on close.
- Wide details use a 320px inspector, preserving table height; narrow details use a modal.
- Synthetic 32,000-row queue remained virtualized and bulk selection completed. This is not a timing benchmark of Load & Validate.
- Source code review confirms existing advanced tools remain reachable through Tools and the legacy advanced review surface.

Screenshots use sample data and the actual new React components within FloatingWindow. The full native parent window, official feed and database approval/refresh flow require rebuilt desktop verification. No screenshot or fixture is evidence that real financial actions were approved.
