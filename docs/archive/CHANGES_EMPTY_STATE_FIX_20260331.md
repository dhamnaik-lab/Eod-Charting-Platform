Title: Empty-state alignment fix for no-data state (Windows portable baseline)

- Summary
  - Fixed rendering of the empty-state message when no OHLC bars are loaded so it renders inside the chart plotting area instead of starting at the left edge.
  - Change affects the empty-state path in the ChartEngine rendering pipeline only.

- What changed
  - File touched: src/engine/ChartEngine.ts
  - Change: In renderBase(), when bars.length === 0, the message is now drawn at x = axisWidth + 12 and y = 28 instead of fixed x = 16, y = 28.
  - This ensures the text stays within the inner chart bounds (left gutter reserved for axis) and remains fully visible.

- Validation
  - Local build passed: npm run build completed successfully (renderer + electron + typecheck).
  - No regressions observed for non-empty data paths in the chart rendering flow.

- How to test
  1) Run the portable Windows build as per project baseline.
  2) Open the app with no data loaded (or clear bars) to observe the empty-state message.
  3) Confirm the message is fully visible inside the plotting area and not overlapped by the left gutter or axis labels.

- Risks and notes
  - This is a minimal, targeted UI adjustment and should not impact crosshair, tool state, or pane layouts.
  - If font metrics differ on some environments, adjust the y offset slightly; the current values were chosen to align visually with the plot area.

- Next steps
  - If needed, iterate on typography or alignment margins to harmonize with other empty or partial data states.

Backup/provider note: A backup snapshot was prepared prior to changes. See repository backups for details.
