# Quote Editor Display + ALL Load-Count Patch REV2

Date: 2026-08-21

## Source basis

This revision is rebuilt from the exact installed renderer capture:

`quote-editor-display-all-load-count-rev2-current-source_20260821_141706.zip`

SHA-256:

`C5F999983346E7970E00DCD89A737ED1E87A4E578429A22D58111D3927B8B779`

The earlier Rev1 package stopped at its source guard before any write because its reconstructed `DatabaseToolsDialogs.tsx` identity did not match the installed file. Rev2 does not weaken that guard; it uses the exact installed hashes captured after the rejection.

## Scope

Renderer-only follow-up to Quote Editor Exchange Filter + Audit Logging.

- Prevent long ticker/index symbols from visually overlapping the Exchange column.
- Preserve full ticker/exchange text in hover titles while clipping table cells with ellipsis.
- Give the ticker column more minimum width in the ALL view.
- After a successful ALL date load, show bounded per-exchange row counts for NSE, NSE-INDEX, BSE, BSE-INDEX, and MCX.
- Missing exchanges remain explicitly zero, allowing verification that previously deleted NSE_INDEX data is absent.

No backend command, Quote Editor delete semantic, Bhavcopy source, SQLite schema, `.eod` format, state-sidecar publication, or Git state is changed.

## TDD

RED installs two focused tests on the exact current helper:

1. table-cell containment style must exist;
2. ALL exchange count/summary helpers must exist and return the bounded counts.

Because the exact current helper lacks these seams, RED must fail through normal Vitest assertions while the four existing exchange-scope tests continue to load. GREEN installs the minimal implementation and reruns all six focused tests.
