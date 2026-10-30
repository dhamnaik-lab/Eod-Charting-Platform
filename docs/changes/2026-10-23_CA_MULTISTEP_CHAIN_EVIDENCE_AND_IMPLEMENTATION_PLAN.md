# Multi-step historical identity: evidence and implementation boundary

Date: 23 October 2026. Project: `E:\TA Projects\EOD Charting Platform`.
Pre-documentation backup: `backups/pre_opencode_changes_20261023_220519_ca_multistep_chain_evidence`.

Follow-up: the user approved implementation after this evidence-only checkpoint. The separate contract is now implemented; see [runtime change and validation](2026-10-23_CA_DATED_SYMBOL_CHAIN_CONTRACT.md). The four real records still lack independent retained announcement evidence, so no new Ready claim follows from the rename CSV alone. The evidence-only status statements below describe this earlier checkpoint.

## Verified finding

The four remaining DELPHIFX Dividend imports (20928, 22118, 24836, 26670) have ex-dates in 2015–2018. The existing sealed event resolutions name EBIXFOREX and the 2021-09-01 transition to DELPHIFX. They do not represent the earlier change from WEIZFOREX to EBIXFOREX.

The configured [official NSE symbol-change CSV](https://nsearchives.nseindia.com/content/equities/symbolchange.csv) was successfully retrieved directly over HTTPS and parsed. It independently confirms:

| Old symbol | New symbol | Effective date | CSV line |
|---|---|---|---:|
| WEIZFOREX | EBIXFOREX | 2020-03-20 | 180 |
| EBIXFOREX | DELPHIFX | 2021-09-01 | 181 |

All four event dates precede the first change, so their date-appropriate symbol in this chain is WEIZFOREX. This establishes the symbol chronology, not an ISIN validity interval or Dividend eligibility.

The old recorded raw CSV path (`E:\TA Projects\Corporate Actions Raw\NSE\Identity\SymbolChanges\nse_identity_symbol_changes.csv`) does not exist on this machine. The new source SHA-256 is `b080e538a5c3c8b5cc1fd048768b2b660c880cc38b3c2bafc7c0f1b2f983566e`; the prior sealed source SHA-256 is `921bd8679e7dff909b12efd152fe64b91a26b124976e919f120a2de1db3221e6`. The new file must not be silently substituted into the old sealed authority.

Collected evidence is retained in `tmp/ca-multistep-chain-evidence-20261023/symbolchange.csv` and `evidence-manifest.json`. The manifest records retrieval time, URL, exact bytes/hash, source lines, chain edges and affected import tuples. It is explicitly diagnostic and grants no runtime eligibility.

## Current implementation boundary

The existing verified-pair fix still recovers 35 Pending records only on its earlier disposable copy. The source database still has 7,847 Parsed/Pending Dividend candidates. No source records, sealed resolutions, price files, financial approvals or runtime source code were changed in this task.

The proof format and approval-policy reader currently recognize exact event-date evidence and sealed one-step resolutions. Supporting a new, independently retrieved, multi-step chain requires a new proof contract and provenance path. Extending the two-proof exception to arbitrary connected symbols would bypass those boundaries. The supplied Global Codex instructions require stopping before a risky or major-architecture edit and reporting the concrete change instead; this task therefore stops at verified evidence and the scoped proposal below.

## Proposed implementation scope

1. **Official evidence collection during Fetch.** Reuse the official URL validation, downloader and symbol-change parser in `database/nse_identity_imports.rs` and `official_source_urls.rs`. Collect and validate source bytes before writing; retain a versioned local snapshot and its URL/hash/capture metadata. Load & Validate must remain usable offline and must report missing source evidence without requesting an operator identity choice.
2. **Separate multi-step identity proof.** Add a focused module under `database/corporate_action_imports/` that resolves a unique dated rename path from retained official source rows. Do not alter the existing 184-candidate sealed authority or manufacture `instrument_isin_history` intervals. Establish the symbol valid on the event date and require independent exact ISIN evidence for that event as well as the current target checks.
3. **Persist and recheck provenance.** Bind the new proof to the database context, exact import ID/exchange/raw symbol/raw ISIN/ex-date/action type, unique current target, dated chain edges, source hash and source line references. Every consuming reader must independently verify this evidence; a stored decision string alone must not grant authority.
4. **Use normal preparation and policy.** Integrate with `identity_recheck.rs`, the normal preparation orchestration, and the existing strict resolver. The Dividend R1 reader in `auto_approval.rs` must explicitly recognize and revalidate the new proof. Source identity stays unchanged; only proven metadata may return to Pending. Normal official-source, cash, EOD, peer, canonical-action and explicit approval checks remain mandatory.
5. **Focused validation before rebuild.** Cover multi-hop dates and exact transition boundaries; branching, cycles and contradictory dates; multiple current targets; missing/changed/tampered source bytes; import/database drift; forbidden financial writes; and same-date peer checks. Run the production metadata reconciliation and read-only Dividend evaluation against a newly marked disposable copy, with financial/source-identity write guards. Report Pending and Ready separately. No production approval or rebuild is implicit in the implementation.

Likely touched seams: `corporate_action_imports.rs`, a new focused chain-proof module, the existing identity recheck and Dividend policy reader, `nse_identity_imports.rs` for source collection/provenance reuse, and the normal preparation/Fetch adapter only if needed. Any schema or renderer/platform contract additions must be made explicit in the implementation diff and kept minimal.

## Checks and limits

- PASS: live official CSV parsed; both dated edges and four pre-transition events reconciled diagnostically.
- PASS: saved source hash verified against manifest; source candidate count remains 7,847.
- PASS: runtime files match the pre-documentation backup; scoped documentation whitespace checks.
- Runtime tests/builds were not needed or run because this task changed documentation/evidence only.
- The earlier three-thousand-plus stored-history group is not automatically recovered by these two rename rows. Broad historical ISIN collection remains separate evidence work.
