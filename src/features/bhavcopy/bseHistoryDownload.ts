import type { BseHistoryDownloadInput, DownloadMode } from '@/platform';

export function localDownloadDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function bseHistoryRequest(
  mode: DownloadMode,
  startDate: string,
  endDate: string,
  scope: 'selected' | 'known',
  text: string,
  today = localDownloadDate(),
): BseHistoryDownloadInput {
  if (mode !== 'range' && mode !== 'fullHistory') throw new Error('BSE browser history requires Date Range or Full History.');
  if (mode === 'fullHistory') {
    startDate = '1990-01-01';
    endDate = today;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
    throw new Error('Select a valid start and end date in ascending order.');
  }
  const codes = scope === 'selected' ? [...new Set(text.split(/[\s,;]+/).filter(Boolean))] : [];
  if (scope === 'selected' && (codes.length === 0 || codes.some((code) => !/^\d{6}$/.test(code)))) {
    throw new Error('Enter six-digit BSE security codes separated by commas or spaces.');
  }
  return { startDate, endDate, scope, codes };
}
