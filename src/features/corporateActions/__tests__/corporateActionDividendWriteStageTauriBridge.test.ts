import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

function interfaceBody(source: string, name: string): string {
  const match = new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`).exec(source);
  assert.ok(match, `missing interface ${name}`);
  return match[1];
}

function methodBody(source: string): string {
  const start = source.indexOf('executeSimpleCashDividendWriteStage: async (input) => {');
  assert.ok(start >= 0, 'missing write-stage Tauri method');
  const end = source.indexOf('\n    },', start);
  assert.ok(end > start, 'write-stage method boundary missing');
  return source.slice(start, end);
}

describe('Dividend write-stage typed transport contract', () => {
  it('defines exactly six public input fields without eligibility assertions', () => {
    const body = interfaceBody(read('src/types/desktop.ts'), 'CorporateActionDividendWriteStageInput');
    for (const field of [
      'importIds: number[];', 'expectedDatabasePath: string;',
      'expectedPolicyVersion: string;', 'expectedScopeVersion: string;',
      'expectedWriteStageVersion: string;', 'expectedScopeFingerprint: string;',
    ]) {
      assert.ok(body.includes(field), `missing field ${field}`);
    }
    assert.equal(body.split(';').filter((part) => part.trim()).length, 6);
    assert.doesNotMatch(body, /eligible|evidence|cashAmount|computedFactor|clientDecision/i);
  });

  it('defines the six permitted disposition codes', () => {
    const ts = read('src/types/desktop.ts');
    const match = /export type CorporateActionDividendWriteStageDispositionCode =([\s\S]*?);/.exec(ts);
    assert.ok(match);
    const values = Array.from(match[1].matchAll(/'([A-Z_]+)'/g), (item) => item[1]);
    assert.deepEqual(values, [
      'AUTO_APPROVED', 'INELIGIBLE', 'ALREADY_APPROVED', 'STALE_SCOPE', 'MISSING', 'FAILED',
    ]);
  });

  it('defines all result fields and nullable corporateActionId', () => {
    const ts = read('src/types/desktop.ts');
    const result = interfaceBody(ts, 'CorporateActionDividendWriteStageResult');
    for (const name of [
      'requested', 'revalidatedEligible', 'autoApproved', 'ineligible', 'alreadyApproved',
      'staleScope', 'missing', 'failed', 'dispositions', 'policyVersion', 'scopeVersion',
      'writeStageVersion', 'scopeFingerprint', 'complete', 'message',
    ]) {
      assert.ok(result.includes(`${name}:`), `missing result field ${name}`);
    }
    assert.match(interfaceBody(ts, 'CorporateActionDividendWriteStageDisposition'), /corporateActionId: number \| null;/);
  });

  it('exposes the typed method on DesktopBridgeApi', () => {
    const ts = read('src/types/desktop.ts');
    assert.match(ts, /executeSimpleCashDividendWriteStage\([\s\S]*?CorporateActionDividendWriteStageInput[\s\S]*?Promise<CorporateActionDividendWriteStageResult>/);
  });

  it('exports all DTOs and adds platform capability', () => {
    const ts = read('src/platform/types.ts');
    for (const name of [
      'CorporateActionDividendWriteStageDisposition', 'CorporateActionDividendWriteStageDispositionCode',
      'CorporateActionDividendWriteStageInput', 'CorporateActionDividendWriteStageResult',
    ]) {
      assert.ok(ts.includes(name));
    }
    assert.match(ts, /\| 'executeSimpleCashDividendWriteStage'/);
  });

  it('invokes the one dedicated Tauri command with input only', () => {
    const body = methodBody(read('src/platform/tauriDesktop.ts'));
    assert.match(body, /tauriInvoke\('execute_simple_cash_dividend_write_stage', \{ input \}\)/);
    assert.doesNotMatch(body, /auto_approve_corporate_action_imports|evaluate_simple_cash_dividend_prepared_scope/);
  });

  it('registers only the public Rust command and not the private owner', () => {
    const main = read('src-tauri-shell/src/main.rs');
    assert.equal(main.split('execute_simple_cash_dividend_write_stage,').length - 1, 1);
    assert.doesNotMatch(main, /execute_simple_cash_dividend_write_stage_transaction_owner/);
  });

  it('introduces no caller in preparation or legacy non-approval flows', () => {
    for (const p of [
      'src/features/corporateActions/legacy/corporateActionImportOperations.ts',
      'src/features/corporateActions/legacy/corporateActionDividendPreparedScope.ts',
      'src/features/corporateActions/legacy/corporateActionDividendPreparedScopeOrchestration.ts',
    ]) {
      assert.doesNotMatch(read(p), /executeSimpleCashDividendWriteStage/, p);
    }
  });
});
