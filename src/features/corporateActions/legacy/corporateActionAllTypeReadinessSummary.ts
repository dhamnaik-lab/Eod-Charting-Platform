import type { CorporateActionImportActionType, CorporateActionImportRow } from '@/platform';
import { isLaterCorporateAction } from './corporateActionLater';
import { isInformationalCorporateAnnouncement } from './corporateActionAnnouncementClassification';

// A read-only aggregate over the *loaded pending queue*, not a database query
// or a financial eligibility classifier. Ready IDs come from the existing gate.
export const ALL_CA_ACTION_TYPES = ['SPLIT', 'BONUS', 'DIVIDEND', 'RIGHTS', 'DEMERGER', 'OTHER'] as const;
export interface CaPendingByType {
  actionType: CorporateActionImportActionType;
  pending: number;
  ready: number;
  blocked: number;
  informational: number;
  later: number;
}
export interface CaPendingTypeSummary {
  totals: { pending: number; ready: number; blocked: number; informational: number; later: number };
  rows: CaPendingByType[];
}

export function summarizeCaPendingByType(
  pendingRows: readonly (Pick<CorporateActionImportRow, 'id' | 'actionType' | 'reviewStatus' | 'approvedCorporateActionId'> &
    Partial<Pick<CorporateActionImportRow, 'instrumentIsActive' | 'purposeRaw' | 'cashAmount' | 'factor' | 'priceFactor' | 'ratioNum' | 'ratioDen' | 'oldFaceValue' | 'newFaceValue'>>)[],
  readyIds: ReadonlySet<number>,
): CaPendingTypeSummary {
  const counts = new Map<CorporateActionImportActionType, CaPendingByType>(
    ALL_CA_ACTION_TYPES.map(actionType => [actionType, { actionType, pending: 0, ready: 0, blocked: 0, informational: 0, later: 0 }]),
  );
  const seen = new Set<number>();
  for (const row of pendingRows) {
    // Do not double-count paginated duplicate IDs or already-applied rows.
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    if (row.reviewStatus === 'APPROVED' || row.approvedCorporateActionId != null) continue;
    // Fail closed on unexpected stored action types: count under OTHER, never Ready.
    const known = counts.has(row.actionType);
    const item = counts.get(known ? row.actionType : 'OTHER')!;
    item.pending += 1;
    if (isLaterCorporateAction(row)) item.later += 1;
    else if (isInformationalCorporateAnnouncement(row)) item.informational += 1;
    else if (known && readyIds.has(row.id)) item.ready += 1;
    else item.blocked += 1;
  }
  const rows = ALL_CA_ACTION_TYPES.map(type => counts.get(type)!);
  const totals = rows.reduce((acc, row) => ({
    pending: acc.pending + row.pending,
    ready: acc.ready + row.ready,
    blocked: acc.blocked + row.blocked,
    informational: acc.informational + row.informational,
    later: acc.later + row.later,
  }), { pending: 0, ready: 0, blocked: 0, informational: 0, later: 0 });
  return { rows, totals };
}

export function formatCaPendingTypeReport(summary: CaPendingTypeSummary): string {
  return [
    'EOD Corporate Actions — all loaded pending actions by type',
    'Read-only diagnostic; Ready is NOT approved. Blocked means not eligible for the current approval workflow.',
    'Later defers unsupported types or inactive instruments without closing or approving them. Pending = Ready + Blocked + Informational + Later.',
    'Type | Not approved | Ready for explicit approval | Blocked / not ready | Informational | Later',
    ...summary.rows.map(r => `${r.actionType} | ${r.pending} | ${r.ready} | ${r.blocked} | ${r.informational} | ${r.later}`),
    `TOTAL | ${summary.totals.pending} | ${summary.totals.ready} | ${summary.totals.blocked} | ${summary.totals.informational} | ${summary.totals.later}`,
  ].join('\n');
}
