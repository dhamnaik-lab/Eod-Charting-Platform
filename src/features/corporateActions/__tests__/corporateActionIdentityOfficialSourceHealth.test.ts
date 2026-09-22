import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DESKTOP_TYPES = resolve(process.cwd(), 'src/types/desktop.ts');
const PLATFORM_TYPES = resolve(process.cwd(), 'src/platform/types.ts');
const TAURI_DESKTOP = resolve(process.cwd(), 'src/platform/tauriDesktop.ts');
const DATABASE_RS = resolve(process.cwd(), 'src-tauri-shell/src/database.rs');
const MAIN_RS = resolve(process.cwd(), 'src-tauri-shell/src/main.rs');
const HEALTH_RS = resolve(
  process.cwd(),
  'src-tauri-shell/src/database/official_source_health.rs',
);
const DATABASE_TOOLS = resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx');
const HEALTH_EXPORT = resolve(
  process.cwd(),
  'src/features/identityRecovery/officialSourceHealthExport.ts',
);

function read(path: string): string {
  expect(existsSync(path), `Missing required file: ${path}`).toBe(true);
  return readFileSync(path, 'utf8');
}

describe('Identity ER1 Official Source Health contract', () => {
  it('preserves the shared cross-source result contract and frozen drift classes', () => {
    const desktop = read(DESKTOP_TYPES);

    expect(desktop).toContain('export type OfficialSourceCheckStatus');
    expect(desktop).toContain('export type OfficialSourceDriftClass');
    expect(desktop).toContain('export interface OfficialSourceHealthResult');
    expect(desktop).toContain('export interface OfficialSourceHealthReport');
    expect(desktop).toContain("'COMPATIBLE'");
    expect(desktop).toContain("'ADAPTER_REQUIRED'");
    expect(desktop).toContain("'SEMANTIC_CONTRACT_CHANGE'");
  });

  it('preserves one renderer-to-Tauri read-only assessment method', () => {
    const desktop = read(DESKTOP_TYPES);
    const platform = read(PLATFORM_TYPES);
    const tauri = read(TAURI_DESKTOP);

    expect(desktop).toContain(
      'assessIdentityOfficialSourceHealth(): Promise<OfficialSourceHealthReport>',
    );
    expect(platform).toContain("'assessIdentityOfficialSourceHealth'");
    expect(tauri).toContain('assessIdentityOfficialSourceHealth: async () =>');
    expect(tauri).toContain("tauriInvoke('assess_identity_official_source_health')");
  });

  it('preserves the Rust assessor and eleven logical source identities', () => {
    const database = read(DATABASE_RS);
    const main = read(MAIN_RS);
    const health = read(HEALTH_RS);

    expect(database).toContain('mod official_source_health;');
    expect(database).toContain('assess_identity_official_source_health');
    expect(main).toContain('assess_identity_official_source_health,');
    expect(health).toContain('pub async fn assess_identity_official_source_health');
    expect(health).toContain('open_read_only_connection_for_folder');

    for (const sourceId of [
      'NSE_SECURITIES_AVAILABLE_LANDING',
      'NSE_EQUITY_MASTER',
      'NSE_SME_MASTER',
      'NSE_SYMBOL_CHANGE',
      'NSE_COMPANY_NAME_CHANGE',
      'NSE_DELISTED_LANDING',
      'NSE_DELISTED_WORKBOOK',
      'BSE_LIST_SCRIPS_REFERER',
      'BSE_LIST_SCRIPS_ACTIVE',
      'BSE_LIST_SCRIPS_DELISTED',
      'BSE_LIST_SCRIPS_SUSPENDED',
    ]) {
      expect(health).toContain(sourceId);
    }
  });

  it('adds a read-only Check Source Health operator surface without changing Apply authority', () => {
    const health = read(HEALTH_RS);
    const ui = read(DATABASE_TOOLS);

    expect(health).not.toContain('std::fs::write');
    expect(health).not.toContain('set_setting');
    expect(health).not.toContain('apply_nse_current_universe_sync');
    expect(health).not.toContain('apply_bse_current_universe_sync');
    expect(health).not.toContain('apply_nse_historical_identity_archive');

    expect(ui).toContain('Check Source Health');
    expect(ui).toContain('assessIdentityOfficialSourceHealth');
    expect(ui).toContain('OfficialSourceHealthReport');
    expect(ui).toContain('officialSourceHealthReport');
    expect(ui).toContain('Latest official source health');
    expect(ui).toContain('Apply Reviewed Changes');
  });

  it('adds deterministic ER1 evidence formatting only for the Source Recovery Brief', () => {
    const ui = read(DATABASE_TOOLS);
    const formatter = read(HEALTH_EXPORT);

    expect(formatter).toContain('export function formatOfficialSourceHealthMarkdown');
    expect(formatter).toContain('## Latest ER1 Source Health Evidence');
    expect(ui).toContain('formatOfficialSourceHealthMarkdown');
    expect(ui).toContain("document.key === 'source-recovery'");
    expect(ui).toContain('officialSourceHealthReport');
  });
});
