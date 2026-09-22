import { describe, expect, it } from 'vitest';
import type { OfficialSourceHealthReport } from '@/platform';
import { formatOfficialSourceHealthMarkdown } from '../officialSourceHealthExport';

describe('Official Source Health recovery export formatting', () => {
  it('formats deterministic source-health evidence with complete provenance and digest fields', () => {
    const report: OfficialSourceHealthReport = {
      assessedAtUtc: '2026-09-08T07:00:00Z',
      results: [
        {
          sourceId: 'NSE_EQUITY_MASTER',
          exchange: 'NSE',
          role: 'Equity current-universe master CSV',
          requestUrl: 'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv',
          finalUrl: 'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv',
          provenanceStatus: 'PASS',
          transportStatus: 'PASS',
          httpStatus: 200,
          contentBytes: 12345,
          contentSha256: 'ABCDEF0123456789',
          formatStatus: 'PASS',
          populationStatus: 'PASS',
          populationCount: 2500,
          freshnessStatus: 'NOT_APPLICABLE',
          driftClass: 'COMPATIBLE',
          reason: 'Frozen parser | population floor passed.',
        },
      ],
    };

    expect(formatOfficialSourceHealthMarkdown(report)).toBe(
      [
        '## Latest ER1 Source Health Evidence',
        '',
        'Assessed UTC: 2026-09-08T07:00:00Z',
        '',
        '| Source | Exchange | Role | Request URL | Final URL | Provenance | Transport | HTTP | Bytes | SHA-256 | Format | Population | Count | Freshness | Drift | Reason |',
        '| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | ---: | --- | --- | --- |',
        '| NSE_EQUITY_MASTER | NSE | Equity current-universe master CSV | https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv | https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv | PASS | PASS | 200 | 12345 | ABCDEF0123456789 | PASS | PASS | 2500 | NOT_APPLICABLE | COMPATIBLE | Frozen parser \\| population floor passed. |',
      ].join('\n'),
    );
  });

  it('formats null/not-classifiable values without inventing authority', () => {
    const report: OfficialSourceHealthReport = {
      assessedAtUtc: '2026-09-08T07:00:00Z',
      results: [
        {
          sourceId: 'NSE_DELISTED_LANDING',
          exchange: 'NSE',
          role: 'Delisted-company discovery landing page',
          requestUrl: 'https://www.nseindia.com/example',
          finalUrl: null,
          provenanceStatus: 'PASS',
          transportStatus: 'FAIL',
          httpStatus: null,
          contentBytes: null,
          contentSha256: null,
          formatStatus: 'NOT_EVALUATED',
          populationStatus: 'NOT_APPLICABLE',
          populationCount: null,
          freshnessStatus: 'NOT_APPLICABLE',
          driftClass: null,
          reason: 'Transport failed; drift is not classifiable.',
        },
      ],
    };

    const markdown = formatOfficialSourceHealthMarkdown(report);
    expect(markdown).toContain('| - | PASS | FAIL | - | - | - | NOT_EVALUATED | NOT_APPLICABLE | - | NOT_APPLICABLE | NOT_CLASSIFIABLE |');
    expect(markdown).not.toContain('ADAPTER_REQUIRED');
    expect(markdown).not.toContain('SEMANTIC_CONTRACT_CHANGE');
  });
});
