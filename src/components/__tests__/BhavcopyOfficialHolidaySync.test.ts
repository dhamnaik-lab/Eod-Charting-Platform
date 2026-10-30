import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const component = readFileSync(resolve(root, 'src/components/BhavcopyDownloadWindow.tsx'), 'utf8');
const types = readFileSync(resolve(root, 'src/types/desktop.ts'), 'utf8');
const api = readFileSync(resolve(root, 'src/platform/tauriDesktop.ts'), 'utf8');
const backend = readFileSync(resolve(root, 'src-tauri-shell/src/bhavcopy/holiday_sync.rs'), 'utf8');
const calendar = readFileSync(resolve(root, 'src-tauri-shell/src/bhavcopy/calendar.rs'), 'utf8');
const bootstrap = readFileSync(resolve(root, 'src-tauri-shell/src/database/bootstrap.rs'), 'utf8');

describe('HOL-03 official equity holiday sync contract', () => {
  it('keeps the local Refresh and Add/Remove methods intact', () => {
    expect(component).toContain('api.listMarketHolidays()');
    expect(component).toContain('api.addMarketHoliday(newHolidayDate, newHolidayName)');
    expect(component).toContain('api.deleteMarketHoliday(id)');
    expect(component).toContain('Refresh market holidays');
  });
  it('requires a separate preview and deliberately selected acceptance', () => {
    expect(component).toContain('Sync Official Holidays');
    expect(component).toContain('handlePreviewOfficialHolidays');
    expect(component).toContain('handleAcceptOfficialHolidays');
    expect(component).toContain('Accept selected official calendars');
    expect(component).toContain('officialPreviewDbPath === activeDatabasePath');
  });
  it('keeps local Refresh isolated from official coverage metadata requests', () => {
    const start = component.indexOf('  const loadHolidays = async () => {');
    const end = component.indexOf('\n  };', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const localRefresh = component.slice(start, end);
    expect(localRefresh).toContain('api.listMarketHolidays()');
    expect(localRefresh).not.toContain('setOfficialCoverage');
    expect(localRefresh).not.toContain('listOfficialExchangeHolidaySnapshots');
    expect(component).toContain('const rows = await api.listOfficialExchangeHolidaySnapshots(new Date().getFullYear())');
  });
  it('routes the new IPC through the platform bridge', () => {
    expect(types).toContain('previewOfficialExchangeHolidays(year: number)');
    expect(types).toContain('applyOfficialExchangeHolidays(token: string, exchanges: string[])');
    expect(api).toContain("tauriInvoke('preview_official_exchange_holidays'");
    expect(api).toContain("tauriInvoke('apply_official_exchange_holidays'");
  });
  it('uses exchange/year-scoped tables and never rewrites shared USER rows', () => {
    expect(bootstrap).toContain('official_exchange_holiday_snapshots');
    expect(bootstrap).toContain('official_exchange_holidays');
    expect(calendar).toContain("source='USER'");
    expect(backend).not.toContain('DELETE FROM market_holidays');
    expect(backend).not.toContain('UPDATE market_holidays');
  });
  it('fetches only pinned official NSE CM and BSE base plus amendment', () => {
    expect(backend).toContain('api/holiday-master?type=trading');
    expect(backend).toContain('.get("CM")');
    expect(backend).toContain('20251212-8');
    expect(backend).toContain('20260112-8');
    expect(backend).toContain('validate_bse_2026_amendment');
    expect(backend).toContain('redirect(reqwest::redirect::Policy::none())');
  });
  it('keeps the special-session override before holiday skipping', () => {
    expect(calendar.indexOf('if is_special_trading_day(exchange, trade_date)')).toBeLessThan(calendar.indexOf('get_exchange_holiday_name(connection, exchange, trade_date)'));
  });
});
