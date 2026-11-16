import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, vi } from 'vitest';
import type { OfficialSourceConfigurationAuthority, OfficialSourceHistoryEntry, OfficialSourceUrls } from '@/platform';
import { IdentityImportWorkspace } from '../../corporateActions/identity/IdentityImportWorkspace';
import { DEFAULT_IDENTITY_DISPLAY, type IdentityView } from '../../corporateActions/identity/identityDisplayPreferences';
import { IdentitySourceHistory, SourceHistoryContent } from '../../corporateActions/identity/IdentitySourceHistory';
import type { SourceHistoryState } from '../../corporateActions/identity/sourceHistoryLoader';

// Render the current React components; do not evaluate extracted JSX with new Function.
const ui = readFileSync(resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx'), 'utf8');
const confirmationSource = readFileSync(resolve(process.cwd(), 'src/components/common/useActionConfirmation.tsx'), 'utf8');
const workspaceCss = readFileSync(resolve(process.cwd(), 'src/features/corporateActions/identity/identityImportWorkspace.css'), 'utf8');

function between(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, 'Missing source marker: ' + startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, 'Missing source marker after ' + startMarker + ': ' + endMarker);
  return source.slice(start, end);
}

const maintenance = between(ui, 'const renderOfficialSourceHealthPanel = () => {', 'const renderIdentityTab = () => (');

const authority: OfficialSourceConfigurationAuthority = {
  schemaVersion: 1,
  configurationFingerprint: 'offline-er4-history-fixture',
  urls: {} as OfficialSourceUrls,
  sources: [{
    sourceKey: 'NSE_CURRENT_EQUITY_MASTER',
    exchange: 'NSE',
    sourceId: 'NSE_EQUITY_MASTER',
    sourceRole: 'Equity master',
    configField: 'nseEquityMasterUrl',
    candidatePromotionEligible: true,
    currentVersionId: 15,
    revision: 5,
    currentUrl: 'https://example.invalid/equity.csv',
  }],
};

const historicalEntry: OfficialSourceHistoryEntry = {
  entryKind: 'VERSION',
  versionId: 14,
  revision: 4,
  active: false,
  url: 'https://example.invalid/previous-equity.csv',
  changeKind: 'BASELINE_IMPORT',
  parentVersionId: null,
  createdAt: '2026-09-17T13:17:00Z',
  candidateContentSha256: null,
  reviewDecision: null,
  reviewResultStatus: null,
  resultVersionId: null,
  operatorNote: null,
  postHealthStatus: null,
};

function renderWorkspace(view: IdentityView) {
  const loadHistory = vi.fn(async (_sourceKey: string): Promise<OfficialSourceHistoryEntry[]> => []);
  const markup = renderToStaticMarkup(createElement(IdentityImportWorkspace, {
    databasePath: 'Offline fixture',
    busy: false,
    header: createElement('span', null, 'NSE'),
    sourceControls: null,
    summary: 'Source health not checked',
    status: '',
    current: createElement('p', null, 'Current preview'),
    currentToolbar: createElement('button', { type: 'button' }, 'Preview Saved Sources'),
    currentFooter: createElement('button', { type: 'button', disabled: true }, 'Apply Reviewed Changes'),
    historical: createElement('p', null, 'Historical preview'),
    recent: createElement('p', null, 'Recent applied'),
    diagnostics: createElement(IdentitySourceHistory, {
      authority, exchange: 'NSE', busy: false, hasDatabase: true,
      configurationError: '', onReloadSources: () => undefined, loadHistory,
    }),
    preferences: { ...DEFAULT_IDENTITY_DISPLAY, view },
  }));
  return { markup, loadHistory };
}

function renderHistory(state: SourceHistoryState): string {
  return renderToStaticMarkup(createElement(SourceHistoryContent, { state }));
}

