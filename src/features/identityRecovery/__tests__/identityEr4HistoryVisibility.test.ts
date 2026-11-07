import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';
import ts from 'typescript';

// Evaluate the actual render functions and style declarations, not a second UI.
// h records JSX without mounting hooks or opening the desktop API/database.
type View = { tag: unknown; props: Record<string, any>; children: any[] };
const Fragment = Symbol('Fragment');
function h(tag: unknown, props: Record<string, any> | null, ...children: any[]): View {
  return { tag, props: props ?? {}, children: children.flat(Infinity).filter(
    (child) => child !== null && child !== undefined && typeof child !== 'boolean',
  ) };
}
const UI_PATH = resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx');
const source = readFileSync(UI_PATH, 'utf8');
const workspaceCss = readFileSync(resolve(process.cwd(), 'src/features/corporateActions/identity/identityImportWorkspace.css'), 'utf8');
const ast = ts.createSourceFile(UI_PATH, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const definitions = new Map<string, ts.Node>();
function visit(node: ts.Node): void {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
    definitions.set(node.name.text, node.initializer);
  }
  if (ts.isFunctionDeclaration(node) && node.name) definitions.set(node.name.text, node);
  ts.forEachChild(node, visit);
}
visit(ast);

function definition(name: string): ts.Node {
  const node = definitions.get(name);
  assert.ok(node, `Missing source definition: ${name}`);
  return node;
}
function evaluate(names: string[], context: Record<string, unknown> = {}): any[] {
  const included = new Set<string>();
  const declarations: string[] = [];
  function include(name: string): void {
    if (included.has(name)) return;
    included.add(name);
    const node = definition(name);
    function dependencies(child: ts.Node): void {
      if (ts.isIdentifier(child) && child.text !== name &&
          (/Style$/.test(child.text) ||
           child.text === 'ER4_CANDIDATE_CLASSIFICATION_LABELS' ||
           child.text === 'getEr4RecoveryRequestForHealthResult') &&
          definitions.has(child.text)) include(child.text);
      ts.forEachChild(child, dependencies);
    }
    dependencies(node);
    declarations.push(ts.isFunctionDeclaration(node)
      ? node.getText(ast)
      : `const ${name} = ${node.getText(ast)};`);
  }
  names.forEach(include);
  const js = ts.transpileModule(declarations.join('\n'), {
    fileName: 'er4-history-render-fixture.tsx',
    compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None,
      jsx: ts.JsxEmit.React, jsxFactory: 'h', jsxFragmentFactory: 'Fragment',
    },
  }).outputText;
  return new Function('h', 'Fragment', ...Object.keys(context),
    `${js}\nreturn [${names.join(',')}];`)(h, Fragment, ...Object.values(context));
}
export function flatten(view: any): View[] {
  if (!view || typeof view !== 'object' || !('children' in view)) return [];
  return [view, ...view.children.flatMap(flatten)];
}
function text(view: any): string {
  if (typeof view === 'string' || typeof view === 'number') return String(view);
  return view?.children?.map(text).join(' ') ?? '';
}

