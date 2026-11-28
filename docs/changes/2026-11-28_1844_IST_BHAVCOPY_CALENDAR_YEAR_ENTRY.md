# Bhavcopy calendar year entry

28 November 2026, IST

The desktop screenshot showed that opening the calendar put a focus ring and selection highlight on the Year field. The previous implementation also used each partial value as the current year immediately, so the day grid could jump while the operator typed.

The popup now receives focus on open. Selecting the Year field highlights its value for replacement. The month grid remains on the last applied year until four valid digits are entered or Enter applies a valid year. Up and Down step one year, and an abandoned draft restores the applied value on blur. The compact popup and day-first fields retain their layout.

The Windows Chrome fixture verifies initial focus, stable partial and invalid entry, direct jump to 1986, year stepping, date selection, future limits and dismissal. Fixture capture and results are under `tmp/fixtures/bhavcopy-year-entry`. A portable rebuild and native WebView2 acceptance remain pending. Pre-edit backup `backups/pre_opencode_changes_20261128_184414_bhavcopy-year-entry`.
