import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx'), 'utf8');
const ast = ts.createSourceFile(
  'DatabaseToolsDialogs.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX,
);

function literalAttributes(name: string): string[] {
  const result: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(ast) === name &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      result.push(node.initializer.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return result;
}

function occurrences(value: string): number {
  return source.split(value).length - 1;
}

describe('Pending Actions compact layout R1', () => {
  it('declares exactly the three compact review bands in one labelled wrapper', () => {
    expect(literalAttributes('data-ca-review-band')).toEqual(['actions', 'filters', 'status']);
    expect(literalAttributes('aria-label').filter((value) => value === 'Pending Actions compact controls')).toHaveLength(1);
  });

  it('scopes compact controls to pending Review and preserves the Approved branch', () => {
    expect(source).toContain("const compactPendingReview =\n    activeOfficialImportSection === 'review' && !showingApprovedImports;");
    expect(source).toContain('Load Approved');
    expect(source).toContain('Load More Approved');
    expect(source).toContain("switchOfficialImportView('review')");
    expect(source).toContain("switchOfficialImportView('approved')");
  });

  it('retains the exact pending action entry points and enablement predicates', () => {
    expect(source).toContain('onClick={() => void loadAndPrepareOfficialImports()}');
    expect(source).toContain('onClick={() => void approveSelectedOfficialImports()}');
    expect(source).toContain('disabled={busy || !hasDatabase || !officialPreparationComplete || selectedEligibleImportRows.length === 0}');
    expect(source).toContain('onClick={() => void approveAllReadyOfficialImports()}');
    expect(source).toContain('disabled={busy || !hasDatabase || !officialPreparationComplete || eligibleImportRows.length === 0}');
  });

  it('keeps symbol, action-type, Find and Current behavior wired to the existing owners', () => {
    expect(source).toContain('value={officialReviewSymbolFilter}');
    expect(source).toContain('setOfficialReviewSymbolFilter(event.target.value);');
    expect(source).toContain('setSelectedImportIds(new Set());');
    expect(source).toContain('setOfficialApprovalConfirmation(null);');
    expect(source).toContain('{renderImportActionTypeFilters()}');
    expect(source).toContain('onChange={(event) => updateOfficialImportSearchQuery(event.target.value)}');
    expect(source).toContain('onClick={() => applyCurrentSymbolFilter(updateOfficialImportSearchQuery, importExchange)}');
    expect(source).toContain('disabled={busy || !hasDatabase}');
    expect(source).toContain('effectiveImportActionTypes');
  });

  it('uses the existing pending counters without introducing alternate eligibility', () => {
    expect(source).toContain('Pending {importRows.length}');
    expect(source).toContain('Filtered {visibleImportRows.length}');
    expect(source).toContain('Ready {eligibleImportRows.length}');
    expect(source).toContain('Selected {selectedEligibleImportRows.length}');
  });

  it('keeps task timing local and gives current status precedence over stale completed progress', () => {
    expect(source).toContain('const pendingCompactMessage = busy && officialTaskProgress && officialTaskProgress.endedAt == null');
    expect(source).toContain(': status || (officialPreparationComplete');
    expect(source).toContain('const pendingCompactTaskIsCurrent = officialTaskProgress != null &&');
    expect(source).toContain("status === officialTaskProgress.message");
    expect(source).toContain('{pendingCompactTaskIsCurrent && officialTaskProgress ? (');
    expect(source).toContain('compact?: boolean;');
    expect(source).toContain('messageOverride?: string;');
    expect(source).toContain('{messageOverride ?? progress.message}');
    expect(occurrences('window.setInterval(() => setNow(Date.now()),1000)')).toEqual(1);
  });

  it('retains safe cancellation in the compact task presentation', () => {
    expect(source).toContain('officialCancelPreparationRef.current = true;');
    expect(source).toContain('setOfficialCanCancelPreparation(false);');
    expect(source).toContain('Cancel after current check');
  });

  it('retains the explicit reviewed approval region and exact approval flow entry points', () => {
    expect(literalAttributes('aria-label')).toContain('Confirm Corporate Action approval');
    expect(source).toContain("requestOfficialImportApproval('selected')");
    expect(source).toContain("requestOfficialImportApproval('all-ready')");
    expect(source).toContain('confirmOfficialImportApproval()');
    expect(source).toContain('Apply reviewed actions');
  });

  it('uses private compact styles and does not globally shrink shared filter or status styles', () => {
    expect(source).toContain('const pendingCompactControlsStyle: React.CSSProperties');
    expect(source).toContain('const pendingCompactActionsStyle: React.CSSProperties');
    expect(source).toContain('const pendingCompactFiltersStyle: React.CSSProperties');
    expect(source).toContain('const pendingCompactStatusBandStyle: React.CSSProperties');
    expect(source).toContain('const corporateImportFilterRowStyle: React.CSSProperties');
    expect(source).toContain('const utilityStatusStyle: React.CSSProperties');
  });

  it('allows the group reason summary to use its full allocated column', () => {
    expect(source).toContain('style={officialPendingGroupReasonStyle} title={reasonSummary}');
    expect(source).not.toContain("maxWidth:'55%'");
    expect(source).toContain('{group.rows.length} pending · {reasonSummary}');
  });

  it('declares the shared hint style before the group-reason style that spreads it', () => {
    const sharedHint = source.indexOf('const corporateIssueHintTextStyle: React.CSSProperties');
    const groupReason = source.indexOf('const officialPendingGroupReasonStyle: React.CSSProperties');
    expect(sharedHint).toBeGreaterThanOrEqual(0);
    expect(groupReason).toBeGreaterThan(sharedHint);
  });

  it('suppresses duplicated pending-only status while retaining non-pending footer behavior', () => {
    expect(source).toContain('{!compactPendingReview ? (\n        <div style={utilityStatusStyle}>');
    expect(source).toContain("activeOfficialImportSection === 'fetch'");
    expect(source).toContain("activeOfficialImportSection === 'history'");
    expect(source).toContain("? 'Review previously approved official Corporate Actions here.");
  });
});
