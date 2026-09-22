import { useEffect, useMemo, useState } from 'react';
import { getDesktopApi } from '@/platform';
import { getActiveChartTab, useChartStore } from '@/store/chartStore';
import { indiaIsoDate } from '../corporateActionDate';
import { buildCorporateActionWorkflowModel } from '../corporateActionWorkflow';
import {
  buildCorporateActionNormalReviewData,
  buildCorporateActionNormalDefaultFetchRange,
  approveCorporateActionNormalReady,
  getCorporateActionNormalReadyImportIds,  createInitialCorporateActionNormalWorkflowFacts,
  fetchCorporateActionNormalData,
  loadCorporateActionNormalData,
  reduceCorporateActionNormalWorkflowFacts,
  type CorporateActionNormalApprovalResult,  type CorporateActionNormalReviewEvent,
  type CorporateActionNormalFetchExchangeSelection,
  type CorporateActionNormalWorkflowCounts,
} from '../workflow/corporateActionNormalWorkflowAdapter';
import {
  formatCorporateActionNormalFetchScope,
  formatCorporateActionNormalLastFetch,
  readCorporateActionNormalLastFetch,
  writeCorporateActionNormalLastFetch,
  type CorporateActionNormalLastFetchRecord,
} from '../workflow/corporateActionNormalFetchHistory';
import { CorporateActionApproveWorkspace } from './CorporateActionApproveWorkspace';
import { CorporateActionReviewWorkspace } from './CorporateActionReviewWorkspace';
import { CorporateActionWorkspace } from './CorporateActionWorkspace';

export interface CorporateActionNormalWorkflowWorkspaceProps {
  onClose: () => void;
}

type RunningOperation = 'fetch' | 'load' | 'approve' | null;

const EMPTY_COUNTS: CorporateActionNormalWorkflowCounts = {
  fetched: 0,
  loaded: 0,
  needsReview: 0,
  conflicts: 0,
  ready: 0,
};

export function formatCorporateActionNormalWorkflowError(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  }

  return fallback;
}

