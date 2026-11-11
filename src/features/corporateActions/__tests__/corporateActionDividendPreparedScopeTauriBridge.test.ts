import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

// Top-level Rust items in this source end with an unindented closing brace.
// Require a unique command and reject a slice that reaches another top-level item.
function preparedScopeCommand(source: string): string {
  const normalized = source.replace(/\r\n/g, '\n');
  const signature = 'pub async fn evaluate_simple_cash_dividend_prepared_scope(';
  assert.equal(normalized.split(signature).length - 1, 1, 'P3A command must be unique');
  const match = /^pub async fn evaluate_simple_cash_dividend_prepared_scope\([\s\S]*?^\}/m.exec(normalized);
  assert.ok(match, 'P3A command closing boundary is missing');
  const body = match[0];
  assert.doesNotMatch(
    body.slice(signature.length),
    /^(?:#\[|(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s|mod\s)/m,
    'P3A command slice must not include a neighboring top-level item',
  );
  return body;
}

describe('Dividend prepared-scope P3A read-only Tauri bridge', () => {
  it('defines camelCase public input, evidence, disposition and result DTOs', () => {
    const rust = read('src-tauri-shell/src/database.rs');
    assert.match(rust, /struct CorporateActionDividendPreparedScopeEvaluationInput/);
    assert.match(rust, /struct CorporateActionDividendPreparedScopeEvaluationEvidence/);
    assert.match(rust, /struct CorporateActionDividendPreparedScopeEvaluationDisposition/);
    assert.match(rust, /struct CorporateActionDividendPreparedScopeEvaluationResult/);
    assert.match(rust, /#\[serde\(rename_all = "camelCase"\)\]/);
    assert.match(rust, /pub scope_version: String/);
    assert.match(rust, /pub scope_fingerprint: String/);
  });

  it('matches the public TypeScript bridge contract and allowed dispositions', () => {
    const desktop = read('src/types/desktop.ts');
    for (const name of [
      'CorporateActionDividendPreparedScopeEvaluationInput',
      'CorporateActionDividendPreparedScopeEvaluationEvidence',
      'CorporateActionDividendPreparedScopeEvaluationDisposition',
      'CorporateActionDividendPreparedScopeEvaluationResult',
    ]) {
      assert.match(desktop, new RegExp(`export interface ${name}`));
    }
    for (const disposition of [
      'ELIGIBLE',
      'INELIGIBLE',
      'ALREADY_APPROVED',
      'STALE_SCOPE',
      'MISSING',
      'FAILED',
    ]) {
      assert.match(desktop, new RegExp(`'${disposition}'`));
    }
    assert.match(
      desktop,
      /evaluateSimpleCashDividendPreparedScope\([\s\S]*CorporateActionDividendPreparedScopeEvaluationInput[\s\S]*Promise<CorporateActionDividendPreparedScopeEvaluationResult>/,
    );
  });

  it('exports the method through DesktopApi and invokes exactly the read-only command name', () => {
    const platform = read('src/platform/types.ts');
    const tauri = read('src/platform/tauriDesktop.ts');
    assert.match(platform, /\| 'evaluateSimpleCashDividendPreparedScope'/);
    assert.match(
      tauri,
      /evaluateSimpleCashDividendPreparedScope: async \(input\) => \{[\s\S]*tauriInvoke\('evaluate_simple_cash_dividend_prepared_scope', \{ input \}\)/,
    );
  });

  it('registers the dedicated command without routing through Safe V2 approval', () => {
    const main = read('src-tauri-shell/src/main.rs');
    assert.match(main, /evaluate_simple_cash_dividend_prepared_scope,/);
    assert.match(main, /auto_approve_corporate_action_imports,/);
  });

  it('uses exact-ID and database binding plus the shared automatic price-store fence', () => {
    const source = read('src-tauri-shell/src/database/corporate_action_imports.rs');
    const body = preparedScopeCommand(source);
    assert.match(body, /validate_exact_import_lookup_ids\(&input\.import_ids\)/);
    assert.match(body, /verify_import_lookup_database\(&folder_path, &input\.expected_database_path\)/);
    assert.match(body, /PriceStoreOperationKind::CorporateActionAutomatic/);
  });

  it('delegates diagnostic persistence while preserving the read-only policy and financial boundary', () => {
    const source = read('src-tauri-shell/src/database/corporate_action_imports.rs');
    const body = preparedScopeCommand(source);
    assert.match(body, /dividend_validation_cache::open_connection\(&folder_path\)/);
    assert.match(body, /dividend_validation_cache::evaluate/);
    const cache = read('src-tauri-shell/src/database/corporate_action_imports/dividend_validation_cache.rs');
    assert.match(cache, /evaluate_simple_cash_dividend_prepared_scope_in_connection/);
    assert.doesNotMatch(cache, /approve_corporate_action_import_without_transaction\(/);
    assert.doesNotMatch(body, /run_connection_transaction\(/);
    assert.doesNotMatch(body, /invalidate_cached_db_stats\(/);
    assert.doesNotMatch(body, /emit_database_changed\(/);
    assert.doesNotMatch(body, /approve_corporate_action_import_without_transaction\(/);
    assert.doesNotMatch(body, /record_corporate_action_import_decision\(/);
  });

  it('maps every P2 field explicitly and injects the exact scope version', () => {
    const source = read('src-tauri-shell/src/database/corporate_action_imports.rs');
    const start = source.indexOf('fn map_simple_cash_dividend_prepared_scope_result(');
    const end = source.indexOf('/// Diagnostic checkpoint owner;', start);
    const body = source.slice(start, end);
    for (const field of [
      'requested',
      'eligible',
      'ineligible',
      'already_approved',
      'stale_scope',
      'missing',
      'failed',
      'dispositions',
      'policy_version',
      'scope_fingerprint',
      'complete',
      'message',
      'identity_proof',
      'official_evidence_id',
      'evidence_captured_at',
      'source_locator',
      'cash_amount',
      'previous_trade_date',
      'previous_close',
      'computed_factor',
    ]) {
      assert.match(body, new RegExp(field));
    }
    assert.match(body, /SIMPLE_CASH_DIVIDEND_PREPARED_SCOPE_VERSION/);
  });

  it('pins the Dividend policy after transaction-local peer-read reuse', () => {
    // The policy body matches the pre-edit backup apart from the peer reader;
    // the standalone/financial path passes no cache. Pin the reviewed wrapper too.
    // Whole-module byte pins predate the accepted routing/provenance changes.
    const source = read('src-tauri-shell/src/database/corporate_action_imports/auto_approval.rs').replace(/\r\n/g, '\n');
    const policy = /^pub\(super\) fn evaluate_simple_cash_dividend_policy_r1\([\s\S]*?(?=^pub\(super\) fn evaluate_simple_cash_dividend_prepared_scope_in_connection)/m.exec(source)?.[0];
    assert.ok(policy);
    assert.equal(createHash('sha256').update(policy).digest('hex').toUpperCase(),
      'B5669BE34AD42B47BC55641D641FE315EAC29B2490A5EC23E2263A52240B6EBB');
  });

  it('does not add a frontend orchestration caller in P3A', () => {
    assert.doesNotMatch(
      read('src/features/corporateActions/legacy/corporateActionImportOperations.ts'),
      /evaluateSimpleCashDividendPreparedScope/,
    );
    assert.doesNotMatch(
      read('src/components/DatabaseToolsDialogs.tsx'),
      /evaluateSimpleCashDividendPreparedScope/,
    );
  });
});