describe('ER4 FIX3 history reachability and preserved eligibility', () => {
  it('ER4_FIX3_SCROLL_OWNER: diagnostics has a bounded scroll owner without clipping history', () => {
    const { markup } = renderWorkspace('diagnostics');
    assert.match(markup, /class="identity-import-workspace"/);
    assert.match(markup, /identity-workspace-content identity-diagnostics-content/);
    assert.match(markup, /role="tabpanel"/);
    assert.doesNotMatch(markup, /Current preview/);
    assert.match(workspaceCss, /\.identity-import-workspace\s*\{[^}]*min-height:0;[^}]*overflow:hidden;/);
    assert.match(workspaceCss, /\.identity-diagnostics-content\s*\{\s*overflow:auto;\s*\}/);
    assert.match(workspaceCss, /@media \(max-width:700px\), \(max-height:600px\)\s*\{[\s\S]*?\.identity-import-workspace\s*\{\s*overflow-y:auto;\s*\}/);
  });

  it('keeps independent saved history reachable without candidate discovery or automatic mutation', () => {
    const historyIndex = maintenance.indexOf('<IdentitySourceHistory');
    const candidateIndex = maintenance.indexOf('{officialSourceCandidateResult ? (');
    assert.ok(historyIndex >= 0 && candidateIndex > historyIndex,
      'Independent saved history must precede the candidate-only review');
    assert.match(maintenance, /<details open=\{Boolean\(officialSourceCandidateResult\)\}>/);
    assert.match(maintenance, /No replacement review is loaded/);
    const { markup, loadHistory } = renderWorkspace('diagnostics');
    assert.match(markup, /Saved source versions and review history/);
    assert.match(markup, /Load \/ Refresh History/);
    assert.match(markup, /Replacement discovery is not required/);
    assert.doesNotMatch(markup, /Review Rollback|Apply Reviewed Rollback/);
    assert.equal(loadHistory.mock.calls.length, 0, 'Rendering must not read history or change sources');
  });

  it('gates candidate rollback review to prior eligible NSE versions', () => {
    const guard = maintenance.match(/const canReviewRollback\s*=\s*([\s\S]*?);/);
    assert.ok(guard, 'Candidate rollback eligibility guard is missing');
    assert.equal(guard[1].replace(/\s+/g, ' ').trim(),
      "entry.entryKind === 'VERSION' && !entry.active && selectedCandidateAuthority?.exchange === 'NSE' && selectedCandidateAuthority.candidatePromotionEligible");
    assert.match(maintenance, /\{canReviewRollback \|\| canRetryHealth \? \(/);
    assert.match(maintenance, /\{canReviewRollback \? \(/);
    assert.match(maintenance, /onClick=\{\(\) => void reviewOfficialSourceRollback\(entry\)\}/);
  });

  it('requires explicit review and operator confirmation before applying a rollback', () => {
    const review = between(ui, 'const reviewOfficialSourceRollback = async (entry:', 'const applyOfficialSourceRollback = async () => {');
    const apply = between(ui, 'const applyOfficialSourceRollback = async () => {', 'const retryOfficialSourcePostHealth = async');
    assert.match(review, /!api \|\| !hasDatabase \|\| !officialSourceCandidateResult/);
    assert.match(review, /api\.createOfficialSourceRollbackReview\(/);
    assert.doesNotMatch(review, /api\.applyOfficialSourceRollbackReviewed\(/);
    assert.match(maintenance, /\{officialSourceRollbackReview \? \(/);
    assert.match(maintenance, /onClick=\{\(\) => void applyOfficialSourceRollback\(\)\}/);
    assert.match(apply, /!api \|\| !hasDatabase \|\| !officialSourceRollbackReview/);
    // The native window.confirm was replaced by the explicit themed action dialog.
    // The async negative guard must still return before the reviewed backend write.
    assert.match(apply, /if\s*\(\s*!await confirmation\.confirm\(/);
    const confirmIndex = apply.indexOf('await confirmation.confirm(');
    const applyIndex = apply.indexOf('api.applyOfficialSourceRollbackReviewed(');
    assert.ok(confirmIndex >= 0 && applyIndex > confirmIndex,
      'Only the explicitly confirmed reviewed rollback may invoke the backend');
    assert.match(ui, /\{confirmation\.dialog\}/, 'The operator confirmation dialog must be mounted');
    assert.match(confirmationSource, /role="alertdialog" aria-modal="true"/);
    assert.match(confirmationSource, /onClick=\{\(\) => finish\(false\)\}/,
      'The operator must be able to cancel before any backend write');
    assert.match(confirmationSource, /if \(pending\.current\) return Promise\.resolve\(false\)/,
      'A second confirmation request must fail closed');
  });

  it('distinguishes unloaded, empty, failed and loaded saved history without discovery', () => {
    assert.match(renderHistory({ status: 'idle' }), /Select a source and choose Load \/ Refresh History/);
    assert.match(renderHistory({ status: 'loading', sourceKey: 'NSE_CURRENT_EQUITY_MASTER' }), /Loading saved source history/);
    assert.match(renderHistory({ status: 'error', sourceKey: 'NSE_CURRENT_EQUITY_MASTER', message: 'locked' }), /History could not be loaded: locked/);
    assert.match(renderHistory({ status: 'loaded', sourceKey: 'NSE_CURRENT_EQUITY_MASTER', entries: [] }),
      /No saved version or review history is available for this source/);
    const loaded = renderHistory({ status: 'loaded', sourceKey: 'NSE_CURRENT_EQUITY_MASTER', entries: [historicalEntry] });
    assert.match(loaded, /Historical/);
    assert.match(loaded, /History is not approval authority/);
    assert.doesNotMatch(loaded, /Review Rollback|Apply Reviewed Rollback|<button/);
  });

  it('keeps other Corporate Actions tabs on their shared panel style', () => {
    const identity = between(ui, 'const renderIdentityTab = () => (', 'const renderImportsTab');
    assert.match(identity, /<IdentityImportWorkspace\b/);
    assert.doesNotMatch(identity, /style=\{identityRecoveryPanelStyle\}/);
    const shared = between(ui, 'const corporateActionPanelStyle: React.CSSProperties = {', '};');
    assert.match(shared, /minHeight:\s*0/);
    assert.match(shared, /flex:\s*1/);
    assert.doesNotMatch(shared, /\boverflow[XY]?:/);
    for (const name of ['renderImportsTab', 'renderScanTab', 'renderIssuesTab']) {
      const pattern = new RegExp('const ' + name + ' = \\(\\) => \\(\\s*<div style=\\{corporateActionPanelStyle\\}>');
      assert.match(ui, pattern, name + ' must retain the shared Corporate Actions style');
    }
  });
});
