# Security / Listing / Price-Stream V2 Implementation Plan R1

**Status:** APPROVED PLAN / IMPLEMENTATION NOT STARTED  
**Phase at freeze:** V2-P0 complete only after documentation installer/audit acceptance  
**Scope:** NSE + BSE + NSE_INDEX + BSE_INDEX


## V2-P0 authority binding

- Freeze date: **2026-09-07 IST**.
- Source snapshot: `Eod Charting Platform Source Code 2026-09-06_161742_IST.zip`.
- Source snapshot SHA-256: `1E45A2F8CF8D0C69ABA1E4813B46018EA57ED72A8D9F0191DAA1F0F2056539A0`.
- R2 test-clone post-runtime evidence ZIP SHA-256: `0992F1DDBA3CA33181FB916020D1738761AB5000D127DD037A8A3AF96E557DF5`.
- R3 NSE source-series forensic evidence ZIP SHA-256: `403E75701DA18EBB662E8D600192F83EF7019E12BE1F59F512E8ADFC176548E4`.
- Production implementation status: **NOT STARTED**.
- Current production authority remains **EOD1 + Generation 6 + current SQLite schema/identity model** until a later explicitly approved V2 promotion phase.


## Operating rules

Every implementation phase must:

- restate Goal / Scope / Constraints / Project path / files inspected first;
- bind the current accepted V2 documents and relevant source hashes;
- use the newest confirmed source, not an older ZIP by assumption;
- preserve current working behavior unless the phase explicitly changes it;
- use TDD RED -> GREEN for behavior changes;
- use private/temp databases and EOD roots for destructive/migration testing;
- make no Git operation unless separately authorized;
- retain current EOD1/Generation-6 rollback authority until explicit promotion.

## V2-P0 — Architecture authority freeze

**Mode:** documentation only.  
**Deliverables:** four principal V2 documents, ADR-001 through ADR-006, canonical-doc future-architecture markers, evidence binding.  
**Writes allowed:** documentation and external audit evidence only.  
**Implementation:** NOT STARTED.

Acceptance:

- exact 2026-09-06 source snapshot bound;
- R2/R3 hashes and findings bound;
- NSE/BSE first-class scope frozen;
- Index series=N/A invariant frozen;
- current production authority explicitly unchanged.

## V2-P1 — Read-only identity/collision inventory

**Goal:** quantify current NSE/BSE/Index identity ambiguity before adding schema.

Inspect/read only:

- current instrument/identity tables;
- current EOD1 census/state;
- NSE Series and BSE Group distributions;
- symbol->ISIN/security-code multiplicity;
- same-symbol/same-date collision evidence where source data is available;
- index null-series population.

No source or data mutation. Produce migration-class counts and exact high-risk cases.

## V2-P2 — Shadow catalog/schema foundation

Add V2 schema/types behind a non-production/shadow boundary:

- Security;
- identifiers/history;
- Listing;
- symbol/lifecycle history;
- effective-dated exchange classification;
- Price Stream;
- resolution/evidence status.

No production reader/writer switch. Tests use temp DBs.

## V2-P3 — NSE + BSE identity resolver

Implement exchange-specific resolver logic and conflict codes.

Required focused tests include:

- APOLLOTYRE same ISIN normal+block -> one Security/two Streams;
- KRT/NXST RR+BL -> one Security/two Streams;
- IMC1 N1/N2/N3 distinct ISIN -> distinct Securities;
- ordinary NSE Series lifecycle -> one NORMAL stream;
- BSE security-code compatible identity -> stable Listing;
- BSE security-code/ISIN conflict -> fail closed;
- cross-exchange symbol-only match -> no merge;
- official dated identity bridge -> controlled continuity.

## V2-P4 — Index semantics and Sidebar contract

Implement the semantic model first in tests/shadow paths:

- Index Security Type;
- `series=NULL` / N/A applicability;
- Series/Group filter does not exclude Index;
- unknown normal-security classification remains distinguishable from Index;
- NSE and BSE family filtering preserved.

No broad UI redesign.

## V2-P5 — EOD2 writer/reader + V2 state index

Tempdir/private only initially.

Implement:

- EOD2 header/record contract;
- `price_stream_id` path;
- stream-keyed sidecar;
- integrity/census checks;
- durability/recovery parity;
- 2/4/2 policy preservation unless separately approved.

## V2-P6 — Shadow migration engine

Implement EOD1 classification/migration on disposable/private copies:

- cheap `UNAMBIGUOUS` payload-preserving conversion;
- `INDEX` conversion;
- quarantine `UNKNOWN_IDENTITY`;
- source-driven rebuild path for multi-stream/multi-security cases;
- permanent migration evidence map;
- no in-place V1 mutation.

## V2-P7 — Bhavcopy V2 shadow write

Keep legacy production write authoritative while optionally producing private/shadow V2 output from the same staged official rows.

Require:

- exact resolved stream before write;
- residual same-stream collision fail-closed;
- no change to legacy recovery/durability semantics;
- row/result comparison between current output and intended V2 streams.

## V2-P8 — Symbol Search / Sidebar V2 read path

Introduce stream-aware descriptors and filters behind controlled acceptance:

- Security Type filter;
- NSE Series filter;
- BSE Group/classification filter;
- Index bypass of Series/Group filtering;
- compact display of symbol + type + applicable classification;
- no duplicate/ambiguous symbol collapse.

## V2-P9 — Chart / Quote Editor / Watchlist / Workspace identity

Move runtime references from `exchange+symbol` to exact IDs where required.

- chart tabs bind `price_stream_id`;
- Quote Editor edits exact stream;
- watchlists migrate deterministic legacy references;
- ambiguous legacy references require user resolution;
- workspace migration is reversible/tested.

## V2-P10 — Corporate Action Security integration

Bind CA economic identity to `security_id` while preserving existing approval/review rules.

Require regression proving:

- same Security across NSE/BSE can share CA identity when officially resolved;
- multiple streams do not duplicate CA events;
- same-symbol conflicting ISIN Securities do not share CA identity;
- current CA raw evidence/approval boundaries remain intact.

## V2-P11 — Full private-clone runtime acceptance

Run end-to-end on a private clone with:

- NSE;
- BSE;
- NSE_INDEX;
- BSE_INDEX;
- broad security types/classifications;
- normal and special market-stream examples;
- Quote Editor/Search/Sidebar/chart/workspace/watchlist/CA regression.

Require clean V2 state parity, zero unresolved canonical-write collisions, and unchanged V1 authority hashes during shadow acceptance.

## V2-P12 — Promotion decision

Promotion is a separate explicit approval. It must include:

- final migration report;
- rollback plan;
- production database backup/authority binding;
- reader/writer switch plan;
- post-promotion audit;
- documentation authority update from “future” to “current.”

No P0-P11 phase may imply automatic P12 approval.

## Deferred/parallel issues

These remain separately governed unless deliberately folded into a phase:

- current manual Date Range future-date planner defect;
- stale AGENTS 4-worker wording versus current 2/4/2 source policy;
- actual production one-row Generation-6 state gap;
- actual BSE historical catch-up completeness;
- unrelated Corporate Action, UI layout, Gann, or Git work.

## Definition of V2 implementation start

Implementation starts only when V2-P1 or later is explicitly approved after V2-P0 documentation freeze acceptance. The existence of this plan alone is **not** implementation.
