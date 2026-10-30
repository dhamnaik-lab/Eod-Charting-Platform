# EOD Platform Canonical Documentation Reconciliation — R1

IST timestamp: 2026-10-17_1846_IST

## Objective
Synchronize all eight current EOD Charting Platform status/reference documents after accepted P5-FINAL, P1/P2 authority, and CA native validation. Documentation-only; no new CA implementation or desktop acceptance.

## Previous limitation
Canonical documents prioritized October 15 P1–P3 plugin status and historical September CA handoffs; later accepted source/native evidence and stopped Sandbox sessions were not consistently reflected.

## Source and evidence authority
- Snapshot inspected only (not live source authority): Eod Charting Platform Source Code 2026-10-17_123645_IST.zip SHA256 A95C0A1150479C3B9BF3999CC27D473C9B079C521AC10319A03DF9F316A25BF2.
- Live source: eight accepted CA source POST hashes and four preservation anchors rechecked from original accepted toolkit SHA256 A90AD37664DEEF38F75263DEDB89EAB6419248EE926F39556628A307330CC6B5.
- P5-FINAL evidence SHA256 FDAE1A497E212545D58EB2743BE7BB98CB3B367EE7C2B8FBC4AF4C7EF8A190E9; external JavaScript stays disabled.
- P1/P2 3-file source reconstruction acceptance SHA256 4B97997A5B55DE5683D1170CDE6D95A034D403137283DDD1B9708D9D2E017A15.
- CA native acceptance SHA256 762203D79459BC2950DABDD29716A9DE2A9365A619408AC8B4E250E3A6148792: TypeScript typecheck, 62/62 Vitest, renderer build, 2/2 Rust tests, Cargo check and document references exit 0.
- Desktop attempt 1 SHA256 8A41ADAF68C9BF4A2DE775EBCF98DDF89C9A3E02371DDA7A5D6219B72248B8D7: offline release PASS, manual NOT VERIFIED (Sandbox missing VC runtime).
- Desktop attempt 2 SHA256 46D6BEA22CB1083A3C8BF578C3A575ADE5F7F73950349B56ABED999F9EF9AC5E: static-CRT release PASS and PE direct/delay import check PASS, manual NOT VERIFIED (Sandbox missing WebView2).

## Files changed, exact PRE and POST SHA256
- HANDOFF.md: PRE AD5A53890C0461343B73E2B4EF9626F9E4F7DD269CD0118886855B84847B9907; POST 92A39FEBB19592D0C1BE1CCE0A9D3815CEBD8D3C7E39B79FBEC9AA270FB82710
- PROJECT_STATE_EOD_CHARTING_PLATFORM.md: PRE CF34F9404490BBB10D70C80578DD48FE9880A60A04D9233A6091F0D71694549B; POST E4F67218CC674220914A7291E3132896D659E14D9354BF8F74DDA533B8237E90
- FILE_INVENTORY.md: PRE 04700029AE8A1D41FA46ED7B5824690D1D90AA4B1BE2523EDA13DD3CEAD55D0C; POST C8A423891C7F06D015655DCBD69D9C9F6A5AD617EEDFA96623C0541632F04A24
- ARCHITECTURE_CURRENT_EOD_CHARTING_PLATFORM.md: PRE DDDFA1BB11EDDAD8E10B081C53C9805E13506E3B17AF73F82D3903981566942F; POST B586971B5D46040D8241534D1BF5A0AD5C44B5708E19A239E8A8A916759C47E8
- FEATURE_STATUS_MATRIX_EOD_CHARTING_PLATFORM.md: PRE 746DA6C07306CE6C5FE9052CCA52621D17845B7B2A61083DF377E69336BB03E6; POST B6331EAFCC3ADD0374AC0B999C4182BE9237F1780DB8876104E210396D0A1FB2
- docs/CURRENT_WORK_STATUS.md: PRE C8D4CAF5BA2FA484C87B4AB2C3DB42FF5161EF395F15D2F81E06E22235B08464; POST 268C15C609D440FED4726A9DFFD3E7F074312077A397EB81DC6CDB742D8CC754
- README.md: PRE E9DC795F826AFE911D1BEB68E746F2D52E9C41E6886C2F5EF6A70DB2D9662216; POST 4F21F9A207C285CCE7AC5F65F1C044E892ACF69B004E08C61648B19177FC9560
- docs/architecture.md: PRE 8C965C581AED7ED84490ED137674F1402E528EAAD9E93BC64895C3F64CE1628F; POST 084F6C1FFD721934302B176E63E7BBE1E6726E7394513FFB4D3B1EDE261132FA
- CREATED: docs/changes/2026-10-17_1846_IST_EOD_CANONICAL_DOCS_P5_CA_NATIVE_STATUS_RECONCILIATION_R1.md.
- No production source, old evidence, build configuration, database, or historical change record modified.

## Final implementation and preserved behavior
Only additive, clearly marked current-status sections; prior historical content is retained verbatim.
Existing CA window, advanced tabs, dynamically adjusted price reads, raw EOD history, Rust ledger transactions, chart refresh contracts, P1/P2 and P5 identities and external JS disablement are preserved.

## Validation requirements/results
- Native read-only evidence/source admission: captured in task evidence.
- Standard scripts/create-project-backup.ps1: eight exact documents, backup manifest and pre-hashes checked.
- Guarded Node docs writer: pre/post SHA256 receipt and unchanged source authority checked.
- scripts/check-doc-references.ps1: native exit 0 mandatory; output receipt must accompany final evidence.
- No fresh renderer typecheck, Vitest, Rust tests or application build in this documentation-only checkpoint. Previous native PASS findings are cited, not rerun.

## Risks and untested items
Manual desktop CA acceptance, live exchange fetch, controlled approval, chart/cache refresh, and portable installer remain unverified. Production CA writes and unrestricted third-party JavaScript execution remain unauthorized. The prior Cargo check reported seven warnings.

## Rollback
Restore eight original docs from verified task-owned standard backup only when current hashes equal recorded PRE or POST. Delete only this new record if its hash matches the rollback receipt. Concurrent changes => STOP.

## Next decision
Close documentation reconciliation only after evidence verification. Normal desktop acceptance method requires a separately agreed scope; no forced Sandbox, new Windows account, or firewall redesign.
