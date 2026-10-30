import type { CorporateActionPriceValidationPresentation } from './corporateActionCompoundValidation';
import {
  isCorporateActionStatusApprovalCandidate,
  type CorporateActionEventStatus,
} from './corporateActionWorkflow';

export interface CorporateActionEconomicEventSourceRow {
  eventKey: string;
  importId: number;
  exchange: string;
  symbol: string | null;
  companyName: string | null;
  exDate: string | null;
  actionType: string;
  shareFactor: number | null;
  status: CorporateActionEventStatus;
  statusReason: string | null;
  source: string;
  evidenceCount: number;
  pricePresentation: CorporateActionPriceValidationPresentation | null;
}

export interface CorporateActionEconomicEventComponentView {
  actionType: string;
  label: string;
  shareFactor: number | null;
  importIds: readonly number[];
}

export interface CorporateActionEconomicEventViewModel {
  eventKey: string;
  title: string;
  exchange: string;
  symbol: string | null;
  companyName: string | null;
  exDate: string | null;
  status: CorporateActionEventStatus;
  statusReason: string | null;
  approvalCandidate: boolean;
  actionLabel: string;
  components: readonly CorporateActionEconomicEventComponentView[];
  sourceRowCount: number;
  duplicateSourceRowCount: number;
  sources: readonly string[];
  sourceRows: readonly CorporateActionEconomicEventSourceRow[];
  pricePresentation: CorporateActionPriceValidationPresentation | null;
}

const ACTION_ORDER: Readonly<Record<string, number>> = {
  SPLIT: 0,
  CONSOLIDATION: 0,
  BONUS: 1,
  RIGHTS: 2,
  DIVIDEND: 3,
  DEMERGER: 4,
};

const STATUS_ORDER: Readonly<Record<CorporateActionEventStatus, number>> = {
  NEEDS_REVIEW: 0,
  CONFLICT: 1,
  READY: 2,
  APPROVED: 3,
  ALREADY_PROCESSED: 4,
};

