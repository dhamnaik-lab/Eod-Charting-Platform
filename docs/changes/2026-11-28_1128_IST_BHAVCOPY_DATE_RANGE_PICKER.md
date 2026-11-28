# Bhavcopy Date Range picker

28 November 2026, IST

The BHAV-BOUNDARY-01 portable retained the native WebView date picker. This renderer follow-up replaces the two Bhavcopy Date Range controls with editable date fields and an inline calendar. Type YYYY-MM-DD or DD-MM-YYYY, or select **Pick**, enter a year, choose a month and select a day. Escape closes the calendar and returns focus to its button.

The renderer sends normalized ISO dates to the existing download command. Invalid dates, reversed ranges and future dates are rejected before the command runs. The Market Holiday controls and Bhavcopy backend are outside this change.

Renderer typecheck and 34 focused tests passed. An isolated headless Chrome fixture exercised direct typing, a jump to January 1986, day selection, future-date limits and Escape focus return. Fixture output is under `tmp/fixtures/bhavcopy-date-picker`. Native WebView2 acceptance remains pending and requires a portable rebuild.

Pre-edit backup `backups/pre_opencode_changes_20261128_112829_bhavcopy-date-picker` includes the dirty BHAV-BOUNDARY-01 renderer and tracker versions.
