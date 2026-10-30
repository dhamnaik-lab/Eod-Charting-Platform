import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BseNameTable, bseNameCategory, filterBseNameRows, useBseNameHistory, BseNameHistoryReports } from '../identity/BseNameHistory';
import { DEFAULT_IDENTITY_DISPLAY } from '../identity/identityDisplayPreferences';
import { IdentityImportWorkspace } from '../identity/IdentityImportWorkspace';
import type { BseNameHistoryResult, BseNameHistoryRow } from '@/types/desktop';
import type { DesktopApi } from '@/platform';

const rows: BseNameHistoryRow[] = [
  {securityCode:'500002',currentId:'EXACT',oldName:'Old Limited',newName:'New Limited',sourceDate:'2013-07-03',outcome:'NEW',reason:'Exact code'},
  {securityCode:'500003',currentId:null,oldName:'Old Mutual Fund',newName:'New Mutual Fund',sourceDate:'2014-08-04',outcome:'HELD',reason:'Ambiguous code'},
  {securityCode:'500004',currentId:'ETF_ID',oldName:'Old Mutual Fund ETF',newName:'New ETF',sourceDate:'2015-09-05',outcome:'DUPLICATE',reason:'Already saved'},
];
const result: BseNameHistoryResult = {filePath:'Comp_Name.csv',sourceMode:'manual',sourceSha256:'source-hash',planSha256:'plan-hash',rows,newNameChanges:1,duplicateRows:1,heldRows:1,skippedRows:0,canApply:true,applied:false,runId:null,completedAt:null,warning:null};
describe('BSE company-name historical workspace', () => {
  it('searches exact identifiers, names and dates without treating company names as symbols', () => {
    expect(filterBseNameRows(rows,'500002','all','symbols')).toEqual([rows[0]]);
    expect(filterBseNameRows(rows,'Old Limited','all','symbols')).toEqual([]);
    expect(filterBseNameRows(rows,'old new','all','names')).toHaveLength(3);
    expect(filterBseNameRows(rows,'03/07/2013','all','dates')).toEqual([rows[0]]);
    expect(filterBseNameRows(rows,'','skipped')).toEqual([rows[1]]);
    expect(filterBseNameRows(rows,'','duplicates')).toEqual([rows[2]]);
    expect(filterBseNameRows(rows,'','actionable')).toEqual([rows[0]]);
    expect(result.rows).toHaveLength(3);
  });
  it('keeps uncertain categories Unknown and distinguishes ETF wording from mutual funds', () => {
    expect(bseNameCategory(rows[0])).toBe('unknown');
    expect(bseNameCategory(rows[1])).toBe('mutualFund');
    expect(bseNameCategory(rows[2])).toBe('etf');
    expect(filterBseNameRows(rows,'','all','all','equity')).toEqual([]);
    expect(filterBseNameRows(rows,'','all','all','mutualFund')).toEqual([rows[1]]);
    expect(bseNameCategory({...rows[1],newName:'New ETF'})).toBe('unknown');
  });
  it('presents only saved rows as APPLIED and preserves the code and BSE date labels', () => {
    const preview=renderToStaticMarkup(<BseNameTable result={result}/>);
    expect(preview).toContain('Security code');expect(preview).toContain('BSE change date');expect(preview).not.toContain('>APPLIED<');
    const applied=renderToStaticMarkup(<BseNameTable result={{...result,applied:true,canApply:false}}/>);
    expect(applied).toContain('>APPLIED<');expect(applied).toContain('>HELD<');expect(applied).toContain('>DUPLICATE<');
    expect(applied).not.toContain('New symbol');
  });
  it('shows BSE controls and a disabled apply footer before preview, with a separate historical CSV input', () => {
    function Workspace({mode}: {mode:'official'|'manual'}) {
      const names=useBseNameHistory({api:null,databasePath:'test-db',exchange:'BSE',mode,busy:false,setBusy:()=>{},preferences:{...DEFAULT_IDENTITY_DISPLAY,view:'historical'},updatePreferences:()=>{}});
      return <IdentityImportWorkspace databasePath="test-db" busy={false} header="BSE" sourceControls={<span>Current master input</span>}
        historicalSourceControls={names.controls} summary="BSE sources" status="" current="Current" currentToolbar={null} currentFooter={null}
        historical={names.panel} historicalToolbar={names.toolbar} historicalFooter={names.footer} diagnostics="Diagnostics"
        preferences={{...DEFAULT_IDENTITY_DISPLAY,view:'historical'}}/>;
    }
    const official=renderToStaticMarkup(<Workspace mode="official"/>);
    expect(official).toContain('Refresh BSE Sources');expect(official).toContain('Preview Historical Identity');
    expect(official).toContain('disabled="">Apply Reviewed Historical Identity');expect(official).toContain('Security ID changes remain held');
    expect(official).not.toContain('Refresh NSE Sources');expect(official).not.toContain('Current master input');
    const manual=renderToStaticMarkup(<Workspace mode="manual"/>);
    expect(manual).toContain('BSE company-name CSV');expect(manual).toContain('Browse File');expect(manual).not.toContain('Current master input');
  });
  it('separates name-only report receipts from current-universe operations and provides no Apply control', () => {
    const html=renderToStaticMarkup(<BseNameHistoryReports api={{} as DesktopApi} latest={{...result,applied:true,runId:'names-1',completedAt:'2026-10-29T15:57:57Z'}}/>);
    expect(html).toContain('BSE company-name Apply reports');expect(html).toContain('21:27:57');expect(html).toContain('source-hash');
    expect(html).not.toContain('Apply Reviewed');expect(html).toContain('names-1');
  });
});
