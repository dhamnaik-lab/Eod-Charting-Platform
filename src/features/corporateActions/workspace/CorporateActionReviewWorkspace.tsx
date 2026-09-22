import { useMemo, useState, type ChangeEvent } from 'react';
import {
  CORPORATE_ACTION_EVENT_STATUS_LABELS,
  type CorporateActionEventStatus,
} from '../corporateActionWorkflow';
import {
  formatCorporateActionEventIdentityTitle,
  formatCorporateActionEventIsin,
} from '../corporateActionEventIdentityPresentation';
import type {
  CorporateActionNormalReviewEvent,
  CorporateActionNormalReviewEvidenceRow,
} from '../workflow/corporateActionNormalWorkflowAdapter';

export interface CorporateActionReviewWorkspaceProps {
  events: readonly CorporateActionNormalReviewEvent[];
  currentChartSymbol?: string | null;
  onContinueToApprove: () => void;
}

type ReviewFilter = 'all' | 'exceptions' | 'ready';

function isException(status: CorporateActionEventStatus): boolean {
  return status === 'NEEDS_REVIEW' || status === 'CONFLICT';
}

function matchesSearch(item: CorporateActionNormalReviewEvent, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }
  const event = item.event;
  const identityTerms = item.evidenceRows.flatMap((evidence) => [
    evidence.importRow.isin,
    evidence.eventIdentity?.eventIsin,
  ]);
  const text = [
    event.title,
    event.exchange,
    event.symbol,
    event.companyName,
    event.exDate,
    event.actionLabel,
    event.status,
    event.statusReason,
    ...event.sources,
    ...identityTerms,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();
  return text.includes(normalizedQuery);
}

function matchesFilter(item: CorporateActionNormalReviewEvent, filter: ReviewFilter): boolean {
  if (filter === 'exceptions') {
    return isException(item.event.status);
  }
  if (filter === 'ready') {
    return item.event.status === 'READY';
  }
  return true;
}

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }
  return value.toFixed(digits);
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }
  return `${value.toFixed(2)}%`;
}

function EvidenceRow({ evidence }: { evidence: CorporateActionNormalReviewEvidenceRow }) {
  const row = evidence.importRow;
  const scan = evidence.scan;
  const identity = evidence.eventIdentity;
  const price = evidence.pricePresentation;

  return (
    <article className="corporate-action-review-evidence-row" data-import-id={row.id}>
      <header>
        <strong>Import #{row.id}</strong>
        <span>{row.source}</span>
      </header>
      <dl>
        <div>
          <dt>Raw identity</dt>
          <dd>{row.symbol ? `${row.exchange}:${row.symbol}` : row.isin ?? '-'}</dd>
        </div>
        <div>
          <dt>Event identity</dt>
          <dd>{identity?.resolved ? `${identity.exchange}:${identity.eventSymbol ?? '-'}` : 'Raw source identity'}</dd>
        </div>
        <div>
          <dt>Event ISIN</dt>
          <dd>{formatCorporateActionEventIsin(identity?.eventIsin)}</dd>
        </div>
        <div>
          <dt>Action</dt>
          <dd>{row.actionType} · share × {formatNumber(row.factor, 6)}</dd>
        </div>
        <div>
          <dt>Review state</dt>
          <dd>{row.reviewStatus} · {evidence.approvalState}</dd>
        </div>
        <div>
          <dt>Validation</dt>
          <dd>{evidence.validationLabel}</dd>
        </div>
        <div>
          <dt>Status reason</dt>
          <dd>{evidence.statusReason ?? '-'}</dd>
        </div>
        <div>
          <dt>Evidence sources</dt>
          <dd>{row.evidenceSources.length ? row.evidenceSources.join(', ') : row.source}</dd>
        </div>
        <div>
          <dt>Evidence count</dt>
          <dd>{row.evidenceCount}</dd>
        </div>
        <div>
          <dt>Latest source locator</dt>
          <dd>{row.latestEvidenceSourceLocator ?? row.sourceFile ?? '-'}</dd>
        </div>
        <div>
          <dt>Captured</dt>
          <dd>{row.latestEvidenceCapturedAt ?? '-'}</dd>
        </div>
      </dl>

      {identity?.resolved ? (
        <p className="corporate-action-review-evidence-note">
          {formatCorporateActionEventIdentityTitle(identity)}
        </p>
      ) : null}

      {row.message || row.latestEvidenceNote ? (
        <div className="corporate-action-review-evidence-message">
          {row.message ? <p>{row.message}</p> : null}
          {row.latestEvidenceNote ? <p>{row.latestEvidenceNote}</p> : null}
        </div>
      ) : null}

      {scan ? (
        <section className="corporate-action-review-price-evidence" aria-label="Price validation evidence">
          <strong>Price validation</strong>
          <span>{scan.scanStatus} · confidence {formatPercent((scan.confidence ?? 0) * 100)}</span>
          <span>
            Previous close {formatNumber(scan.prevClose)} → theoretical {formatNumber(price?.theoreticalPrice)} → ex-open {formatNumber(scan.exOpen)}
          </span>
          <span>
            Open residual {formatPercent(price?.openResidualPct)} · close residual {formatPercent(price?.closeResidualPct)}
          </span>
          {price?.summary ? <span>{price.summary}</span> : null}
          {scan.message ? <span>{scan.message}</span> : null}
        </section>
      ) : null}
    </article>
  );
}

