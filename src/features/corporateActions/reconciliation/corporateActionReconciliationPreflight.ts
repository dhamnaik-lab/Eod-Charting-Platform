import type {
  CorporateActionReconciliationPreflightInput as Input,
  CorporateActionReconciliationPreflightResult as Result,
  DesktopApi,
} from '@/platform/types';

const OUTCOMES = ['ALREADY_LINKED_REVIEW', 'READY_FOR_EXISTING_APPROVAL_RECHECK', 'REPAIR_CANDIDATE',
  'EVIDENCE_BLOCKED', 'DEFERRED_SCOPE', 'CLASSIFICATION_REVIEW', 'MISSING_IMPORT', 'PREPARATION_ERROR'] as const;
let nextSessionId = 0;

export function normalizeReconciliationIds(ids: readonly number[]): number[] {
  if (ids.length < 1 || ids.length > 500 || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error('Reconciliation preview requires 1–500 positive safe-integer import IDs. Nothing is truncated.');
  }
  return [...new Set(ids)];
}

function pathKey(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  return /^[a-z]:\//i.test(normalized) ? normalized.toLowerCase() : normalized;
}

/** Session-only ownership. Invalidating a request does not claim to kill backend work. */
export class ReconciliationSession {
  private readonly sessionId = ++nextSessionId;
  private epoch = 0;
  private sequence = 0;
  private scope = '';
  private path: string | null = null;
  private ids: number[] = [];
  private pending: { token: string; path: string; ids: number[]; requested: number; epoch: number } | null = null;
  private accepted: Result | null = null;

  changeScope(path: string | null, ids: readonly number[], generation: number): void {
    const scope = JSON.stringify([path, ids, generation]);
    if (scope === this.scope) return;
    this.scope = scope; this.path = path; this.ids = [...ids]; this.invalidate();
  }
  invalidate(): void { this.epoch += 1; this.pending = null; this.accepted = null; }
  close(): void { this.invalidate(); this.scope = ''; this.path = null; this.ids = []; }
  begin(selectedIds?: readonly number[]): Input {
    if (!this.path) throw new Error('Database context unavailable. Open a database through the normal workflow first.');
    const raw = selectedIds ? [...selectedIds] : [...this.ids];
    const unique = normalizeReconciliationIds(raw);
    const scope = new Set(this.ids);
    if (unique.some((id) => !scope.has(id))) throw new Error('Selected diagnostic IDs are outside the captured scope.');
    this.invalidate();
    const token = `r1a_${this.sessionId}_${this.epoch}_${++this.sequence}`;
    this.pending = { token, path: this.path, ids: unique, requested: raw.length, epoch: this.epoch };
    return { importIds: raw, expectedDatabasePath: this.path, requestToken: token };
  }
  owns(input: Input): boolean { return this.pending?.token === input.requestToken && this.pending.epoch === this.epoch; }
  fail(input: Input): void { if (this.owns(input)) { this.pending = null; this.accepted = null; } }
  adopt(input: Input, result: Result): boolean {
    if (!this.owns(input)) return false;
    const pending = this.pending!;
    try {
      if (!result || !['COMPLETE', 'PARTIAL'].includes(result.status) || result.version !== 'CA_RECONCILIATION_PREFLIGHT_V1'
        || result.requestToken !== pending.token || result.readOnly !== true || result.executedRepairs !== 0 || result.approvalWrites !== 0
        || !result.databaseContext || pathKey(result.databaseContext.canonicalDatabasePath) !== pathKey(pending.path)
        || result.databaseContext.readContext !== 'CONSISTENT_READ_TRANSACTION' || !result.fingerprint
        || result.summary.databaseComplete !== false || result.summary.coverageCertification !== 'NOT_ASSESSED') throw new Error('Rejected diagnostic result.');
      const ids = result.rows.map((row) => row.importId);
      if (ids.length !== pending.ids.length || new Set(ids).size !== ids.length
        || ids.some((id, index) => id !== pending.ids[index])
        || result.selection.uniqueCount !== ids.length || result.selection.requestedCount !== pending.requested
        || result.selection.duplicateCount !== pending.requested - ids.length
        || JSON.stringify(result.selection.uniqueImportIds) !== JSON.stringify(ids)
        || result.summary.accountedFor !== ids.length) throw new Error('Incomplete diagnostic ID accounting.');
      const counts = Object.fromEntries(OUTCOMES.map((name) => [name, 0])) as Record<typeof OUTCOMES[number], number>;
      for (const row of result.rows) {
        if (!OUTCOMES.includes(row.outcome) || row.repairPlan.some((item) => item.executed !== false)) throw new Error('Invalid diagnostic outcome.');
        if (row.ordinaryReadiness.state === 'READY_FOR_WRITER_RECHECK' &&
            row.blockers.some(blocker => blocker.severity === 'BLOCKING')) throw new Error('Conflicting readiness and blockers.');
        counts[row.outcome] += 1;
      }
      if (OUTCOMES.some((name) => counts[name] !== result.summary.outcomeCounts[name])) throw new Error('Outcome counts do not reconcile.');
      this.accepted = JSON.parse(JSON.stringify(result)) as Result;
      return true;
    } catch {
      this.pending = null; this.accepted = null; return false;
    }
  }
  current(): Result | null { return this.accepted; }
}

