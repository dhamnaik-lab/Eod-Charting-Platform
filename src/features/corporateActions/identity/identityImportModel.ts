import type { OfficialSourceHealthReport, OfficialSourceHealthResult } from '@/platform';

export function identityHasActionableChanges(result: {
  applied: boolean; activateCount: number; updateCount: number; deactivateCount: number;
} | null): boolean {
  return result != null && !result.applied &&
    (result.activateCount > 0 || result.updateCount > 0 || result.deactivateCount > 0);
}

export function identityCurrentConfirmation(result: { activateCount: number; updateCount: number; deactivateCount: number }, exchange: 'NSE' | 'BSE', databasePath: string): string {
  return `Apply reviewed ${exchange} Current universe changes?\n\nDatabase: ${databasePath}\n` +
    `${result.activateCount} activate, ${result.updateCount} update, ${result.deactivateCount} deactivate.\n\n` +
    'Apply uses the full reviewed plan; search filters do not limit Apply.\n' +
    'Raw price files and financial-action approvals are unchanged.\n\nChoose Cancel to keep reviewing.';
}

export function isIdentitySourceHealthy(result: OfficialSourceHealthResult): boolean {
  return result.provenanceStatus === 'PASS' && result.transportStatus === 'PASS' &&
    result.formatStatus === 'PASS' && !['FAIL', 'NOT_EVALUATED'].includes(result.populationStatus) &&
    !['FAIL', 'NOT_EVALUATED'].includes(result.freshnessStatus);
}

export function identityHealthSummary(report: OfficialSourceHealthReport | null, exchange: 'NSE' | 'BSE') {
  const results = report?.results.filter(result => result.exchange === exchange) ?? [];
  return { results, checked: report != null, attention: results.filter(result => !isIdentitySourceHealthy(result)).length };
}

export function parseIdentityDiagnostic(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

export function identityStatusText(status: string): string {
  const diagnostic = parseIdentityDiagnostic(status);
  const reason = typeof diagnostic?.reason === 'string' ? diagnostic.reason : status;
  if (/Missing .+ column in/.test(reason)) {
    return 'Source downloaded, but its column names are not recognized; saved sources were not replaced.';
  }
  return reason.split('; CSV headers:')[0];
}

export function identityPreviewState(loaded: boolean, total: number, shown: number, busy: boolean, applied = false): string {
  if (busy) return 'Operation in progress';
  if (applied) return `Completed · ${total} result rows`;
  if (!loaded) return 'Not previewed';
  if (total === 0) return 'Preview loaded · No changes';
  if (shown === 0) return `Preview loaded · ${total} rows · No filter matches`;
  return `Preview loaded · ${shown} of ${total} rows shown`;
}
