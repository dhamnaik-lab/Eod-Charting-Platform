import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BseNameHistoryResult, NseHistoricalIdentityPreviewRow } from '@/types/desktop';
import type { DesktopApi } from '@/platform';
import { copyTextToClipboard } from '@/platform/clipboard';
import { IdentityEvidenceValue, IdentityReportFilters } from '../identity/IdentityReceiptControls';
import { friendlyIdentitySourcePath, identityReadinessNotice, identityReportCounts, matchesIdentityReportOutcome } from '../identity/identityReceiptPresentation';
import { BseNameHistoryReports, BseNameTable, bseNameHistoryReason, filterBseNameRows } from '../identity/BseNameHistory';
import { IdentityHistoricalPreview } from '../identity/IdentityHistoricalPreview';
import { IdentityImportWorkspace } from '../identity/IdentityImportWorkspace';
import { identityDisplayKey, parseIdentityDisplay, readIdentityDisplay, writeIdentityDisplay } from '../identity/identityDisplayPreferences';

const reason='Will save name-only history by exact BSE security code. Trading ID and lifecycle remain unchanged.';
const rows=[{securityCode:'500002',currentId:'EXACT',oldName:'Old Limited',newName:'New Limited',sourceDate:'2013-07-03',outcome:'NEW' as const,reason},
  {securityCode:'500003',currentId:null,oldName:'Skipped Old',newName:'Skipped New',sourceDate:'2014-01-02',outcome:'SKIPPED' as const,reason:'No exact code match.'},
  {securityCode:'500004',currentId:'DUP',oldName:'Dup Old',newName:'Dup New',sourceDate:'2015-01-02',outcome:'DUPLICATE' as const,reason:'Already exists.'}];
const result:BseNameHistoryResult={filePath:String.raw`\\?\E:\Reviewed DB\names.json`,sourceMode:'official',sourceSha256:'source-hash',planSha256:'plan-hash',rows,newNameChanges:1,duplicateRows:1,skippedRows:1,heldRows:0,canApply:false,applied:true,runId:'saved-run',completedAt:'2026-10-30T05:45:56Z',warning:null};

