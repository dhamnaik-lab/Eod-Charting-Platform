# Unified Corporate Actions operator acceptance

**12 November 2026, 00:57 IST.** Follow-up to the [implementation record](2026-11-12_0030_IST_CORPORATE_ACTIONS_UNIFIED_UI.md) and [feature-parity matrix](CORPORATE_ACTIONS_UNIFIED_UI_PARITY.md). The checks reused the existing shared-target debug executable, SHA-256 `6F3A0573795E7F267C5B77C06CF8BED9BFAA8D4F27C9948D66C49FB77F468755`. Each run verified its active database path and used a fresh SQLite fixture, application profile and WebView2 profile under `tmp/fixtures/ca-unified-ui-20261112/`.

| Operator check | Observed result |
| --- | --- |
| Official acquisition | The Actions window completed one separate NSE and BSE fetch for 1 August 2025. Exchange responses went to fixture staging and produced zero approvals. |
| Historical identity | Native BSE company-name history applied one reviewed change. Native NSE historical identity applied one combined symbol/name change and saved its run receipt. Before confirmation both receipt lists were empty. |
| Source recovery | The real NSE rollback API revalidated the historical source and restored the prior URL in a new revision. A separate UI pass reached the same operation through Source diagnostics and replacement review. The fixture supplied Cancel and Confirm to the existing browser prompt. Cancel preserved the test URL, and Confirm restored the historical URL. |
| Reconciliation exports | The actual Windows save dialogs wrote CSV and TXT to the fixture directory. Both files contained the selected Bonus diagnostic row. |
| Specialist issue resolution | A synthetic unresolved NSE import went through Recheck Selected and the manual match workbench. The reviewed match persisted on the selected import and remained unapproved. |
| Backfill | The one-symbol RELIANCE batch for 1 August 2025 reached `COMPLETED` with one checked symbol, zero failures and zero new review rows. |
| Approval and chart refresh | The fixture Bonus remained unapproved when the confirmation was canceled. Confirming it saved one approval and refreshed the same active chart tab. The pre-event adjusted close changed from 200 to 100 while the raw close stayed 200. |

Commands passed on the existing executable. `node --check tmp/fixtures/ca-unified-ui-20261112/native-operator.mjs` checked the runner syntax. The runner passed in normal, `--network`, and `--exports` modes. The Windows dialog helper also passed PowerShell parsing. No application source, live database, release or portable artifact was changed. The debug app wrote routine runtime logs to its existing log location.

The retained evidence includes `operator-results.txt`, `operator-network-results.txt`, `operator-export-results.txt`, and the captured screen and CSV/TXT files. The terminal backfill receipt is `operator-1794425205940/backfill-run.json`. The network result SHA-256 is `D19F095C94BF32B3BCF7D2804E01CC7ECAB1F0B97C7A7E1216FDC6D6D96FCDBB`.

Acceptance covered the tested date, exchange requests and fixture records. Native confirmation for financial approval was exercised in the renderer. The rollback prompt answers were supplied by the fixture. Financial execution covered a matched Bonus. Other financial and exception branches retain their implementation regression coverage. Portable operator acceptance remains separate.

## Portable build status

**Observed 12 November 2026 at 10:43 IST.** The staged executable at `release/tauri-portable-win/EOD Chart Portable/EOD Chart.exe` contains embedded build number `20261112.010220` and build timestamp `2026-11-12T01:02:20+05:30`. The package README records staging at 01:05:21 IST. The portable and `target/release/eod-charting-platform-shell.exe` SHA-256 values both equal `E394B27E3675BD63348311DE0EDB10ACE79D1866B783B0BE0ACC00614BC51FC4`. The packaged renderer asset contains the unified managed window.

These checks establish artifact identity. The acceptance results above apply to the debug executable. The next checkpoint is to run the staged portable executable against a disposable fixture and record its observed behavior.
