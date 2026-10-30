# Stage 2A — Split/Bonus security and terms safeguards

## Subsequent native evidence and pause — 26 October 2026

See [the later CA checkpoint](2026-10-26_CA_PAUSE_DATABASE_PRIORITY_HANDOFF.md) for the user-run
16m28s validation, 4,288 persisted approvals, native exchange-filter observations,
and remaining progress/history defects. CA is now paused for the database issue.
The implementation/test receipts below remain historical; specific Stage 2A
blocker acceptance and unchanged native warm performance remain unverified.


Date: 26 October 2026 IST. Root: `E:\TA Projects\EOD Charting Platform`.

## Scope and behaviour

First authorized implementation slice only: prevent non-ordinary securities or
unsafe terms from becoming ordinary Split/Bonus adjustments through ratio parsing.
The shared parser serves NSE and BSE; the same negative rules apply to both,
without changing exchange identity mapping or claiming BSE operational acceptance.

- Debentures, preference shares (including NCRPS/CRPS/CCPS/OCPS), DVR distributions,
  and capital reduction mixed with Split/Bonus/consolidation remain NEEDS_REVIEW
  with a specific unsupported-security or restructuring reason and no factor.
- Different explicit ratios are not resolved by selecting the first. Invalid,
  non-finite and no-op ratios are rejected. When a split/consolidation states both
  a ratio and face values, the values must be unambiguous and consistent.
- Ordinary equity Bonus, Split, standalone consolidation/reverse split and the
  existing verified two-component Split + Bonus preparation remain supported.
  AGM + ordinary Bonus remains supported. This change does not expand the existing
  exactly-two-segment compound grammar to three-segment AGM/Split/Bonus text.
- Classification refresh removes eligibility from affected pending stored rows,
  including rows with manual identity provenance. It clears factor/price_factor,
  preserves identity fields, raw purpose, source evidence, original ratio/face-value
  metadata and manual decisions, appends the blocker, and records an audit decision.
  Existing identity blockers remain visible. Approved rows are untouched.
- Repeat refresh is idempotent. An audit failure rolls back the enclosing batch.
  Unsupported compounds cannot create companion rows.
- The approval writer independently rechecks the same rules, including for stale
  PARSED rows and identity/price exception paths. Preparation never creates a
  financial adjustment; explicit Approve Ready and all other writer checks remain.

This is a conservative negative gate, not complete semantic interpretation of
every possible announcement or a new security-specific adjustment policy.
No identity-reconciliation, duplicate-linking, Demerger policy, scheduling or
general incremental-workflow expansion is included.

## Files

- `corporate_action_imports/split_bonus_terms.rs`: shared pure negative gate.
- `corporate_action_imports.rs`: parser and final official-import writer checks.
- `corporate_action_imports/classification_refresh.rs`: pending-row revocation.
- `corporate_action_imports/split_bonus_preparation.rs`: whole-announcement gate
  before component separation (each component also passes the parser).
- `corporate_action_imports/dividend_validation_cache.rs`: includes the new guard
  in the transitive policy fingerprint. Existing checkpoints revalidate once;
  unchanged compatible results can be reused after fresh seeding.
- `corporate_action_imports/split_bonus_terms_tests.rs`: synthetic/disposable tests.

All Rust paths above are under `src-tauri-shell/src/database/`.
Handoff and file inventory record this slice. Existing dirty changes were retained.
Pre-edit backup: `backups/pre_opencode_changes_20261026_131739_ca_stage2a_terms`.

## Validation

All Rust commands used `cargo test --manifest-path src-tauri-shell/Cargo.toml`
with the following filters, run serially:

| Filter | Result |
| --- | --- |
| `stage2a_` | PASS — 8 tests |
| `classification_refresh::tests::` | PASS — 8 tests; 2 explicit copy audits ignored |
| `corporate_action_imports::tests::parser_guardrail_` | PASS — 6 tests |
| `corporate_action_imports::tests::parses_` | PASS — 8 tests |
| `corporate_action_imports::tests::phase6d_` | PASS — 6 tests |
| `dividend_incremental_` | PASS — 15 tests; scale benchmark ignored |

Total: 51 passing tests, 3 deliberately ignored. Disposable SQLite triggers reject
financial/identity-table writes; evidence/manual-history preservation, repeated
refresh, rollback, stale-writer rejection and a disposable raw-file sentinel are
covered. No production database or raw-price file was opened by these tests.

The initial focused run had 7 PASS / 1 FAIL: the new preservation test incorrectly
assumed an AGM/Split/Bonus three-segment announcement was already supported.
The fixture was corrected to the existing two-component contract; the final run
above is green. Compile/link took 52.16s initially and 40.05s after correction;
these are test-harness build times, not native workflow performance measurements.

PASS: `rustfmt --edition 2021 --check` on the two new Rust files; scoped
`git diff --check` on changed tracked files; trailing-whitespace checks on the
new/untracked Rust files and this report. No unrelated formatting was applied.

NOT RUN: full validation profiles, live Fetch/Load/approval, database migrations,
desktop build/package, native UI acceptance, commit or push. The user rebuilds.
After rebuild, check affected rows' blocker explanations and valid ordinary cases;
do not replay HEGAM/ICICIGI/HDBFS approvals. The backlog counts from the preceding
read-only census were not reclassified against live data during implementation.
