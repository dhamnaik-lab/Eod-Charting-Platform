import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { NseHistoricalIdentityResult } from '@/types/desktop';
import { parseIdentityDisplay, identityDisplayKey, readIdentityDisplay, writeIdentityDisplay } from '../identity/identityDisplayPreferences';
import { historicalChangeCount, historicalConfirmation } from '../identity/historicalApplyModel';
import { HistoricalApplyStatus } from '../identity/HistoricalApplyStatus';
import { IdentityImportWorkspace } from '../identity/IdentityImportWorkspace';
import { IdentityHistoricalPreview } from '../identity/IdentityHistoricalPreview';
import { filterHistoricalIdentityRows, historicalRowKey } from '../identity/historicalIdentitySearch';
import { legacySavedTime } from '../identity/HistoricalApplyHistory';

const result = { applied: true, runId: 'saved-run', completedAt: '2026-10-29T16:00:00Z',
  newSymbolChanges: 14, newNameChanges: 17, newCombinedChanges: 13,
  activeSyncActivateCount: 0, activeSyncUpdateCount: 0, activeSyncDeactivateCount: 0,
} as NseHistoricalIdentityResult;

describe('Historical Apply reporting and display preferences', () => {
  it('interprets SQLite saved times as UTC and displays IST with the UTC evidence', () => {
    expect(legacySavedTime('2026-10-29 15:57:57')).toEqual({
      label: '29/10/2026, 21:27:57 IST', utc: '2026-10-29T15:57:57.000Z (UTC)',
    });
    expect(legacySavedTime('2026-10-29T23:00:00Z').label).toBe('30/10/2026, 04:30:00 IST');
    expect(legacySavedTime('2026-10-29T21:27:57+05:30')).toEqual(legacySavedTime('2026-10-29 15:57:57'));
    expect(legacySavedTime(null).label).toBe('—');
    expect(legacySavedTime('unknown').label).toBe('unknown');
  });
  it('writes preferences to storage, restores them independently and tolerates blocked storage', () => {
    const data=new Map<string,string>();
    const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
    const key=identityDisplayKey('DB1','NSE','official');
    const value=parseIdentityDisplay('{"view":"historical","query":"AMIRCHAND","category":"equity","effectsOpen":true,"legacyOpen":true}');
    expect(writeIdentityDisplay(key,value,storage)).toBe(true);
    expect(readIdentityDisplay(key,storage)).toEqual(value);
    expect(readIdentityDisplay(identityDisplayKey('DB2','NSE','official'),storage).query).toBe('');
    expect(writeIdentityDisplay(key,value,{setItem:()=>{throw new Error('blocked');}})).toBe(false);
    expect(readIdentityDisplay(key,{getItem:()=>{throw new Error('blocked');}}).query).toBe('');
  });
  it('restores only validated display settings and never restores Apply authority', () => {
    const parsed = parseIdentityDisplay(JSON.stringify({ view:'historical',query:'AMIRCHAND',scope:'symbols',changeType:'SYMBOL_CHANGE',category:'equity',outcome:'all',effectsOpen:true,
      planSha256:'old-authority',canApply:true,applied:true,busy:true }));
    expect(parseIdentityDisplay(JSON.stringify(parsed))).toEqual(parsed);
    expect(parsed).toMatchObject({view:'historical',query:'AMIRCHAND',scope:'symbols',category:'equity',outcome:'all',effectsOpen:true});
    expect(parsed).not.toHaveProperty('planSha256'); expect(parsed).not.toHaveProperty('canApply');
    expect(parsed).not.toHaveProperty('busy'); expect(parsed).not.toHaveProperty('applied');
    for (const raw of ['null','[]','bad JSON','{"category":"made-up","scope":12,"view":"missing"}']) {
      expect(parseIdentityDisplay(raw)).toMatchObject({view:'current',scope:'all',category:'all',outcome:'actionable'});
    }
    expect(identityDisplayKey('DB1','NSE','official')).not.toBe(identityDisplayKey('DB2','NSE','official'));
    expect(identityDisplayKey('DB1','NSE','official')).not.toBe(identityDisplayKey('DB1','BSE','official'));
    expect(identityDisplayKey(null,'NSE','official')).toBeNull();
  });
  it('counts the full plan and names the destination in confirmation', () => {
    expect(historicalChangeCount(result)).toBe(44); expect(historicalChangeCount(null)).toBe(0);
    expect(historicalConfirmation(result,'Sample database')).toContain('14 symbol changes, 17 name changes, 13 combined changes');
    expect(historicalConfirmation(result,'Sample database')).toContain('Database: Sample database');
    expect(historicalConfirmation(result,'Sample database')).toContain('Search/category filters do not limit Apply');
  });
  it('keeps progress below complete until commit and separates refresh warnings', () => {
    const working = renderToStaticMarkup(<HistoricalApplyStatus progress={{stage:'committing',processed:3402,total:3402,percent:99}} result={null} error={null} refreshWarning={null} />);
    expect(working).toContain('99%'); expect(working).not.toContain('Completed'); expect(working).not.toContain('is-complete');
    const committed = renderToStaticMarkup(<HistoricalApplyStatus progress={null} result={result} error={null} refreshWarning="Reload chart" />);
    expect(committed).toContain('Completed'); expect(committed).toContain('100%'); expect(committed).toContain('44 history changes saved');
    expect(committed).toContain('View refresh needs retry'); expect(committed).not.toContain('Apply failed');
    const failed = renderToStaticMarkup(<HistoricalApplyStatus progress={{stage:'applying',processed:2,total:10,percent:19}} result={null} error="Rolled back" refreshWarning={null} />);
    expect(failed).toContain('is-error'); expect(failed).not.toContain('100%');
    const lostReply = renderToStaticMarkup(<HistoricalApplyStatus progress={{stage:'committed',processed:10,total:10,percent:100}} result={null} error="Reply lost" refreshWarning={null} />);
    expect(lostReply).toContain('is-complete'); expect(lostReply).toContain('report retrieval needs retry');
    expect(lostReply).not.toContain('Apply failed');
  });
  it('restores Recent Applied without exposing an Apply footer', () => {
    const html=renderToStaticMarkup(<IdentityImportWorkspace databasePath="DB" busy={false} header={null} sourceControls={null} summary={null} status=""
      current={null} currentToolbar={null} currentFooter="Current Apply" historical="Historical" historicalFooter="Historical Apply"
      recent="Saved report" diagnostics={null} preferences={parseIdentityDisplay('{"view":"recent"}')} onPreferencesChange={()=>{}} />);
    expect(html).toContain('Recent Applied'); expect(html).toContain('Saved report');
    expect(html).not.toContain('Historical Apply'); expect(html).not.toContain('Current Apply');
  });
  it('uses supplied category evidence, intersects searches and keeps older unclassified rows Unknown', () => {
    const row={disposition:'NEW' as const,changeType:'SYMBOL_CHANGE' as const,effectiveDate:'2026-07-20',oldSymbol:'OLD',newSymbol:'NEW',currentSymbol:'NEW',oldName:null,newName:null,sourceFile:'official.csv',detail:'Review'};
    const evidence={ [historicalRowKey(row)]: {category:'etf' as const,evidence:'Explicit saved source category'} };
    expect(filterHistoricalIdentityRows([row],'old','symbols','all','etf',evidence)).toEqual([row]);
    expect(filterHistoricalIdentityRows([row],'old','symbols','all','equity',evidence)).toEqual([]);
    expect(filterHistoricalIdentityRows([row],'old','symbols','all','unknown',null)).toEqual([row]);
    const html=renderToStaticMarkup(<IdentityHistoricalPreview rows={[row]} total={1} summary={null} filters={null} busy={false} currentEffects={[]} applied categoryEvidence={evidence} />);
    expect(html).toContain('APPLIED'); expect(html).toContain('Saved report'); expect(html).toContain('Explicit saved source category');
    expect(html).toContain('aria-label="Historical instrument category"');
  });
});
