# Bhavcopy compact Date Range picker

28 November 2026, IST

Implemented the approved narrower fields and compact floating calendar. Start and End display and accept `DD-MM-YYYY` by default. The calendar glyph is inside the field. Complete ISO input remains accepted and displays in day-first order. The download command still receives normalized ISO dates.

The 224 px calendar overlays the settings panel and follows its field when the panel scrolls. It opens above the field when space below is insufficient. The calendar retains month selection, direct year entry, future-date guards, and keyboard dismissal. The selected day uses the theme's accent contrast token.

Renderer typecheck and 35 focused tests passed. The isolated Windows Chrome fixture verified weekday and date display, field and popup dimensions, icon placement, anchoring, no layout shift, the January 1986 jump, date selection, future limits and dismissal. The captured layout is `tmp/fixtures/bhavcopy-compact-date-picker/preview.png`. Native WebView2 acceptance and portable rebuild remain pending.

Pre-edit backup `backups/pre_opencode_changes_20261128_165923_bhavcopy-compact-date-picker` includes the existing picker source, test, and trackers.