export function CorporateActionNormalWorkflowWorkspace({
  onClose,
}: CorporateActionNormalWorkflowWorkspaceProps) {
  const snapshot = useChartStore((state) => state.snapshot);
  const activeInstrument = useChartStore(
    (state) => getActiveChartTab(state.chartTabs, state.activeChartTabId)?.instrument ?? null,
  );
  const api = getDesktopApi();
  const activeDatabasePath = snapshot?.activeDatabasePath ?? null;
  const hasDatabase = Boolean(activeDatabasePath);
  const [facts, setFacts] = useState(createInitialCorporateActionNormalWorkflowFacts);
  const [counts, setCounts] = useState<CorporateActionNormalWorkflowCounts>(EMPTY_COUNTS);
  const [reviewEvents, setReviewEvents] = useState<readonly CorporateActionNormalReviewEvent[]>([]);
  const [approvalResult, setApprovalResult] = useState<CorporateActionNormalApprovalResult | null>(null);
  const [runningOperation, setRunningOperation] = useState<RunningOperation>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ value: 0, message: '' });
  const initialFetchRange = useMemo(
    () => buildCorporateActionNormalDefaultFetchRange(indiaIsoDate()),
    [],
  );
  const [fetchFromDate, setFetchFromDate] = useState(initialFetchRange.fromDate);
  const [fetchToDate, setFetchToDate] = useState(initialFetchRange.toDate);
  const [fetchExchangeSelection, setFetchExchangeSelection] =
    useState<CorporateActionNormalFetchExchangeSelection>('BOTH');
  const [fetchLog, setFetchLog] = useState<string[]>([]);
  const [lastSuccessfulFetch, setLastSuccessfulFetch] =
    useState<CorporateActionNormalLastFetchRecord | null>(null);
  const workflow = useMemo(() => buildCorporateActionWorkflowModel(facts), [facts]);
  const readyImportCount = useMemo(() => getCorporateActionNormalReadyImportIds(reviewEvents).length, [reviewEvents]);

  useEffect(() => {
    setLastSuccessfulFetch(readCorporateActionNormalLastFetch(activeDatabasePath));
  }, [activeDatabasePath]);

  useEffect(() => {
    if (!api) {
      return undefined;
    }

    return api.onCorporateActionProgress((value, progressMessage) => {
      setProgress({
        value: Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0,
        message: progressMessage,
      });
    });
  }, [api]);

  const handleFetch = async () => {
    if (!api) {
      setError('Desktop API bridge is unavailable.');
      return;
    }
    if (!hasDatabase || !activeDatabasePath) {
      setError('Open a database before fetching Corporate Actions.');
      return;
    }
    if (!fetchFromDate || !fetchToDate) {
      setError('Choose both From and To dates.');
      return;
    }
    if (fetchFromDate > fetchToDate) {
      setError('From date must be on or before To date.');
      return;
    }

    const scopeLabel = formatCorporateActionNormalFetchScope(fetchExchangeSelection);
    setRunningOperation('fetch');
    setError('');
    setMessage('Fetching official ' + scopeLabel + ' Corporate Action coverage...');
    setProgress({ value: 0, message: '' });
    setFetchLog([]);
    setReviewEvents([]);
    setApprovalResult(null);
    setFacts((current) => reduceCorporateActionNormalWorkflowFacts(current, { type: 'FETCH_STARTED' }));

    try {
      const result = await fetchCorporateActionNormalData({
        api,
        fromDate: fetchFromDate,
        toDate: fetchToDate,
        exchangeSelection: fetchExchangeSelection,
        onExchangeStarted: (exchange, input) => {
          setFetchLog((current) => [
            ...current,
            exchange + ' - Fetch started: ' + input.fromDate + ' to ' + input.toDate,
          ]);
        },
        onExchangeCompleted: (exchange, exchangeResult) => {
          setFetchLog((current) => [
            ...current,
            exchange + ' - Complete: ' +
              exchangeResult.rowsRead + ' read, ' +
              exchangeResult.rowsInserted + ' added, ' +
              exchangeResult.rowsDuplicate + ' duplicate, ' +
              exchangeResult.rowsUnresolved + ' unresolved; ' +
              exchangeResult.cachedDays + ' cached day(s), ' +
              exchangeResult.fetchedDays + ' fetched day(s).',
          ]);
        },
        onExchangeFailed: (exchange, exchangeError) => {
          setFetchLog((current) => [
            ...current,
            exchange + ' - Failed: ' +
              formatCorporateActionNormalWorkflowError(
                exchangeError,
                'Official source fetch failed.',
              ),
          ]);
        },
      });

      const completedRecord: CorporateActionNormalLastFetchRecord = {
        scope: fetchExchangeSelection,
        completedAtIso: new Date().toISOString(),
      };
      writeCorporateActionNormalLastFetch(activeDatabasePath, completedRecord);
      setLastSuccessfulFetch(completedRecord);
      setFetchLog((current) => [
        ...current,
        'All selected exchanges complete: ' + result.counts.fetched + ' source row(s).',
      ]);
      setCounts({
        fetched: result.counts.fetched,
        loaded: 0,
        needsReview: 0,
        conflicts: 0,
        ready: 0,
      });
      setFacts((current) => reduceCorporateActionNormalWorkflowFacts(current, { type: 'FETCH_SUCCEEDED' }));
      setMessage(
        'Fetch complete. Source rows ' + result.counts.fetched +
          '; added ' + result.rowsInserted +
          ', duplicate ' + result.rowsDuplicate +
          ', unresolved ' + result.rowsUnresolved +
          '. Nothing was approved automatically.',
      );
    } catch (fetchError) {
      setFacts((current) => reduceCorporateActionNormalWorkflowFacts(current, { type: 'FETCH_FAILED' }));
      setError(formatCorporateActionNormalWorkflowError(fetchError, 'Could not fetch routine Corporate Action data.'));
    } finally {
      setRunningOperation(null);
      setProgress({ value: 0, message: '' });
    }
  };

  const handleLoad = async () => {
    if (!api) {
      setError('Desktop API bridge is unavailable.');
      return;
    }
    if (!hasDatabase) {
      setError('Open a database before loading Corporate Actions.');
      return;
    }

    setRunningOperation('load');
    setError('');
    setMessage('Loading all review candidates and running existing deterministic checks...');
    setProgress({ value: 0, message: '' });
    setReviewEvents([]);
    setApprovalResult(null);
    setFacts((current) => reduceCorporateActionNormalWorkflowFacts(current, { type: 'LOAD_STARTED' }));

    try {
      const result = await loadCorporateActionNormalData({ api });
      const review = await buildCorporateActionNormalReviewData({
        api,
        rows: result.rows,
        scanRows: result.scanRows,
      });
      setReviewEvents(review.events);
      setCounts((current) => ({
        ...current,
        ...review.counts,
      }));
      setFacts((current) =>
        reduceCorporateActionNormalWorkflowFacts(current, {
          type: 'LOAD_SUCCEEDED',
          readyCount: review.counts.ready,
        }),
      );
      setMessage(
        `Load complete. ${result.rows.length} import candidate(s) grouped into ${review.counts.loaded} economic event(s): ${review.counts.ready} Ready, ${review.counts.needsReview} need review, ${review.counts.conflicts} conflict(s). Validated ${result.validatedImportIds.length} Split/Bonus candidate(s) and checked ${result.identityReviewCount} ISIN-review row(s), with ${result.recommendedIdentityCount} strict recommendation(s). Nothing was approved automatically.`,
      );
    } catch (loadError) {
      setFacts((current) => reduceCorporateActionNormalWorkflowFacts(current, { type: 'LOAD_FAILED' }));
      setError(formatCorporateActionNormalWorkflowError(loadError, 'Could not load and process Corporate Action candidates.'));
    } finally {
      setRunningOperation(null);
      setProgress({ value: 0, message: '' });
    }
  };

  const handleReviewCompleted = () => {
    if (counts.ready <= 0) {
      setMessage('No Ready economic events are available for the Approve step.');
      return;
    }
    setApprovalResult(null);
    setFacts((current) =>
      reduceCorporateActionNormalWorkflowFacts(current, {
        type: 'REVIEW_COMPLETED',
        readyCount: counts.ready,
      }),
    );
    setMessage(
      `Review checkpoint complete. ${counts.ready} Ready economic event(s) can continue to Approve. Approval execution is deliberately deferred to Task 5E.`,
    );
  };


  const handleApproveAllReady = async () => {
    if (!api) {
      setError('Desktop API bridge is unavailable.');
      return;
    }
    if (!hasDatabase) {
      setError('Open a database before approving Corporate Actions.');
      return;
    }
    if (readyImportCount <= 0) {
      setMessage('No reviewed Ready imports are available for approval.');
      return;
    }

    setRunningOperation('approve');
    setError('');
    setApprovalResult(null);
    setFacts((current) => reduceCorporateActionNormalWorkflowFacts(current, { type: 'APPROVAL_STARTED' }));

    try {
      const result = await approveCorporateActionNormalReady({
        api,
        reviewEvents,
        onProgress: setMessage,
      });
      setApprovalResult(result);
      setCounts((current) => ({
        ...current,
        ready: result.postRecheck.readyEventCount,
      }));
      setFacts((current) =>
        reduceCorporateActionNormalWorkflowFacts(current, {
          type: 'APPROVAL_FINISHED',
          readyCount: result.postRecheck.readyEventCount,
        }),
      );
      setMessage(result.message);
    } catch (approvalError) {
      setFacts((current) => reduceCorporateActionNormalWorkflowFacts(current, { type: 'APPROVAL_INTERRUPTED' }));
      setError(formatCorporateActionNormalWorkflowError(approvalError, 'Could not complete the normal Corporate Action approval cycle.'));
    } finally {
      setRunningOperation(null);
    }
  };
  const canRun = Boolean(api && hasDatabase && runningOperation === null);
  let stageContent = (
    <p className="corporate-action-workspace-stage-note">
      Normal Corporate Action workflow stage is preparing.
    </p>
  );

  if (workflow.currentStage === 'fetch') {
    stageContent = (
      <>
        <div className="corporate-action-workspace-fetch-controls">
          <label>
            <span>Exchange</span>
            <select
              value={fetchExchangeSelection}
              onChange={(event) =>
                setFetchExchangeSelection(
                  event.target.value as CorporateActionNormalFetchExchangeSelection,
                )
              }
            >
              <option value="BOTH">NSE + BSE</option>
              <option value="NSE">NSE</option>
              <option value="BSE">BSE</option>
            </select>
          </label>
          <label>
            <span>From</span>
            <input
              type="date"
              value={fetchFromDate}
              max={fetchToDate || undefined}
              onChange={(event) => setFetchFromDate(event.target.value)}
            />
          </label>
          <label>
            <span>To</span>
            <input
              type="date"
              value={fetchToDate}
              min={fetchFromDate || undefined}
              onChange={(event) => setFetchToDate(event.target.value)}
            />
          </label>
          <div className="corporate-action-workspace-fetch-action">
            <button
              type="button"
              className="corporate-action-workspace-primary-action"
              disabled={!canRun || !fetchFromDate || !fetchToDate || fetchFromDate > fetchToDate}
              onClick={() => void handleFetch()}
            >
              {runningOperation === 'fetch' ? 'FETCHING...' : 'FETCH LATEST DATA'}
            </button>
            <span className="corporate-action-workspace-last-fetch">
              Last successful fetch: {formatCorporateActionNormalLastFetch(lastSuccessfulFetch)}
            </span>
          </div>
        </div>
        <p className="corporate-action-workspace-stage-note">
          {formatCorporateActionNormalFetchScope(fetchExchangeSelection)} | editable From/To dates | defaults to the last 90 calendar days through today | cached coverage reused | force refresh off
        </p>
        {!hasDatabase ? (
          <p className="corporate-action-workspace-stage-note">Open a database first.</p>
        ) : null}
        {!api ? (
          <p className="corporate-action-workspace-stage-note">Desktop API bridge is unavailable.</p>
        ) : null}
      </>
    );
  }

  if (workflow.currentStage === 'load') {
    stageContent = (
      <div className="corporate-action-workspace-action-row">
        <button
          type="button"
          className="corporate-action-workspace-primary-action"
          disabled={!canRun}
          onClick={() => void handleLoad()}
        >
          {runningOperation === 'load' ? 'PROCESSING...' : 'LOAD & PROCESS'}
        </button>
        <span>
          Loads the full review queue, validates eligible Split/Bonus rows, checks strict identity recommendations, and prepares authoritative economic-event Review cards. Ambiguities remain read-only.
        </span>
      </div>
    );
  }

  if (workflow.currentStage === 'review') {
    stageContent = (
      <CorporateActionReviewWorkspace
        events={reviewEvents}
        currentChartSymbol={activeInstrument?.symbol ?? null}
        onContinueToApprove={handleReviewCompleted}
      />
    );
  }
  if (workflow.currentStage === 'approve') {
    stageContent = (
      <CorporateActionApproveWorkspace
        readyEventCount={approvalResult?.postRecheck.readyEventCount ?? counts.ready}
        readyImportCount={approvalResult?.postRecheck.readyImportIds.length ?? readyImportCount}
        running={runningOperation === 'approve'}
        result={approvalResult}
        onApproveAllReady={() => void handleApproveAllReady()}
      />
    );
  }

  const statusContent = message || error || progress.message || fetchLog.length ? (
    <div
      className="corporate-action-workspace-operation-status"
      data-error={error ? 'true' : 'false'}
      role="status"
      aria-live="polite"
    >
      {error ? <span>{error}</span> : null}
      {!error && progress.message ? <span>{progress.message}</span> : null}
      {!error && !progress.message && message ? <span>{message}</span> : null}
      {progress.message ? <progress max={100} value={progress.value} /> : null}
      {fetchLog.length ? (
        <ol className="corporate-action-workspace-fetch-log" aria-label="Official fetch status log">
          {fetchLog.map((entry, index) => (
            <li key={String(index) + ':' + entry}>{entry}</li>
          ))}
        </ol>
      ) : null}
    </div>
  ) : null;

  return (
    <CorporateActionWorkspace
      activeStage={workflow.currentStage}
      counts={counts}
      onClose={onClose}
      stageContent={stageContent}
      statusContent={statusContent}
    />
  );
}
