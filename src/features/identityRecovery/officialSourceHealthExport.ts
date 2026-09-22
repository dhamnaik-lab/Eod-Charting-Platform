import type { OfficialSourceHealthReport } from '@/platform';

function markdownCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value)
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

export function formatOfficialSourceHealthMarkdown(
  report: OfficialSourceHealthReport,
): string {
  const lines = [
    '## Latest ER1 Source Health Evidence',
    '',
    `Assessed UTC: ${markdownCell(report.assessedAtUtc)}`,
    '',
    '| Source | Exchange | Role | Request URL | Final URL | Provenance | Transport | HTTP | Bytes | SHA-256 | Format | Population | Count | Freshness | Drift | Reason |',
    '| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | ---: | --- | --- | --- |',
  ];

  for (const result of report.results) {
    lines.push(
      `| ${markdownCell(result.sourceId)} | ${markdownCell(result.exchange)} | ${markdownCell(result.role)} | ${markdownCell(result.requestUrl)} | ${markdownCell(result.finalUrl)} | ${markdownCell(result.provenanceStatus)} | ${markdownCell(result.transportStatus)} | ${markdownCell(result.httpStatus)} | ${markdownCell(result.contentBytes)} | ${markdownCell(result.contentSha256)} | ${markdownCell(result.formatStatus)} | ${markdownCell(result.populationStatus)} | ${markdownCell(result.populationCount)} | ${markdownCell(result.freshnessStatus)} | ${markdownCell(result.driftClass ?? 'NOT_CLASSIFIABLE')} | ${markdownCell(result.reason)} |`,
    );
  }

  return lines.join('\n');
}