describe('Saved Identity report polish',()=>{
  it('uses past tense only for applied rows and retains the original receipt byte-for-byte',()=>{
    const before=JSON.stringify(result);Object.freeze(result.rows[0]);Object.freeze(result.rows);Object.freeze(result);
    expect(bseNameHistoryReason(rows[0],true)).toMatch(/^Saved company-name history/);
    expect(bseNameHistoryReason(rows[0],false)).toBe(reason);expect(bseNameHistoryReason(rows[1],true)).toBe(rows[1].reason);
    const html=renderToStaticMarkup(<BseNameTable result={result} reportOutcome="applied"/>);
    expect(html).toContain('>APPLIED<');expect(html).toContain('Original review reason: Will save');
    expect(html).toContain('>Saved company-name history');expect(html).not.toContain('>Will save');
    expect(JSON.stringify(result)).toBe(before);
  });
  it('keeps preview wording, skipped and duplicate reasons unchanged',()=>{
    const html=renderToStaticMarkup(<BseNameTable result={{...result,applied:false}}/>);
    expect(html).toContain('>Will save');expect(html).not.toContain('>APPLIED<');
    expect(html).toContain('No exact code match.');expect(html).toContain('Already exists.');
  });
  it('searches displayed saved wording as well as original review evidence',()=>{
    expect(filterBseNameRows(rows,'saved','all','all','all',true)).toEqual([rows[0]]);
    expect(filterBseNameRows(rows,'will save','all','all','all',true)).toEqual([rows[0]]);
    expect(filterBseNameRows(rows,'applied','all','all','all',true)).toEqual([rows[0]]);
  });
  it('cleans Windows extended drive and UNC paths only for display',()=>{
    expect(friendlyIdentitySourcePath(String.raw`\\?\E:\Reviewed DB\names.json`)).toBe(String.raw`E:\Reviewed DB\names.json`);
    expect(friendlyIdentitySourcePath(String.raw`\\?\UNC\server\share\names.json`)).toBe(String.raw`\\server\share\names.json`);
    for(const path of [String.raw`E:\normal\file.json`,String.raw`\\server\share\file.json`,'/tmp/source.json','https://example.test/file'])expect(friendlyIdentitySourcePath(path)).toBe(path);
  });
  it('copies the complete stored value and reports unavailable/rejected clipboard operations as failures',async()=>{
    const writeText=vi.fn().mockResolvedValue(undefined);await copyTextToClipboard(result.filePath,{writeText});
    expect(writeText).toHaveBeenCalledExactlyOnceWith(result.filePath);
    await expect(copyTextToClipboard('hash',null)).rejects.toThrow('unavailable');
    await expect(copyTextToClipboard('hash',{writeText:vi.fn().mockRejectedValue(Error('denied'))})).rejects.toThrow('denied');
    const html=renderToStaticMarkup(<IdentityEvidenceValue label="source path" value={result.filePath} path/>);
    expect(html).toContain(String.raw`>E:\Reviewed DB\names.json</span>`);expect(html).toContain('aria-label="Copy source path"');
    expect(html).toContain('Copy the full stored value');expect(result.filePath).toBe(String.raw`\\?\E:\Reviewed DB\names.json`);
  });
  it('counts the complete saved report independently from search and exposes held/error outcomes without losing evidence',()=>{
    const counts=identityReportCounts(['NEW','DUPLICATE','SKIPPED','HELD','ERROR']);
    expect(counts).toEqual({applied:1,all:5,skipped:1,duplicates:1,held:1,errors:1});
    expect(matchesIdentityReportOutcome('NEW','applied')).toBe(true);expect(matchesIdentityReportOutcome('HELD','skipped')).toBe(false);
    const html=renderToStaticMarkup(<IdentityReportFilters value="applied" counts={counts} onChange={()=>{}}/>);
    for(const label of ['Applied 1','All 5','Skipped 1','Duplicates 1','Held 1','Errors 1'])expect(html).toContain(label);
    expect(renderToStaticMarkup(<BseNameTable result={result} query="missing" reportOutcome="applied"/>)).toContain('0 of 3');
    expect(identityReportCounts(rows.map(r=>r.outcome)).all).toBe(3);
  });
  it('defaults saved reports to Applied, restores only validated display preferences and keeps report searches separated by context',()=>{
    const data=new Map<string,string>(),storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
    const key=identityDisplayKey('DB','BSE','official')+':name-reports';
    expect(parseIdentityDisplay(null).reportOutcome).toBe('applied');
    const prefs=parseIdentityDisplay(JSON.stringify({reportOutcome:'duplicates',legacyQuery:'Old',planSha256:'forbidden',canApply:true}));
    expect(writeIdentityDisplay(key,prefs,storage)).toBe(true);expect(readIdentityDisplay(key,storage)).toMatchObject({reportOutcome:'duplicates',legacyQuery:'Old'});
    expect(readIdentityDisplay(identityDisplayKey('OTHER','BSE','official'),storage).reportOutcome).toBe('applied');
    expect(readIdentityDisplay(key,storage)).not.toHaveProperty('canApply');expect(parseIdentityDisplay('{"reportOutcome":"untrusted"}').reportOutcome).toBe('applied');
    const html=renderToStaticMarkup(<BseNameHistoryReports api={{} as DesktopApi} latest={result}/>);
    expect(html).toContain('1 of 3 name records');expect(html).toContain('Applied 1');expect(html).not.toContain('>SKIPPED<');
  });
  it('retains NSE original review detail in the tooltip and uses saved wording in the cell',()=>{
    const row:NseHistoricalIdentityPreviewRow={disposition:'NEW',changeType:'NAME_CHANGE',oldSymbol:'OLD',newSymbol:'OLD',currentSymbol:'OLD',oldName:'Old',newName:'New',effectiveDate:'2020-01-01',sourceFile:'source.csv',detail:'Will insert this historical change.'};
    const html=renderToStaticMarkup(<IdentityHistoricalPreview rows={[row]} total={1} summary={null} filters={null} currentEffects={[]} busy={false} applied/>);
    expect(html).toContain('>Saved identity history in this completed run.</td>');expect(html).toContain('Original review: Will insert');
    expect(row.detail).toBe('Will insert this historical change.');
  });
  it('clarifies only the known Corporate Actions readiness reminder and leaves failures visible',()=>{
    const stale='Database changed. Previous report is retained; run Load & Validate to refresh readiness.';
    const notice=identityReadinessNotice(stale);expect(notice?.summary).toBe('Corporate Actions validation needs refresh');expect(notice?.detail).toContain('Saved Identity reports remain available');
    expect(identityReadinessNotice('BSE source download failed: HTTP 403')).toBeNull();
    const base={databasePath:'DB',busy:false,header:null,sourceControls:null,summary:null,current:null,currentToolbar:null,currentFooter:null,recent:'Saved report',diagnostics:null,preferences:parseIdentityDisplay('{"view":"recent"}')};
    const html=renderToStaticMarkup(<IdentityImportWorkspace {...base} status={stale}/>);expect(html).toContain(notice!.summary);expect(html).toContain('before approving Corporate Actions');
    const failure=renderToStaticMarkup(<IdentityImportWorkspace {...base} status="BSE source download failed: HTTP 403"/>);expect(failure).toContain('BSE source download failed: HTTP 403');
  });
});