function requiredText(value: string, field: string, eventKey: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Economic event ${eventKey} requires ${field}`);
  }
  return normalized;
}

function nullableText(value: string | null): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizedActionType(value: string, eventKey: string): string {
  return requiredText(value, 'actionType', eventKey).toUpperCase();
}

function actionLabel(actionType: string): string {
  const known: Readonly<Record<string, string>> = {
    SPLIT: 'Split',
    CONSOLIDATION: 'Consolidation',
    BONUS: 'Bonus',
    RIGHTS: 'Rights',
    DIVIDEND: 'Dividend',
    DEMERGER: 'Demerger',
  };
  if (known[actionType]) return known[actionType];

  return actionType
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function assertSourceRow(row: CorporateActionEconomicEventSourceRow): void {
  const eventKey = requiredText(row.eventKey, 'eventKey', '<missing>');
  requiredText(row.exchange, 'exchange', eventKey);
  requiredText(row.actionType, 'actionType', eventKey);
  requiredText(row.source, 'source', eventKey);

  if (!Number.isInteger(row.importId) || row.importId <= 0) {
    throw new Error(`Economic event ${eventKey} requires a positive integer importId`);
  }
  if (!Number.isInteger(row.evidenceCount) || row.evidenceCount < 0) {
    throw new Error(`Economic event ${eventKey} requires a non-negative evidenceCount`);
  }
  if (
    row.shareFactor != null &&
    (!Number.isFinite(row.shareFactor) || row.shareFactor <= 0)
  ) {
    throw new Error(`Economic event ${eventKey} has invalid shareFactor`);
  }
}

function assertConsistent<T>(
  rows: readonly CorporateActionEconomicEventSourceRow[],
  field: string,
  selector: (row: CorporateActionEconomicEventSourceRow) => T,
): T {
  const first = selector(rows[0]);
  for (const row of rows.slice(1)) {
    if (!Object.is(selector(row), first)) {
      throw new Error(`Economic event ${rows[0].eventKey} has inconsistent ${field}`);
    }
  }
  return first;
}

function pricePresentationEqual(
  left: CorporateActionPriceValidationPresentation,
  right: CorporateActionPriceValidationPresentation,
): boolean {
  return (
    left.isCompound === right.isCompound &&
    left.componentCount === right.componentCount &&
    Object.is(left.effectiveFactor, right.effectiveFactor) &&
    Object.is(left.theoreticalPrice, right.theoreticalPrice) &&
    Object.is(left.openResidualPct, right.openResidualPct) &&
    Object.is(left.closeResidualPct, right.closeResidualPct) &&
    left.summary === right.summary
  );
}

function consistentPricePresentation(
  rows: readonly CorporateActionEconomicEventSourceRow[],
): CorporateActionPriceValidationPresentation | null {
  const presentations = rows
    .map((row) => row.pricePresentation)
    .filter(
      (value): value is CorporateActionPriceValidationPresentation => value != null,
    );

  if (presentations.length === 0) return null;

  const first = presentations[0];
  for (const presentation of presentations.slice(1)) {
    if (!pricePresentationEqual(first, presentation)) {
      throw new Error(
        `Economic event ${rows[0].eventKey} has inconsistent pricePresentation`,
      );
    }
  }

  return { ...first };
}

function buildComponents(
  rows: readonly CorporateActionEconomicEventSourceRow[],
): CorporateActionEconomicEventComponentView[] {
  const byAction = new Map<string, CorporateActionEconomicEventSourceRow[]>();

  for (const row of rows) {
    const type = normalizedActionType(row.actionType, row.eventKey);
    const existing = byAction.get(type);
    if (existing) existing.push(row);
    else byAction.set(type, [row]);
  }

  return [...byAction.entries()]
    .map(([type, componentRows]) => {
      const shareFactor = assertConsistent(
        componentRows,
        `${type} shareFactor`,
        (row) => row.shareFactor,
      );

      return {
        actionType: type,
        label:
          type === 'SPLIT' && shareFactor != null && shareFactor < 1.0
            ? 'Consolidation'
            : actionLabel(type),
        shareFactor,
        importIds: componentRows.map((row) => row.importId).sort((a, b) => a - b),
      };
    })
    .sort(
      (left, right) =>
        (ACTION_ORDER[left.actionType] ?? Number.MAX_SAFE_INTEGER) -
          (ACTION_ORDER[right.actionType] ?? Number.MAX_SAFE_INTEGER) ||
        left.actionType.localeCompare(right.actionType),
    );
}

function buildOneEconomicEvent(
  rows: readonly CorporateActionEconomicEventSourceRow[],
): CorporateActionEconomicEventViewModel {
  const orderedRows = [...rows].sort((left, right) => left.importId - right.importId);
  const first = orderedRows[0];
  const eventKey = requiredText(first.eventKey, 'eventKey', '<missing>');

  const exchange = assertConsistent(
    orderedRows,
    'exchange',
    (row) => requiredText(row.exchange, 'exchange', eventKey).toUpperCase(),
  );
  const symbol = assertConsistent(
    orderedRows,
    'symbol',
    (row) => nullableText(row.symbol)?.toUpperCase() ?? null,
  );
  const companyName = assertConsistent(
    orderedRows,
    'companyName',
    (row) => nullableText(row.companyName),
  );
  const exDate = assertConsistent(
    orderedRows,
    'exDate',
    (row) => nullableText(row.exDate),
  );
  const status = assertConsistent(orderedRows, 'status', (row) => row.status);
  const statusReason = assertConsistent(
    orderedRows,
    'statusReason',
    (row) => nullableText(row.statusReason),
  );

  const components = buildComponents(orderedRows);
  const sources = [
    ...new Set(
      orderedRows.map((row) => requiredText(row.source, 'source', eventKey)),
    ),
  ].sort((left, right) => left.localeCompare(right));

  return {
    eventKey,
    title: symbol ?? companyName ?? eventKey,
    exchange,
    symbol,
    companyName,
    exDate,
    status,
    statusReason,
    approvalCandidate: isCorporateActionStatusApprovalCandidate(status),
    actionLabel: components.map((component) => component.label).join(' + '),
    components,
    sourceRowCount: orderedRows.length,
    duplicateSourceRowCount: orderedRows.length - components.length,
    sources,
    sourceRows: orderedRows,
    pricePresentation: consistentPricePresentation(orderedRows),
  };
}

export function buildCorporateActionEconomicEventViewModels(
  sourceRows: readonly CorporateActionEconomicEventSourceRow[],
): CorporateActionEconomicEventViewModel[] {
  const groups = new Map<string, CorporateActionEconomicEventSourceRow[]>();

  for (const row of sourceRows) {
    assertSourceRow(row);
    const eventKey = row.eventKey.trim();
    const existing = groups.get(eventKey);
    if (existing) existing.push(row);
    else groups.set(eventKey, [row]);
  }

  return [...groups.values()]
    .map(buildOneEconomicEvent)
    .sort(
      (left, right) =>
        STATUS_ORDER[left.status] - STATUS_ORDER[right.status] ||
        (right.exDate ?? '').localeCompare(left.exDate ?? '') ||
        left.eventKey.localeCompare(right.eventKey),
    );
}
