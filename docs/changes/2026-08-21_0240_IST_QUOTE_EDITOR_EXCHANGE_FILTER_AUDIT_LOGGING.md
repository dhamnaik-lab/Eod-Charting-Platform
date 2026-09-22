# Quote Editor Exchange Filter + Audit Logging

Date: 2026-08-21 02:40 IST

## Scope

This bounded change replaces the Quote Editor's manually typed exchange field with a controlled exchange filter and extends the existing Quote Editor runtime audit trail. It is independent of Bhavcopy V1.4 and does not change the canonical `.eod` format, recovery/checkpoint behavior, Corporate Action behavior, or sidecar publication.

## Exchange filter

The Quote Editor exchange selector exposes exactly:

- `ALL` (default when entering **All Symbols / Date Tools**)
- `NSE`
- `NSE-INDEX` (`NSE_INDEX` internally)
- `BSE`
- `BSE-INDEX` (`BSE_INDEX` internally)
- `MCX`

`MCX` is intentionally present for future storage support. Until MCX data exists, the current storage lookup returns no rows and does not fall through to another exchange.

For **All Symbols / Date Tools**, `ALL` loads the bounded five-exchange scope and preserves each row's exchange identity. The table adds an **Exchange** column only while `ALL` is active.

For write safety, `ALL` is not itself a writable exchange. A Save operation while `ALL` is selected requires a row with a concrete exchange identity; otherwise the user must choose a concrete exchange. Single-symbol load/delete likewise requires a concrete exchange.

## Broad delete safety

`ALL` date/date-range deletion presents an explicit confirmation listing NSE, NSE-INDEX, BSE, BSE-INDEX, and MCX. The backend executes the bounded scope exchange-by-exchange and reports per-exchange deleted counts. Progress for an ALL-scope binary delete is aggregated across the bounded exchange directories.

Quotation deletion remains quote-only: deleting the last quote does not delete instrument identity.

## Audit logging

Existing `quote-save-*` and `quote-delete-*` events are preserved. New load events are added:

- `quote-load-start`
- `quote-load-complete`
- `quote-load-failed`

Load details include operation kind, exchange scope, symbol/date when applicable, row count, elapsed time, and failure text.

For `ALL` deletion, `quote-delete-complete` additionally includes `exchangeDeleted=NSE:<n>,NSE_INDEX:<n>,BSE:<n>,BSE_INDEX:<n>,MCX:<n>`.

## TDD evidence

The separate RED gate was executed before this implementation. It proved both missing seams:

- renderer test failed because `quoteEditorExchangeScope` did not exist;
- Rust tests failed because `quote_editor_exchange_targets`, `list_quotes_by_date_scope_internal`, and `delete_quote_date_scope_internal` did not exist.

The RED gate then restored `quotes.rs` exactly and removed the temporary renderer test before GREEN implementation.

## Validation gates

The GREEN package runs focused renderer helper tests, focused Rust exchange-scope tests, focused audit-format tests, existing binary Quote Editor delete regressions, renderer typecheck/build, and Tauri/Rust compile check. All real data files and the EOD binary state sidecar remain untouched by validation.