function EventCard({
  item,
  onOpenEvidence,
}: {
  item: CorporateActionNormalReviewEvent;
  onOpenEvidence: (eventKey: string) => void;
}) {
  const event = item.event;

  return (
    <article
      className="corporate-action-review-card"
      data-event-key={event.eventKey}
      data-status={event.status}
    >
      <header className="corporate-action-review-card-header">
        <div>
          <span className="corporate-action-review-status">
            {CORPORATE_ACTION_EVENT_STATUS_LABELS[event.status]}
          </span>
          <h3>{event.title}</h3>
          <p>{event.exchange} · {event.exDate ?? 'Date unavailable'} · {event.actionLabel}</p>
        </div>
        <button type="button" onClick={() => onOpenEvidence(event.eventKey)}>
          VIEW EVIDENCE
        </button>
      </header>

      {event.statusReason ? (
        <p className="corporate-action-review-reason">{event.statusReason}</p>
      ) : null}

      <div className="corporate-action-review-card-meta">
        <span>{event.sourceRowCount} import row(s)</span>
        <span>{event.sources.length} source type(s)</span>
        <span>{event.duplicateSourceRowCount} collapsed duplicate component row(s)</span>
      </div>

      {event.pricePresentation?.summary ? (
        <p className="corporate-action-review-price-summary">
          {event.pricePresentation.summary} · theoretical {formatNumber(event.pricePresentation.theoreticalPrice)} · open residual {formatPercent(event.pricePresentation.openResidualPct)}
        </p>
      ) : null}
    </article>
  );
}

export function CorporateActionReviewWorkspace({
  events,
  currentChartSymbol = null,
  onContinueToApprove,
}: CorporateActionReviewWorkspaceProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [selectedEventKey, setSelectedEventKey] = useState<string | null>(null);

  const visibleEvents = useMemo(
    () => events.filter((item) => matchesFilter(item, filter) && matchesSearch(item, query)),
    [events, filter, query],
  );
  const exceptionEvents = visibleEvents.filter((item) => isException(item.event.status));
  const routineEvents = visibleEvents.filter((item) => !isException(item.event.status));
  const readyCount = events.filter((item) => item.event.status === 'READY').length;
  const selectedEvent = events.find((item) => item.event.eventKey === selectedEventKey) ?? null;

  return (
    <div className="corporate-action-review-workspace" data-corporate-action-review>
      <div className="corporate-action-review-toolbar">
        <label>
          <span>Find event</span>
          <div className="corporate-action-review-search-controls">
            <input
              type="search"
              value={query}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
              placeholder="Symbol, company, action, date or source"
            />
            <button
              type="button"
              className="corporate-action-review-current-filter"
              disabled={!currentChartSymbol}
              onClick={() => setQuery(currentChartSymbol ?? '')}
              title={currentChartSymbol ? `Filter Review to current chart symbol ${currentChartSymbol}` : 'Open a chart symbol first'}
            >
              CURRENT
            </button>
          </div>
        </label>
        <label>
          <span>Show</span>
          <select value={filter} onChange={(event: ChangeEvent<HTMLSelectElement>) => setFilter(event.target.value as ReviewFilter)}>
            <option value="all">All events</option>
            <option value="exceptions">Needs Review + Conflicts</option>
            <option value="ready">Ready only</option>
          </select>
        </label>
      </div>

      {exceptionEvents.length ? (
        <section className="corporate-action-review-section" aria-label="Exceptions requiring review">
          <div className="corporate-action-review-section-heading">
            <h3>Needs attention</h3>
            <span>{exceptionEvents.length}</span>
          </div>
          <div className="corporate-action-review-card-list">
            {exceptionEvents.map((item) => (
              <EventCard key={item.event.eventKey} item={item} onOpenEvidence={setSelectedEventKey} />
            ))}
          </div>
        </section>
      ) : null}

      {routineEvents.length ? (
        <section className="corporate-action-review-section" aria-label="Ready and completed events">
          <div className="corporate-action-review-section-heading">
            <h3>Ready and routine</h3>
            <span>{routineEvents.length}</span>
          </div>
          <div className="corporate-action-review-card-list corporate-action-review-card-list-compact">
            {routineEvents.map((item) => (
              <EventCard key={item.event.eventKey} item={item} onOpenEvidence={setSelectedEventKey} />
            ))}
          </div>
        </section>
      ) : null}

      {!visibleEvents.length ? (
        <p className="corporate-action-workspace-stage-note">No economic events match this Review filter.</p>
      ) : null}

      <div className="corporate-action-review-footer">
        <p>
          Identity, price, and other specialist exceptions remain read-only here. Escalation to Corporate Action Maintenance is handled by the later Maintenance reconstruction tasks.
        </p>
        <button
          type="button"
          className="corporate-action-workspace-primary-action"
          disabled={readyCount === 0}
          onClick={onContinueToApprove}
        >
          CONTINUE TO APPROVE · {readyCount}
        </button>
      </div>

      {selectedEvent ? (
        <aside className="corporate-action-review-drawer" aria-label="Corporate Action evidence drawer">
          <header>
            <div>
              <span className="corporate-action-workspace-eyebrow">Evidence</span>
              <h3>{selectedEvent.event.title}</h3>
              <p>{selectedEvent.event.actionLabel} · {selectedEvent.event.exDate ?? 'Date unavailable'}</p>
            </div>
            <button type="button" onClick={() => setSelectedEventKey(null)} aria-label="Close evidence drawer">
              Close
            </button>
          </header>
          <div className="corporate-action-review-drawer-body">
            {selectedEvent.evidenceRows.map((evidence) => (
              <EvidenceRow key={evidence.importRow.id} evidence={evidence} />
            ))}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