export interface ReconciliationReport {
  requestedIds: number[];
  batches: Result[];
  status: 'RUNNING' | 'COMPLETE' | 'PARTIAL' | 'CANCELLED' | 'FAILED';
  message: string;
}

/** Each batch retains its own transaction, timestamp and fingerprint. There is
 * no claim that a multi-batch report is one atomic database snapshot. */
export class ReconciliationBatchSession {
  private scope = '';
  private path: string | null = null;
  private ids: number[] = [];
  private epoch = 0;
  private cancelled = false;
  private report: ReconciliationReport | null = null;

  changeScope(path: string | null, ids: readonly number[], generation: number): void {
    const scope = JSON.stringify([path, ids, generation]);
    if (scope === this.scope) return;
    this.scope = scope; this.path = path; this.ids = [...ids]; this.invalidate();
  }
  invalidate(): void { this.epoch += 1; this.report = null; this.cancelled = false; }
  close(): void { this.invalidate(); this.scope = ''; this.path = null; this.ids = []; }
  cancel(): void { this.cancelled = true; }
  current(): ReconciliationReport | null { return this.report; }

  async run(api: Pick<DesktopApi, 'previewSplitBonusReconciliation'>,
    onProgress: (captured: number, total: number, batches: number) => void,
    selectedIds?: readonly number[]): Promise<ReconciliationReport | null> {
    const ids = [...new Set(selectedIds ?? this.ids)];
    const scope = new Set(this.ids);
    if (!this.path || !ids.length || ids.some(id => !Number.isSafeInteger(id) || id <= 0 || !scope.has(id))) {
      throw new Error('Select valid diagnostic IDs in the current database scope.');
    }
    this.invalidate(); const epoch = this.epoch; const path = this.path;
    this.report = { requestedIds: ids, batches: [], status: 'RUNNING', message: '' };
    let captured = 0;
    try {
      for (let offset = 0; offset < ids.length; offset += 500) {
        if (this.epoch !== epoch) return null;
        if (this.cancelled) break;
        const batch = new ReconciliationSession();
        batch.changeScope(path, ids.slice(offset, offset + 500), epoch);
        const request = batch.begin();
        const result = await api.previewSplitBonusReconciliation(request);
        if (this.epoch !== epoch) return null;
        if (this.cancelled) break; // Do not adopt the in-flight response after cancellation.
        const first = this.report!.batches[0]?.databaseContext;
        const context = result?.databaseContext;
        if (context && (pathKey(context.canonicalDatabasePath) !== pathKey(path)
          || (first && (first.databaseFileIdentity !== context.databaseFileIdentity || first.schemaFingerprint !== context.schemaFingerprint
          || first.buildIdentity !== context.buildIdentity)))) {
          this.invalidate(); // Changed database/build/schema cannot leave earlier results exportable.
          return null;
        }
        if (!batch.adopt(request, result)) {
          const reason=result?.globalBlockers?.map(blocker=>`${blocker.code}: ${blocker.message}`).join(' | ');
          throw new Error(reason || 'Batch rejected or inconsistent; unreceived IDs remain explicitly not captured.');
        }
        const accepted = batch.current()!;
        this.report = { ...this.report!, batches: [...this.report!.batches, accepted] };
        captured += accepted.rows.length;
        onProgress(captured, ids.length, this.report.batches.length);
      }
      if (this.epoch !== epoch) return null;
      const partial = this.report!.batches.some(batch => batch.status === 'PARTIAL');
      this.report = { ...this.report!, status: this.cancelled ? 'CANCELLED' : partial ? 'PARTIAL' : 'COMPLETE',
        message: this.cancelled ? 'Cancelled. Remaining IDs were not captured.' : partial ? 'Some captured rows need diagnostic retry.' : 'All requested IDs accounted for.' };
    } catch (error) {
      if (this.epoch !== epoch) return null;
      this.report = { ...this.report!, status: this.cancelled ? 'CANCELLED' : 'FAILED',
        message: this.cancelled ? 'Cancelled. Remaining IDs were not captured.' : error instanceof Error ? error.message : 'Diagnostic batch failed.' };
    }
    return this.report;
  }
}

export async function saveReconciliationExport(
  api: Pick<DesktopApi, 'saveTextExport'>,
  payload: { content: string; rowCount: number; defaultExtension: 'csv' | 'txt' },
): Promise<'SAVED' | 'CANCELLED'> {
  const result = await api.saveTextExport({ title: 'Export read-only CA reconciliation preview',
    suggestedFileName: `CA_Reconciliation_Preview.${payload.defaultExtension}`, content: payload.content,
    defaultExtension: payload.defaultExtension, filterName: 'Reconciliation table', filterExtensions: [payload.defaultExtension] });
  if (!result.success) return 'CANCELLED';
  if (!result.filePath) throw new Error('Export returned success without a saved file path.');
  return 'SAVED';
}
