import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { OfficialSourceConfigurationAuthority, OfficialSourceHistoryEntry, OfficialSourceUrls } from '@/platform';
import { IdentitySourceHistory, SourceHistoryContent } from '../identity/IdentitySourceHistory';
import { createSourceHistoryLoader, type SourceHistoryState } from '../identity/sourceHistoryLoader';

const entry: OfficialSourceHistoryEntry = {
  entryKind: 'VERSION', versionId: 5, revision: 1, active: true, url: 'https://example.invalid/namechange.csv',
  changeKind: 'BASELINE_IMPORT', parentVersionId: null, createdAt: '2026-10-29', candidateContentSha256: 'example-hash',
  reviewDecision: null, reviewResultStatus: null, resultVersionId: null, operatorNote: null, postHealthStatus: null,
};
const authority: OfficialSourceConfigurationAuthority = {
  schemaVersion: 1, configurationFingerprint: 'sample-configuration', urls: {} as OfficialSourceUrls,
  sources: [{ sourceKey: 'NSE_COMPANY_NAME_CHANGE_HISTORY', exchange: 'NSE', sourceId: 'NSE_COMPANY_NAME_CHANGE',
    sourceRole: 'Company-name changes', configField: 'nseCompanyNameChangeUrl', candidatePromotionEligible: true,
    currentVersionId: 5, revision: 1, currentUrl: entry.url }],
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('Independent saved source history', () => {
  it('offers a source and explicit load action before replacement discovery', () => {
    const load = vi.fn();
    const html = renderToStaticMarkup(<IdentitySourceHistory authority={authority} exchange="NSE" busy={false}
      hasDatabase configurationError="" onReloadSources={() => {}} loadHistory={load} />);
    expect(html).toContain('Company-name changes');
    expect(html).toContain('Load / Refresh History');
    expect(html).toContain('Replacement discovery is not required');
    expect(html).toContain('version 5');
    expect(load).not.toHaveBeenCalled();
  });
  it('shows configuration errors and a retry control instead of a blank section', () => {
    const html = renderToStaticMarkup(<IdentitySourceHistory authority={null} exchange="NSE" busy={false}
      hasDatabase configurationError="Configuration read failed" onReloadSources={() => {}} loadHistory={vi.fn()} />);
    expect(html).toContain('Configuration read failed');
    expect(html).toContain('Reload Source List');
    expect(html).toContain('disabled=""');
  });
  it('distinguishes not loaded, loading, failed and loaded-empty history', () => {
    const render = (state: SourceHistoryState) => renderToStaticMarkup(<SourceHistoryContent state={state} />);
    expect(render({ status: 'idle' })).toContain('Select a source');
    expect(render({ status: 'loading', sourceKey: 'A' })).toContain('Loading saved source history');
    expect(render({ status: 'error', sourceKey: 'A', message: 'Database unavailable' })).toContain('History could not be loaded');
    expect(render({ status: 'loaded', sourceKey: 'A', entries: [] })).toContain('No saved version or review history');
    expect(render({ status: 'error', sourceKey: 'A', message: 'Database unavailable' })).not.toContain('No saved');
  });
  it('shows saved versions, review decisions, state and provenance without Apply controls', () => {
    const html = renderToStaticMarkup(<SourceHistoryContent state={{ status: 'loaded', sourceKey: 'A', entries: [entry,
      { ...entry, entryKind: 'REVIEW', active: false, reviewDecision: 'KEEP_CURRENT', reviewResultStatus: 'RECORDED' }] }} />);
    for (const text of ['Active', 'BASELINE_IMPORT', 'KEEP_CURRENT', 'RECORDED', 'example-hash', entry.url]) expect(html).toContain(text);
    expect(html).not.toContain('<button');
    expect(html).toContain('History is not approval authority');
  });
  it('loads only the requested saved history and can retry a failure', async () => {
    const states: SourceHistoryState[] = [];
    const read = vi.fn().mockRejectedValueOnce(new Error('locked')).mockResolvedValueOnce([entry]);
    const loader = createSourceHistoryLoader(read, state => states.push(state));
    await loader.load('A');
    expect(states.at(-1)).toEqual({ status: 'error', sourceKey: 'A', message: 'locked' });
    await loader.load('A');
    expect(read.mock.calls).toEqual([['A'], ['A']]);
    expect(states.at(-1)).toEqual({ status: 'loaded', sourceKey: 'A', entries: [entry] });
  });
  it('discards an earlier source response after a new selection', async () => {
    const first = deferred<OfficialSourceHistoryEntry[]>();
    const second = deferred<OfficialSourceHistoryEntry[]>();
    const states: SourceHistoryState[] = [];
    const loader = createSourceHistoryLoader(key => key === 'A' ? first.promise : second.promise, state => states.push(state));
    const oldRead = loader.load('A'); loader.reset(); const newRead = loader.load('B');
    second.resolve([]); await newRead; first.resolve([entry]); await oldRead;
    expect(states.at(-1)).toEqual({ status: 'loaded', sourceKey: 'B', entries: [] });
    expect(states.some(state => state.status === 'loaded' && state.sourceKey === 'A')).toBe(false);
  });
  it('ignores late errors after reset or unmount', async () => {
    for (const reset of [false, true]) {
      const pending = deferred<OfficialSourceHistoryEntry[]>();
      const states: SourceHistoryState[] = [];
      const loader = createSourceHistoryLoader(() => pending.promise, state => states.push(state));
      const request = loader.load('A');
      if (reset) loader.reset(); else loader.invalidate();
      const count = states.length;
      pending.reject(new Error('late failure')); await request;
      expect(states).toHaveLength(count);
    }
  });
  it('mounts the independent reader outside the candidate-only review panel', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx'), 'utf8');
    const section = source.slice(source.indexOf('<summary>Advanced source maintenance'), source.indexOf('const renderIdentityTab'));
    expect(section.indexOf('<IdentitySourceHistory')).toBeLessThan(section.indexOf('{officialSourceCandidateResult ? ('));
    expect(section).toContain('return api.listOfficialSourceHistory({ sourceKey });');
    expect(section).toContain('key={`${activeDatabasePath}-${identityExchange}`}');
  });
});
