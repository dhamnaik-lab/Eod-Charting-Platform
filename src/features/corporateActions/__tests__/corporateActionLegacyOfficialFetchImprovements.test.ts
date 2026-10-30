import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Corporate Action legacy Official Imports R1C donor promotion', () => {
  it('separates direct-fetch exchange scope from CSV fallback and validates the fetch date range', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx'),
      'utf8',
    );

    const fetchSectionStart = source.indexOf('Fetch from an official source');
    const historySectionStart = source.indexOf('Historical split and bonus backfill');
    const fetchSection = source.slice(fetchSectionStart, historySectionStart);
    const csvSectionStart = source.indexOf('CSV fallback');
    const reviewSectionStart = source.indexOf("activeOfficialImportSection === 'review'", csvSectionStart);
    const csvSection = source.slice(csvSectionStart, reviewSectionStart);

    expect(source).toContain("type OfficialFetchExchangeSelection = 'BOTH' | 'NSE' | 'BSE';");
    expect(source).toContain('officialFetchExchangeSelection');
    expect(fetchSection).toContain('<option value="BOTH">NSE + BSE</option>');
    expect(fetchSection).toContain('max={fetchToDate || undefined}');
    expect(fetchSection).toContain('min={fetchFromDate || undefined}');
    expect(source).toContain('fetchFromDate > fetchToDate');
    expect(source).toContain('const [fetchToDate, setFetchToDate] = useState(indiaIsoDate);');
    expect(source).not.toContain('addIndiaIsoDays(indiaIsoDate(), 30)');

    expect(csvSection).toContain('value={importExchange}');
    expect(csvSection).toContain('<option value="NSE">NSE</option>');
    expect(csvSection).toContain('<option value="BSE">BSE</option>');
    expect(source).toContain("exchange: importExchange.trim().toUpperCase() || 'NSE'");
  });

  it('runs selected exchanges in order, preserves force refresh, and records fetch observability only after success', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx'),
      'utf8',
    );
    const fetchStart = source.indexOf('const fetchOfficialActions = async');
    const fetchEnd = source.indexOf('const runHistoricalBackfillPilot', fetchStart);
    const fetchBody = source.slice(fetchStart, fetchEnd);

    expect(source).toContain("from '@/features/corporateActions/workflow/corporateActionNormalFetchHistory'");
    expect(fetchBody).toContain("officialFetchExchangeSelection === 'BOTH'");
    expect(fetchBody).toContain("for (const selectedExchange of selectedExchanges)");
    expect(fetchBody).toContain('exchange: selectedExchange');
    expect(fetchBody).toContain('forceRefresh,');
    expect(fetchBody).toContain('Fetch started:');
    expect(fetchBody).toContain(' - Complete: ');
    expect(fetchBody).toContain(' - Failed: ');
    expect(fetchBody).toContain('All selected exchanges complete:');
    expect(fetchBody).toContain('writeCorporateActionNormalLastFetch');
    expect(fetchBody.indexOf('writeCorporateActionNormalLastFetch')).toBeGreaterThan(
      fetchBody.indexOf('for (const selectedExchange of selectedExchanges)'),
    );

    expect(source).toContain('Last successful fetch:');
    expect(source).toContain('formatCorporateActionNormalLastFetch(lastSuccessfulOfficialFetch)');
    expect(source).toContain('aria-label="Official fetch status log"');
  });

  it('surfaces Error, string, and object-message failures through the shared error formatter', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx'),
      'utf8',
    );
    const helperStart = source.indexOf('function getErrorMessage');
    const helperEnd = source.indexOf('function formatCorporateActionTypeLabel', helperStart);
    const helperBody = source.slice(helperStart, helperEnd);
    const fetchStart = source.indexOf('const fetchOfficialActions = async');
    const fetchEnd = source.indexOf('const runHistoricalBackfillPilot', fetchStart);
    const fetchBody = source.slice(fetchStart, fetchEnd);

    expect(helperBody).toContain("typeof error === 'string' && error.trim()");
    expect(helperBody).toContain("error && typeof error === 'object' && 'message' in error");
    expect(helperBody).toContain("typeof message === 'string' && message.trim()");
    expect(fetchBody).toContain("getErrorMessage(error, 'Could not fetch official corporate actions.')");
  });
});
