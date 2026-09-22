# SUPERSEDED — Quote Delete Orphan Symbol Prune V1

> **Superseded on 2026-08-09.** The runtime implementation no longer auto-prunes instrument identity when quotations are deleted. This document is retained only as historical change evidence.
>
> Current contract: Quotation Editor deletion removes quotation records/files only. Instrument/symbol catalogue identity remains untouched. Wrong-import symbol cleanup belongs to explicit Manual Import Recovery Sessions, where session provenance can prove which placeholder symbols are safe to remove.
>
> Current regression authority: `database::quotes::tests::test_delete_quote_range_keeps_instrument_when_last_quote_is_removed`.

---

## Historical proposal below — no longer active

# Quote Delete Orphan Symbol Prune V1

## Objective
Keep Quotation Editor deletion and the instrument catalogue consistent.

When a deletion removes the final quotation for an affected symbol, remove that `(symbol, exchange)` row from `instruments`. Preserve every symbol that still has a binary `.eod` file or SQLite price row.

## Current recovery
The mistaken BSE CSV import into NSE created Manual Import placeholder rows (`name=symbol`, `series=EQ`, no ISIN, no BSE security code). The November quote deletion removed their binary data, but the symbol rows remained.

An all-symbol deletion now also performs a narrow recovery sweep for that exact placeholder signature when it has no binary file and no SQLite prices. This allows the already-deleted November range to be rerun solely to clean the leftover BSE-created NSE symbols.

Official identity-only rows with a real name/ISIN/security code are excluded from this recovery sweep.

## Result contract
`DeleteQuoteResult` adds `prunedSymbols`. Quotation Editor and runtime logs report how many empty symbols were removed.

## Safety
- no symbol with remaining `.eod` history is pruned;
- no symbol with remaining SQLite price rows is pruned;
- no identity-history tables are deleted;
- Bhavcopy, Manual Import parsing, duplicate handling, binary format and worker settings are unchanged.

## Windows validation
```powershell
Set-Location "E:\TA Projects\EOD Charting Platform"

cargo test `
  --manifest-path ".\src-tauri-shell\Cargo.toml" `
  quotes `
  -- --nocapture

cargo check `
  --manifest-path ".\src-tauri-shell\Cargo.toml"

npm run typecheck:renderer
npm test
npm run build:renderer
npm run tauri:check
```

Then build:
```powershell
npm run tauri:portable:win
```

## Current database cleanup after build
Quotation Editor -> All Symbols / Date Tools -> NSE -> rerun `2023-11-01` through `2023-11-30`.

Expected when quotations are already gone:
```text
No matching quotes remained in the selected range. Removed <N> empty symbol(s).
```
