import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CorporateActionImportRow } from '@/platform';
import { CLASSIC_ACTION_TYPES, CLASSIC_DEFAULT_SORT, classicIdentityLabel, classicVisibleEvents, classicVisibleReadyIds, groupClassicActionRows, type ClassicActionRow, type ClassicStatusFilter, isClassicIssue } from './corporateActionClassicModel';
import './corporateActionClassicWorkspace.css';

export interface ClassicMenuItem { label: string; onClick: () => void; disabled?: boolean }
export function CorporateActionClassicMenu({ label, items, primary = false }: {
  label: string; items: ClassicMenuItem[]; primary?: boolean;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) ref.current?.removeAttribute('open'); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  return <details ref={ref} className={`ca-classic-menu ${primary ? 'ca-classic-menu-primary' : ''}`}
    onKeyDown={event => { if (event.key === 'Escape') { ref.current?.removeAttribute('open'); ref.current?.querySelector('summary')?.focus(); } }}
    onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) ref.current?.removeAttribute('open'); }}>
    <summary>{label}</summary>
    <div className="ca-classic-menu-items" aria-label={label}>{items.map(item => <button key={item.label} type="button"
      disabled={item.disabled} onClick={() => { ref.current?.removeAttribute('open'); item.onClick(); }}>{item.label}</button>)}</div>
  </details>;
}

