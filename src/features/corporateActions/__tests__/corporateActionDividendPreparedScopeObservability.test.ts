import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Normalize Windows checkout line endings before inspecting JSX layout boundaries.
const source = readFileSync(resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx'), 'utf8').replace(/\r\n/g, '\n');

function sliceBetween(start: string, end: string): string {
  const startIndex = source.indexOf(start);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

function occurrences(value: string): number {
  return source.split(value).length - 1;
}

describe('Dividend prepared-scope P3C read-only observability', () => {
  it('publishes only the current completed generation and database outcome', () => {
    expect(source).toContain(
      'const currentOfficialDividendPreparedScopeOutcome = officialDividendPreparedScopeOutcome && !busy && officialPreparationComplete &&',
    );
    expect(source).toContain('officialDividendPreparedScopeOutcome.databasePath === activeDatabasePath &&');
    expect(source).toContain(
      'officialDividendPreparedScopeOutcome.generation === officialPreparationGenerationRef.current',
    );
    expect(source).toContain('? officialDividendPreparedScopeOutcome : null;');
  });

  it('indexes row dispositions only from the current-cycle outcome', () => {
    expect(source).toContain('const officialDividendPreparedScopeDispositionByImportId = useMemo(() => {');
    expect(source).toContain('currentOfficialDividendPreparedScopeOutcome?.result.dispositions ?? []');
    expect(source).toContain('dispositions.set(disposition.importId, disposition);');
    expect(source).toContain('}, [currentOfficialDividendPreparedScopeOutcome]);');
  });

  it('renders the Dividend summary beside existing Safe V2 status without replacing it', () => {
    const status = sliceBetween(
      '<div data-ca-review-band="status"',
      '<div style={officialImportSectionCardStyle}>',
    );
    expect(status).toContain('<OfficialSafeV2OutcomeSummary result={currentOfficialAutoApproval} />');
    expect(status).toContain(
      '<OfficialDividendPreparedScopeOutcomeSummary outcome={currentOfficialDividendPreparedScopeOutcome} />',
    );
  });

  it('labels the compact summary explicitly as read-only and not approved', () => {
    const summary = sliceBetween(
      'function OfficialDividendPreparedScopeOutcomeSummary(',
      'function OfficialDividendPreparedScopeDispositionDetails(',
    );
    expect(summary).toContain('aria-label="Dividend R1 read-only outcome summary"');
    expect(summary).toContain('Dividend R1 read-only — NOT APPROVED:');
    expect(summary).toContain('eligible {result.eligible} (read-only, not approved)');
  });

  it('shows every aggregate disposition count and batch completeness in the summary', () => {
    const summary = sliceBetween(
      'function OfficialDividendPreparedScopeOutcomeSummary(',
      'function OfficialDividendPreparedScopeDispositionDetails(',
    );
    for (const field of [
      'result.requested',
      'result.eligible',
      'result.ineligible',
      'result.alreadyApproved',
      'result.staleScope',
      'result.missing',
      'result.failed',
      'result.completedBatchCount',
      'result.batchCount',
      'result.complete',
    ]) {
      expect(summary).toContain(field);
    }
  });

  it('surfaces an incomplete operational error as text only', () => {
    const summary = sliceBetween(
      'function OfficialDividendPreparedScopeOutcomeSummary(',
      'function OfficialDividendPreparedScopeDispositionDetails(',
    );
    expect(summary).toContain("{result.operationalError ? <> · issue: {result.operationalError}</> : null}");
    expect(summary).not.toContain('dangerouslySetInnerHTML');
  });

  it('qualifies an eligible row disposition as read-only and not approved', () => {
    const details = sliceBetween(
      'function OfficialDividendPreparedScopeDispositionDetails(',
      'type OfficialImportTaskProgress',
    );
    expect(details).toContain("disposition.disposition === 'ELIGIBLE'");
    expect(details).toContain("'ELIGIBLE (READ-ONLY, NOT APPROVED)'");
    expect(details).toContain('Dividend R1 read-only — {dispositionLabel}: {disposition.reason}');
  });

  it('shows exact backend disposition reason without interpreting it as manual eligibility', () => {
    const details = sliceBetween(
      'function OfficialDividendPreparedScopeDispositionDetails(',
      'type OfficialImportTaskProgress',
    );
    expect(details).toContain('{disposition.reason}');
    expect(details).not.toContain('canApprove');
    expect(details).not.toContain('selectedImportIds');
  });

  it('shows P2 evidence only when backend evidence exists', () => {
    const details = sliceBetween(
      'function OfficialDividendPreparedScopeDispositionDetails(',
      'type OfficialImportTaskProgress',
    );
    expect(details).toContain('{evidence ? (');
    expect(details).toContain('evidence.cashAmount');
    expect(details).toContain('evidence.previousClose');
    expect(details).toContain('evidence.previousTradeDate');
    expect(details).toContain('evidence.computedFactor.toFixed(8)');
    expect(details).toContain('evidence.identityProof');
    expect(details).toContain('evidence.officialEvidenceId');
    expect(details).toContain('evidence.sourceLocator');
  });

  it('renders row observability only through the existing expanded review row', () => {
    // Classic detail rendering and expanded Advanced Pending rows each display
    // the same backend disposition; Approved rows must not render either.
    expect(occurrences('<OfficialDividendPreparedScopeDispositionDetails')).toBe(2);
    const classicDetails = sliceBetween('renderDetails={row=><>', '  const renderImportsTab = () => (');
    expect(classicDetails).toContain('officialDividendPreparedScopeDispositionByImportId.get(row.id)');
    const expandedRows = sliceBetween('{expanded ? group.rows.map((row) => {', '}) : null}');
    expect(expandedRows).toContain('officialDividendPreparedScopeDispositionByImportId.get(row.id)');
    const approvedRows = sliceBetween(': visibleImportRows.map((row) => {', '              {importRows.length === 0 ? (');
    expect(approvedRows).not.toContain('<OfficialDividendPreparedScopeDispositionDetails');
  });

  it('adds no new action control to either Dividend presentation helper', () => {
    const presentation = sliceBetween(
      'function OfficialDividendPreparedScopeOutcomeSummary(',
      'type OfficialImportTaskProgress',
    );
    expect(presentation).not.toContain('<button');
    expect(presentation).not.toContain('onClick=');
    expect(presentation).not.toContain('setSelectedImportIds');
    expect(presentation).not.toContain('approveCorporateAction');
  });

  it('requires verified Dividend readiness without using the raw read-only outcome as Apply authority', () => {
    const eligibility = sliceBetween(
      'const eligibleImportRows = visibleImportRows.filter(',
      '\n  // Aggregate the complete loaded pending queue, independent of type/symbol UI filters.',
    );
    expect(eligibility).toContain('isOfficialRowReady(row)');
    expect(eligibility).not.toContain('officialDividendPreparedScope');
    expect(eligibility).not.toContain('DividendPreparedScope');
    const readiness = sliceBetween(
      'const isOfficialRowReady = (row: CorporateActionImportRow): boolean => {',
      'const eligibleImportRows = visibleImportRows.filter(',
    );
    expect(readiness).toContain('dividendPreparedImportIds.has(row.id)');
    expect(readiness).toContain("disposition?.disposition === 'ELIGIBLE'");
    expect(readiness).toContain('disposition.evidence != null');
  });

  it('preserves the existing successful preparation status authority', () => {
    expect(source).toContain('setStatus(result.message);');
    const summary = sliceBetween(
      'function OfficialDividendPreparedScopeOutcomeSummary(',
      'function OfficialDividendPreparedScopeDispositionDetails(',
    );
    expect(summary).not.toContain('setStatus(');
  });

  it('invalidates stale Dividend evidence and retains only reconciled same-generation results', () => {
    // Reset on database change, close, row reload, preparation start/failure,
    // and failed approval reconciliation. Successful reconciliation publishes
    // refreshed evidence rather than clearing it unconditionally.
    expect(occurrences('setOfficialDividendPreparedScopeOutcome(null)')).toBe(6);
    expect(source).toContain('setOfficialDividendPreparedScopeOutcome(refreshed.outcome);');
    expect(source).toContain('if (!queueReconciled) {\n          setOfficialDividendPreparedScopeOutcome(null);');
    expect(source).toContain('setOfficialDividendPreparedScopeOutcome(saved.dividendOutcome);');
    expect(source).toContain('officialDividendPreparedScopeOutcome.generation === officialPreparationGenerationRef.current');
  });

  it('does not persist Dividend observability state', () => {
    const presentation = sliceBetween(
      'function OfficialDividendPreparedScopeOutcomeSummary(',
      'type OfficialImportTaskProgress',
    );
    expect(presentation).not.toContain('localStorage');
    expect(presentation).not.toContain('sessionStorage');
    expect(presentation).not.toContain('writeSetting');
    expect(presentation).not.toContain('setSetting');
  });

  it('does not create a new backend call in the presentation layer', () => {
    const presentation = sliceBetween(
      'function OfficialDividendPreparedScopeOutcomeSummary(',
      'type OfficialImportTaskProgress',
    );
    expect(presentation).not.toContain('evaluateSimpleCashDividendPreparedScope');
    expect(presentation).not.toContain('evaluateCorporateActionDividendPreparedScopeBatches');
  });

  it('keeps approved-view behavior separate from pending observability', () => {
    expect(source).toContain("const compactPendingReview =\n    activeOfficialImportSection === 'review' && !showingApprovedImports;");
    expect(source).toContain('Load Approved');
    expect(source).toContain('Load More Approved');
  });

  it('documents the retained state as presentation evidence rather than write authority', () => {
    expect(source).toContain(
      '// Current-cycle Dividend evaluation is read-only presentation evidence, never manual Apply or write authority.',
    );
  });
});