export function renderFixture(options: {
  historyCount?: number; exchange?: string; eligible?: boolean;
  activeOnly?: boolean; withReview?: boolean; noDiscovery?: boolean;
} = {}): { view: View; commonPanelStyle: object; calls: string[] } {
  const sourceKey = 'NSE_CURRENT_EQUITY_MASTER';
  const authority = {
    sourceKey, exchange: options.exchange ?? 'NSE',
    candidatePromotionEligible: options.eligible ?? true,
    currentUrl: 'https://nsearchives.nseindia.com/content/equities/ER4_MANUAL_TEST_DOES_NOT_EXIST.csv',
    currentVersionId: 15, revision: 5,
  };
  const history = Array.from({ length: options.historyCount ?? 5 }, (_, index) => ({
    entryKind: 'VERSION', versionId: 15 - index, revision: 5 - index,
    createdAt: '2026-09-17T13:17:00Z', active: index === 0 || options.activeOnly === true,
    changeKind: index === 0 ? 'MANUAL_OVERRIDE' : 'BASELINE_IMPORT',
    url: index === 0 ? authority.currentUrl : 'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv',
    parentVersionId: null, candidateContentSha256: null,
  }));
  const calls: string[] = [];
  const context: Record<string, unknown> = {
    busy: false, hasDatabase: true, identityExchange: 'NSE', identitySourceMode: 'official',
    activeDatabasePath: 'OFFLINE_FIXTURE', officialSourceAuthority: { sources: [authority] },
    officialSourceUrlStatus: '',
    // Imported components are opaque JSX children: only ER4 source-panel logic is evaluated.
    IdentitySourceHealth: 'IdentitySourceHealth', IdentitySourceHistory: 'IdentitySourceHistory',
    officialSourceHealthReport: {
      assessedAtUtc: '2026-09-17T13:17:36Z',
      results: Array.from({ length: 11 }, (_, index) => ({
        exchange: index < 7 ? 'NSE' : 'BSE',
        sourceId: index === 1 ? 'NSE_EQUITY_MASTER' : `HEALTH_FIXTURE_${index}`,
        role: 'Official source health fixture', provenanceStatus: 'PASS',
        transportStatus: index === 1 ? 'FAIL' : 'PASS', httpStatus: index === 1 ? 404 : 200,
        formatStatus: index === 1 ? 'NOT_EVALUATED' : 'PASS',
        populationStatus: index === 1 ? 'NOT_EVALUATED' : 'PASS', populationCount: 2577,
        freshnessStatus: 'NOT_APPLICABLE', driftClass: 'COMPATIBLE',
        requestUrl: authority.currentUrl, finalUrl: authority.currentUrl,
        contentBytes: 3545, contentSha256: 'A'.repeat(64),
        reason: 'Offline layout fixture. No exchange request or database is accessed.',
      })),
    },
    officialSourceHealthStatus: 'Health checked: 10 healthy; 1 controlled failure.',
    officialSourceCandidateStatus: options.noDiscovery ? '' : 'Reviewed 0 candidate(s); 50 discovery candidate(s) rejected.',
    officialSourceCandidateResult: options.noDiscovery ? null : {
      sourceKey, authority: { sources: [authority] }, candidates: [],
    },
    officialSourceHistory: history,
    officialSourceRollbackReview: options.withReview ? {
      sourceKey, currentVersionId: 15, currentRevision: 5,
      currentUrl: authority.currentUrl, targetVersionId: 14,
      targetUrl: history[1]?.url, targetValidationSha256: 'B'.repeat(64),
    } : null,
    officialSourceRollbackStatus: '', officialSourceRejectNotes: {},
    status: '', identityPreviewSummary: [], identitySearchQuery: '',
    identitySelectedSourceReady: true, identitySelectedApplyReady: false,
    nseHistoricalReviewedApplyReady: false, filteredIdentityPreviewRows: [],
    currentUniverseSyncResult: null, bseCurrentUniverseSyncResult: null,
    renderOfficialSourceUrlDialog: () => null, renderIdentityInfoDialog: () => null,
    renderNseHistoricalPreviewPanel: () => null,
    renderSearchBar: () => h('div', { style: { minHeight: 40 } }, 'Find (fixture)'),
    setIdentitySearchQuery: () => undefined,
    findOfficialReplacementCandidates: () => calls.push('discover'),
    reviewOfficialSourceRollback: () => calls.push('review-rollback'),
    retryOfficialSourcePostHealth: () => calls.push('retry-health'),
    applyOfficialSourceRollback: () => calls.push('apply-rollback'),
    promoteOfficialSourceCandidate: () => calls.push('promote'),
    recordOfficialSourceCandidateDecision: () => calls.push('decision'),
  };
  // Test the active diagnostics panel, not the retired monolithic Identity tab.
  const [render, commonPanelStyle] = evaluate(
    ['renderOfficialSourceHealthPanel', 'corporateActionPanelStyle'], context,
  );
  return { view: render(), commonPanelStyle, calls };
}

describe('ER4 FIX3 history reachability and preserved eligibility', () => {
  it('ER4_FIX3_SCROLL_OWNER: diagnostics scroll inside the bounded Identity workspace', () => {
    const identityTab = definition('renderIdentityTab').getText(ast);
    assert.match(identityTab, /<IdentityImportWorkspace\b/);
    assert.match(identityTab, /diagnostics=\{<>/);
    assert.match(identityTab, /\{renderOfficialSourceHealthPanel\(\)\}/);
    assert.match(workspaceCss, /\.identity-import-workspace\s*\{[^}]*flex:1;[^}]*min-height:0;[^}]*overflow:hidden;/);
    assert.match(workspaceCss, /\.identity-workspace-content\s*\{[^}]*flex:1;[^}]*min-height:80px;[^}]*overflow:hidden;/);
    assert.match(workspaceCss, /\.identity-diagnostics-content\s*\{\s*overflow:auto;/);
  });
  it('keeps zero-candidate history and eligible prior rollback controls rendered', () => {
    const { view, calls } = renderFixture();
    assert.match(text(view), /No replacement candidate passed discovery into review/);
    assert.match(text(view), /Source version \/ review history/);
    assert.equal(flatten(view).filter((v) => v.tag === 'button' && text(v).trim() === 'Review Rollback').length, 4);
    assert.doesNotMatch(text(view), /Approve Replacement/);
    assert.deepEqual(calls, []);
  });
  it('does not offer rollback for active versions, BSE, or ineligible config sources', () => {
    for (const options of [{ activeOnly: true }, { exchange: 'BSE' }, { eligible: false }]) {
      const { view, calls } = renderFixture(options);
      assert.doesNotMatch(text(view), /Review Rollback/);
      assert.deepEqual(calls, []);
    }
  });
  it('renders reviewed rollback as an explicit dormant action, not an automatic mutation', () => {
    const { view, calls } = renderFixture({ withReview: true });
    assert.match(text(view), /Apply Reviewed Rollback/);
    assert.match(text(view), /Target version:\s*14/);
    assert.deepEqual(calls, []);
  });
  it('keeps no-discovery and empty-history states honest', () => {
    assert.doesNotMatch(text(renderFixture({ noDiscovery: true }).view), /Source version \/ review history/);
    assert.match(text(renderFixture({ historyCount: 0 }).view), /No source history entries loaded/);
  });
  it('does not change the shared layout style used by other Corporate Actions tabs', () => {
    const { commonPanelStyle } = renderFixture();
    assert.equal((commonPanelStyle as Record<string, unknown>).overflowY, undefined);
    for (const name of ['renderImportsTab', 'renderScanTab', 'renderIssuesTab']) {
      assert.match(definition(name).getText(ast), /style=\{corporateActionPanelStyle\}/);
      assert.doesNotMatch(definition(name).getText(ast), /identityRecoveryPanelStyle/);
    }
  });
});