export function CorporateActionClassicDialog({ title, onClose, children, className = '' }: {
  title: string; onClose: () => void; children: React.ReactNode; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea,[tabindex="0"],summary') ?? [])
        .filter(element => element.getClientRects().length > 0);
      const first = controls[0]; const last = controls.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !ref.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown, true);
    return () => { document.removeEventListener('keydown', keydown, true); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="ca-classic-dialog-backdrop"><div className={`ca-classic-dialog${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true"
    aria-labelledby={titleId} tabIndex={-1} ref={ref}>
    <header><strong id={titleId}>{title}</strong><button type="button" onClick={onClose} aria-label={`Close ${title}`}>Close</button></header>
    <div className="ca-classic-dialog-body">{children}</div>
  </div></div>;
}

export interface CorporateActionClassicWorkspaceProps {
  rows: readonly ClassicActionRow[];
  loadedCount: number;
  selectedIds: ReadonlySet<number>;
  busy: boolean;
  hasDatabase: boolean;
  approved: boolean;
  exchange: string;
  fromDate: string;
  toDate: string;
  types: readonly string[];
  search: string;
  filterResetKey?: number;
  message: string;
  progress?: { startedAt: number; endedAt: number | null; completed: number; total: number | null };
  canCancel: boolean;
  onCancel: () => void;
  onFetch: () => void;
  onValidate: () => void;
  readOnly?: boolean;
  onClearFilters: () => void;
  onExchangeChange: (value: string) => void;
  onDateChange: (from: string, to: string) => void;
  onTypesChange: (value: string[]) => void;
  onSearchChange: (value: string) => void;
  onCurrentSymbol: () => void;
  onToggleMany: (ids: number[], checked: boolean) => void;
  onFilterChange: () => void;
  onApprove: (mode: 'selected' | 'all-ready', visibleReadyIds: number[]) => void;
  renderDetails: (row: CorporateActionImportRow) => React.ReactNode;
}

const columns = [ ['exchange', 'Exchange'], ['symbol', 'Symbol'], ['company', 'Company'], ['action', 'Action'], ['date', 'Ex-date'], ['terms', 'Terms'], ['status', 'Status'] ] as const;
const rowHeight = 32;
function ClassicTypeFilter({types,onChange}: {types: readonly string[];onChange:(types:string[])=>void}) {
  const ref=useRef<HTMLDetailsElement>(null);
  const popupRef=useRef<HTMLDivElement>(null);
  const [position,setPosition]=useState<{left:number;top:number}|null>(null);
  useEffect(()=>{
    const close=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node)&&!popupRef.current?.contains(event.target as Node))ref.current?.removeAttribute('open');};
    const resize=()=>ref.current?.removeAttribute('open');
    document.addEventListener('pointerdown',close);
    window.addEventListener('resize',resize);
    return()=>{document.removeEventListener('pointerdown',close);window.removeEventListener('resize',resize);};
  },[]);
  const all=CLASSIC_ACTION_TYPES.every(type=>types.includes(type));
  const label=all?'All':types.length===0?'None':types.length===1?types[0].charAt(0)+types[0].slice(1).toLowerCase()
    :types.length===2&&types.includes('SPLIT')&&types.includes('BONUS')?'Split + Bonus':`${types.length} selected`;
  return <details ref={ref} className="ca-classic-menu ca-classic-types"
    onToggle={event=>{const bounds=event.currentTarget.getBoundingClientRect();setPosition(event.currentTarget.open?{left:Math.max(8,Math.min(bounds.left,window.innerWidth-286)),top:bounds.bottom}:null);}}
    onKeyDown={event=>{
      if(event.key==='Escape'){ref.current?.removeAttribute('open');ref.current?.querySelector('summary')?.focus();}
      if(event.key==='Tab'&&!event.shiftKey&&event.target===ref.current?.querySelector('summary')&&position){event.preventDefault();popupRef.current?.querySelector('button')?.focus();}
    }}
    onBlur={event=>{if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget as Node)&&!popupRef.current?.contains(event.relatedTarget as Node))ref.current?.removeAttribute('open');}}>
    <summary aria-label={`Filter action types: ${label}`}>Types: {label}</summary>
    {position?createPortal(<div ref={popupRef} className="ca-classic-menu ca-classic-menu-items ca-classic-types-popup" role="group" aria-label="Action type filters"
      style={{position:'fixed',...position,zIndex:100000,maxHeight:Math.max(100,window.innerHeight-position.top-12),overflowY:'auto'}}
      onKeyDown={event=>{
        const controls=popupRef.current?.querySelectorAll<HTMLElement>('button,input');
        if(event.key==='Tab'&&event.shiftKey&&event.target===controls?.[0]){event.preventDefault();ref.current?.querySelector('summary')?.focus();}
        else if(event.key==='Tab'&&!event.shiftKey&&event.target===controls?.[controls.length-1]){event.preventDefault();ref.current?.removeAttribute('open');ref.current?.closest('.ca-classic-toolbar')?.querySelector<HTMLSelectElement>('[aria-label="Action status"]')?.focus();}
      }}>
      <div className="ca-classic-type-presets" role="group" aria-label="Quick type filters">
        <button type="button" onClick={()=>onChange([...CLASSIC_ACTION_TYPES])}>All</button>
        <button type="button" onClick={()=>onChange(['SPLIT','BONUS'])}>Split + Bonus</button>
        <button type="button" onClick={()=>onChange(['DIVIDEND'])}>Dividends</button>
        <button type="button" onClick={()=>onChange([])}>None</button>
      </div>
      {CLASSIC_ACTION_TYPES.map(type=><label key={type}><input type="checkbox" checked={types.includes(type)}
        onChange={event=>onChange(event.target.checked?[...types,type]:types.filter(item=>item!==type))}/>
        {type.charAt(0)+type.slice(1).toLowerCase()}</label>)}
    </div>,document.body):null}
  </details>;
}
function ClassicProgress({ progress }: { progress: NonNullable<CorporateActionClassicWorkspaceProps['progress']> }) {
  const [now,setNow] = useState(Date.now);
  useEffect(()=>{if(progress.endedAt!=null)return;const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[progress.endedAt]);
  const seconds=Math.max(0,Math.floor(((progress.endedAt??now)-progress.startedAt)/1000));
  return <span>{Math.floor(seconds/60)}m {seconds%60}s · {progress.completed}/{progress.total??'…'}</span>;
}
export function CorporateActionClassicWorkspace(p: CorporateActionClassicWorkspaceProps) {
  const reviewOnly = p.readOnly || p.approved;
  const [statusFilter, setStatusFilter] = useState<ClassicStatusFilter>(reviewOnly ? 'all' : 'ready');
  const [tableExchange, setTableExchange] = useState<'all' | 'NSE' | 'BSE'>('all');
  const [sort, setSort] = useState<{column: typeof columns[number][0]; descending: boolean}>(CLASSIC_DEFAULT_SORT);
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState({width:1200,height:600});
  const [columnWidths, setColumnWidths] = useState<Record<string,number>>({});
  const drag = useRef<{column:string;x:number;width:number} | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const events = useMemo(() => groupClassicActionRows(p.rows), [p.rows]);
  const visible = useMemo(() => classicVisibleEvents(events,statusFilter,sort,p.search,tableExchange),[events,statusFilter,sort,p.search,tableExchange]);
  const readyIds = useMemo(() => classicVisibleReadyIds(visible),[visible]);
  const laterCount = useMemo(() => events.filter(event => event.category === 'later').length, [events]);
  const issueCount = useMemo(() => events.filter(isClassicIssue).length, [events]);
  const selected = readyIds.filter(id => p.selectedIds.has(id));
  const focused = visible.find(event => event.key === focusedId) ?? visible[0];
  const start = Math.max(0, Math.min(visible.length - 1, Math.floor(scrollTop / rowHeight) - 8));
  const end = Math.min(visible.length, start + Math.ceil(viewport.height / rowHeight) + 16);
  const allSelected = readyIds.length > 0 && selected.length === readyIds.length;
  useEffect(() => {
    const element = scrollRef.current; if (!element) return;
    const observer = new ResizeObserver(() => setViewport({width:rootRef.current?.clientWidth ?? 1200,height:element.clientHeight}));
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop=0; setScrollTop(0); },[statusFilter,tableExchange,sort,p.search,p.types,p.approved]);
  useEffect(()=>{setStatusFilter(reviewOnly ? 'all' : 'ready');},[reviewOnly,p.filterResetKey]);
  useEffect(()=>{setSort(CLASSIC_DEFAULT_SORT);},[p.filterResetKey]);
  useEffect(()=>{setTableExchange('all');},[p.filterResetKey]);
  const dateFields = <><span title="These dates limit official source collection. Load & Validate checks all outstanding pending dates.">Fetch dates only:</span>
    <input aria-label="Official fetch from date" type="date" value={p.fromDate} max={p.toDate || undefined}
      disabled={p.busy} onChange={event => p.onDateChange(event.target.value,p.toDate)} />
    <span>to</span><input aria-label="Official fetch to date" type="date" value={p.toDate} min={p.fromDate || undefined}
      disabled={p.busy} onChange={event => p.onDateChange(p.fromDate,event.target.value)} /></>;
  const details = focused ? <>
    <h3>{focused.rows[0].record.exchange}:{classicIdentityLabel(focused.rows[0].record)}</h3>
    <p>{focused.rows[0].record.companyName}</p>
    {focused.rows.map(item => <section key={item.record.id}><h4>{item.record.actionType} · {item.record.exDate}</h4>
      <p>{item.terms}</p><strong>{item.status}</strong>{p.renderDetails(item.record)}</section>)}
  </> : <p>Select an action to see its evidence.</p>;
  return <div className="ca-classic-workspace" ref={rootRef} onKeyDown={event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); searchRef.current?.focus(); }
  }}>
    {!reviewOnly && <div className="ca-classic-toolbar" aria-label="Corporate Action commands">
      <button type="button" disabled={p.busy || !p.hasDatabase || !p.fromDate || !p.toDate || p.fromDate > p.toDate} onClick={p.onFetch}>Fetch Data</button>
      <button type="button" title="Check all outstanding pending dates. Table exchange, Type, Status and Find only filter the table." disabled={p.busy || !p.hasDatabase} onClick={p.onValidate}>Load &amp; Validate</button>
      <CorporateActionClassicMenu label="Approve…" primary items={[
        {label:`Approve selected (${selected.length})`,disabled:p.busy || !p.hasDatabase || p.approved || selected.length === 0,onClick:()=>p.onApprove('selected',readyIds)},
        {label:`Approve all filtered Ready (${readyIds.length})`,disabled:p.busy || !p.hasDatabase || p.approved || readyIds.length === 0,onClick:()=>p.onApprove('all-ready',readyIds)},
      ]} />
      <label className="ca-classic-exchange">Exchange:<select aria-label="Official fetch exchange scope" value={p.exchange} disabled={p.busy} onChange={event=>p.onExchangeChange(event.target.value)}>
        <option value="BOTH">NSE + BSE</option><option value="NSE">NSE</option><option value="BSE">BSE</option>
      </select></label>
      <div className="ca-classic-inline-dates">{dateFields}</div>
      <details className="ca-classic-menu ca-classic-fetch-options"><summary>Fetch dates only</summary><div className="ca-classic-menu-items ca-classic-date-popup">{dateFields}</div></details>
    </div>}
    <div className="ca-classic-toolbar ca-classic-filters" aria-label="Corporate Action filters">
      <ClassicTypeFilter types={p.types} onChange={types=>{p.onFilterChange();p.onTypesChange(types);}} />
      <label>Table exchange:<select aria-label="Table exchange filter" value={tableExchange}
        title="Filter loaded events only; does not change source scope or run validation."
        onChange={event=>{p.onFilterChange();setTableExchange(event.target.value as 'all'|'NSE'|'BSE');}}>
        <option value="all">All exchanges</option><option value="NSE">NSE</option><option value="BSE">BSE</option>
      </select></label>
      <label>Status:<select aria-label="Action status" value={statusFilter} onChange={event=>{p.onFilterChange();setStatusFilter(event.target.value as ClassicStatusFilter);}}>
        <option value="ready">Ready</option><option value="issues">Issues ({issueCount})</option><option value="later">Deferred types ({laterCount})</option><option value="all">All (diagnostics)</option><option value="waiting">Waiting for evidence/data</option><option value="review">Needs review</option>
        <option value="checking">Not validated / checking</option><option value="informational">Informational</option><option value="approved">Approved</option><option value="processed">Already Processed</option>
      </select></label>
      <div className="ca-classic-search-box">
        <input ref={searchRef} aria-label="Find corporate actions" className="ca-classic-search" placeholder="Find symbol, company, ISIN or BSE code"
          title="Search loaded events. Exact symbols first, then symbol prefixes and other identity matches. Esc clears."
          autoComplete="off" spellCheck={false} value={p.search} onChange={event=>p.onSearchChange(event.target.value)}
          onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();p.onSearchChange('');}}} />
        {p.search.length>0?<button type="button" className="ca-classic-search-clear" aria-label="Clear corporate action search" title="Clear search (Esc)"
          onClick={()=>{p.onSearchChange('');searchRef.current?.focus();}}>×</button>:null}
      </div>
      <button type="button" disabled={!p.hasDatabase} onClick={p.onCurrentSymbol}>Current symbol</button>
      <button type="button" aria-pressed={detailsOpen} onClick={()=>setDetailsOpen(!detailsOpen)}>Details</button>
      <button type="button" onClick={p.onClearFilters}>Clear filters</button>
    </div>
    <div className="ca-classic-content">
      <div className="ca-classic-grid-scroll" ref={scrollRef} onScroll={event=>setScrollTop(event.currentTarget.scrollTop)}>
        <table className="ca-classic-table" aria-label="Corporate Actions" aria-rowcount={visible.length+1} tabIndex={0}
          onKeyDown={event=>{
            if (event.target!==event.currentTarget || !visible.length) return;
            const current=Math.max(0,visible.findIndex(item=>item.key===focused?.key));
            if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
              event.preventDefault(); const index=event.key==='Home'?0:event.key==='End'?visible.length-1:Math.max(0,Math.min(visible.length-1,current+(event.key==='ArrowDown'?1:-1)));
              setFocusedId(visible[index].key);
              const element=scrollRef.current;
              if (element && index*rowHeight<element.scrollTop) element.scrollTop=index*rowHeight;
              else if (element && (index+2)*rowHeight>element.scrollTop+element.clientHeight) element.scrollTop=(index+2)*rowHeight-element.clientHeight;
            } else if (event.key==='Enter') { event.preventDefault();setDetailsOpen(true); }
            else if (event.key===' ' && focused?.ready && !p.busy && !reviewOnly) { event.preventDefault();p.onToggleMany(focused.rows.map(row=>row.record.id),!focused.rows.every(item=>p.selectedIds.has(item.record.id))); }
          }}>
          <colgroup><col style={{width:38}} />{columns.map(([key])=><col key={key} style={{width:columnWidths[key] ?? ({exchange:95,symbol:145,company:240,action:130,date:125,terms:220,status:240})[key]}} />)}</colgroup>
          <thead><tr><th scope="col"><input type="checkbox" aria-label="Select all visible Ready actions" checked={allSelected}
            ref={element=>{if(element)element.indeterminate=selected.length>0&&!allSelected;}} disabled={p.busy || reviewOnly || readyIds.length===0}
            onChange={event=>p.onToggleMany(readyIds,event.target.checked)} /></th>
            {columns.map(([key,label])=><th key={key} scope="col" aria-sort={sort.column===key?(sort.descending?'descending':'ascending'):'none'}>
              <button type="button" onClick={()=>setSort({column:key,descending:sort.column===key&&!sort.descending})}>{label}</button>
              <span role="separator" aria-orientation="vertical" aria-label={`Resize ${label} column`} tabIndex={0} className="ca-classic-column-resize"
                onKeyDown={event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();setColumnWidths(old=>({...old,[key]:Math.max(90,(old[key]??event.currentTarget.parentElement!.offsetWidth)+(event.key==='ArrowRight'?10:-10))}));}}}
                onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);drag.current={column:key,x:event.clientX,width:event.currentTarget.parentElement!.offsetWidth};}}
                onPointerMove={event=>{if(drag.current?.column===key){const d=drag.current;setColumnWidths(old=>({...old,[key]:Math.max(90,d.width+event.clientX-d.x)}));}}}
                onPointerUp={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}} />
            </th>)}
          </tr></thead>
          <tbody>
            {start>0?<tr aria-hidden="true"><td colSpan={columns.length+1} style={{height:start*rowHeight,padding:0,border:0}} /></tr>:null}
            {visible.slice(start,end).map((event,index)=>{const r=event.rows[0].record;return <tr key={event.key} aria-rowindex={start+index+2}
              className={focusedId===event.key?'ca-classic-row-focused':undefined} onClick={()=>setFocusedId(event.key)} onDoubleClick={()=>{setFocusedId(event.key);setDetailsOpen(true);}}>
              <td><input type="checkbox" aria-label={`Select ${r.exchange}:${classicIdentityLabel(r)} ${r.exDate} ${event.action}`} checked={event.ready&&event.rows.every(row=>p.selectedIds.has(row.record.id))}
                disabled={p.busy||reviewOnly||!event.ready} onChange={e=>p.onToggleMany(event.rows.map(row=>row.record.id),e.target.checked)} /></td>
              <td>{r.exchange}</td><td title={`${r.exchange}:${classicIdentityLabel(r)}`}>{classicIdentityLabel(r)}</td><td title={r.companyName??''}>{r.companyName??'—'}</td>
              <td>{event.rows.length>1?<button type="button" className="ca-classic-component-button" onClick={()=>{setFocusedId(event.key);setDetailsOpen(true);}}>{event.action}</button>:event.action}</td>
              <td>{r.exDate?r.exDate.split('-').reverse().join('-'):'—'}</td><td title={event.terms}>{event.terms}</td>
              <td title={event.status} data-status={event.category}><span className={`ca-classic-status ca-classic-status-${event.category}`}>{event.status}</span></td>
            </tr>;})}
            {end<visible.length?<tr aria-hidden="true"><td colSpan={columns.length+1} style={{height:(visible.length-end)*rowHeight,padding:0,border:0}} /></tr>:null}
          </tbody>
        </table>
        {!visible.length?<p className="ca-classic-empty" role="status">{p.search.trim()?'No matching events. Clear search or adjust the filters.':p.busy?'Checking corporate actions…':p.loadedCount?(statusFilter === 'ready' ? 'No Ready actions. Open Issues to see what is still blocked.' : 'No actions match these filters.'):'Fetch official actions, then choose Load & Validate.'}</p>:null}
      </div>
      {detailsOpen && viewport.width>=1100?<aside className="ca-classic-inspector"><header><strong>Action details</strong><button type="button" onClick={()=>setDetailsOpen(false)}>Close</button></header>{details}</aside>:null}
    </div>
    <footer className="ca-classic-statusbar">
      <span>Loaded {p.loadedCount.toLocaleString('en-IN')} · Shown {visible.length.toLocaleString('en-IN')} events · Ready {readyIds.length.toLocaleString('en-IN')} actions · Selected {selected.length}</span>
      <span role="status" aria-live="polite" title={p.message}>{p.message}</span>
      {p.progress?<ClassicProgress progress={p.progress} />:null}
      {p.canCancel?<button type="button" onClick={p.onCancel}>Cancel after current check</button>:null}
    </footer>
    {detailsOpen && viewport.width<1100?<CorporateActionClassicDialog title="Action details" onClose={()=>setDetailsOpen(false)}>{details}</CorporateActionClassicDialog>:null}
  </div>;
}
