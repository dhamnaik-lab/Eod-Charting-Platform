export type QuoteEditorExchangeScope =
  | 'ALL'
  | 'NSE'
  | 'NSE_INDEX'
  | 'BSE'
  | 'BSE_INDEX'
  | 'MCX';

export const QUOTE_EDITOR_EXCHANGE_OPTIONS: ReadonlyArray<{
  value: QuoteEditorExchangeScope;
  label: string;
}> = [
  { value: 'ALL', label: 'ALL' },
  { value: 'NSE', label: 'NSE' },
  { value: 'NSE_INDEX', label: 'NSE-INDEX' },
  { value: 'BSE', label: 'BSE' },
  { value: 'BSE_INDEX', label: 'BSE-INDEX' },
  { value: 'MCX', label: 'MCX' },
];

const CONCRETE_EXCHANGES = new Set<QuoteEditorExchangeScope>([
  'NSE',
  'NSE_INDEX',
  'BSE',
  'BSE_INDEX',
  'MCX',
]);

export function normalizeQuoteEditorExchangeScope(value: string): QuoteEditorExchangeScope | null {
  const normalized = value.trim().toUpperCase().replace(/-/g, '_');
  if (normalized === 'ALL') {
    return 'ALL';
  }
  if (CONCRETE_EXCHANGES.has(normalized as QuoteEditorExchangeScope)) {
    return normalized as QuoteEditorExchangeScope;
  }
  return null;
}

export function resolveQuoteEditorWriteExchange(
  scope: string,
  selectedRowExchange: string | null,
): Exclude<QuoteEditorExchangeScope, 'ALL'> | null {
  const normalizedScope = normalizeQuoteEditorExchangeScope(scope);
  if (!normalizedScope) {
    return null;
  }
  if (normalizedScope !== 'ALL') {
    return normalizedScope;
  }

  const normalizedRowExchange = selectedRowExchange
    ? normalizeQuoteEditorExchangeScope(selectedRowExchange)
    : null;
  if (!normalizedRowExchange || normalizedRowExchange === 'ALL') {
    return null;
  }
  return normalizedRowExchange;
}

export function buildAllExchangeDeleteConfirmation(fromDate: string, toDate: string): string {
  const dateText = fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`;
  return [
    `Delete Quote Editor data for ${dateText} from ALL exchanges?`,
    '',
    'The following exchange stores will be checked:',
    'NSE, NSE-INDEX, BSE, BSE-INDEX, MCX.',
    '',
    'This modifies canonical quotation history and cannot be undone from Quote Editor.',
  ].join('\n');
}
export function quoteEditorExchangeLabel(value: string): string {
  const normalized = normalizeQuoteEditorExchangeScope(value);
  if (!normalized) {
    return value.trim().toUpperCase();
  }
  return QUOTE_EDITOR_EXCHANGE_OPTIONS.find((option) => option.value === normalized)?.label ?? normalized;
}

export type QuoteEditorExchangeCounts = Record<
  Exclude<QuoteEditorExchangeScope, 'ALL'>,
  number
>;

export const QUOTE_EDITOR_TABLE_CELL_STYLE = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

export function summarizeQuoteEditorRowsByExchange(
  rows: ReadonlyArray<{ exchange: string }>,
): QuoteEditorExchangeCounts {
  const counts: QuoteEditorExchangeCounts = {
    NSE: 0,
    NSE_INDEX: 0,
    BSE: 0,
    BSE_INDEX: 0,
    MCX: 0,
  };

  for (const row of rows) {
    const exchange = normalizeQuoteEditorExchangeScope(row.exchange);
    if (exchange && exchange !== 'ALL') {
      counts[exchange] += 1;
    }
  }

  return counts;
}

export function formatQuoteEditorAllLoadSummary(
  date: string,
  total: number,
  counts: QuoteEditorExchangeCounts,
): string {
  return [
    `Loaded ${total} quotes for ${date}.`,
    `NSE=${counts.NSE};`,
    `NSE-INDEX=${counts.NSE_INDEX};`,
    `BSE=${counts.BSE};`,
    `BSE-INDEX=${counts.BSE_INDEX};`,
    `MCX=${counts.MCX}.`,
  ].join(' ');
}
