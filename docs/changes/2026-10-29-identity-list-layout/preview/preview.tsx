import React, { useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { IdentityImportWorkspace } from '/src/features/corporateActions/identity/IdentityImportWorkspace';
import { IdentityPreviewTable } from '/src/features/corporateActions/identity/IdentityPreviewTable';
import { IdentityApplyStatus } from '/src/features/corporateActions/identity/IdentityApplyStatus';
import type { NseCurrentUniverseSyncResult } from '/src/types/desktop';

const records = Array.from({ length: 40 }, (_, i) => ({ source: 'NSE' as const, action: i === 0 ? 'UPDATE' : i < 15 ? 'REVIEW_REQUIRED' : 'OUTSIDE_COVERAGE',
  symbol: i === 0 ? 'REFRACTORY' : `SAMPLE${i}`, companyName: 'Sample Company Limited', isin: 'Sample identifier', series: 'EQ',
  currentStatus: 'ACTIVE', proposedStatus: 'ACTIVE', matchValue: null,
  reason: i === 0 ? 'Metadata update from the current master.' : 'This record remains active and is not changed by this run.' }));
const receipt = { applied: true, activateCount: 0, newSymbols: 0, updateCount: 1, deactivateCount: 0, completedAt: '2026-10-29T05:03:14Z' } as NseCurrentUniverseSyncResult;

function App() {
  const [size, setSize] = useState('1536x714'); const [mode, setMode] = useState('applied');
  const [query, setQuery] = useState(''); const [metrics, setMetrics] = useState('Measuring…');
  const [width, height] = size.split('x').map(Number); const applied = mode === 'applied';
  useLayoutEffect(() => {
    const update = () => {
      const workspace = document.querySelector('.identity-import-workspace')!.getBoundingClientRect();
      const list = document.querySelector('.identity-preview-table-scroll')!.getBoundingClientRect();
      setMetrics(`List area: ${(100 * list.height / workspace.height).toFixed(1)}% · ${Math.round(list.height)} / ${Math.round(workspace.height)} CSS px`);
    };
    const observer = new ResizeObserver(update); observer.observe(document.querySelector('.fixture-frame')!); update();
    return () => observer.disconnect();
  }, [size, mode]);
  return <>
    <div className="fixture-controls"><strong>Layout fixture · sample data · no database access or writes</strong>
      <label>Tab size <select value={size} onChange={e => setSize(e.target.value)}><option>1536x714</option><option>1920x890</option><option>1280x660</option><option>800x600</option></select></label>
      <label>State <select value={mode} onChange={e => setMode(e.target.value)}><option value="applied">Completed</option><option value="preview">Preview</option></select></label>
      <output aria-label="List area measurement">{metrics}</output>
    </div>
    <div className="fixture-frame" style={{ width, height, transform: `scale(${Math.min((window.innerWidth - 16) / width, 1)})` }}>
      <IdentityImportWorkspace databasePath="Example database" busy={false} status={applied ? 'Applied NSE current-universe sync. Full operation evidence is available here.' : 'Previewed NSE current-universe sync.'}
        header={<div className="fixture-header"><div className="fixture-selectors"><span>Exchange</span><button>NSE</button><button>BSE</button><span>Source</span><button>Official</button><button>Manual</button></div><button aria-label="Identity import information">Help</button></div>}
        sourceControls={null} summary={<div><strong>NSE · Official sources</strong><span>Source health not checked</span><span>Saved sources read by current preview</span></div>}
        currentToolbar={<><button>Refresh &amp; Preview</button><button>Preview Saved Sources</button></>}
        current={<><IdentityApplyStatus result={applied ? receipt : null} progress={null} error={null} refreshWarning={null}/>
          {!applied ? <div className="fixture-counts">{['New 0', 'Activate 0', 'Update 1', 'Deactivate 0', 'Unchanged 3200', 'Held for review 62', 'Outside coverage 990'].map(x => <span key={x}>{x}</span>)}</div> : null}
          <IdentityPreviewTable rows={records.filter(row => row.symbol.includes(query.toUpperCase()))} loaded total={40} busy={false} applied={applied}
            toolbar={<div className="fixture-search"><label htmlFor="find">Find</label><input id="find" placeholder="Symbol, company or ISIN" value={query} onChange={e=>setQuery(e.target.value)}/><button onClick={()=>setQuery('REFRACTORY')}>Current Chart</button></div>}/></>}
        currentFooter={<><strong>{applied ? 'Completed · 40 sample result rows' : 'Preview loaded · 40 sample rows'}</strong><button disabled={applied}>Apply Reviewed Changes</button></>}
        historical={<p>Historical sample content</p>} historicalToolbar={<button>Preview Historical Identity</button>} historicalFooter={<button disabled>Apply Reviewed Historical Identity</button>}
        diagnostics={<p>Sample diagnostics only. No database or source calls.</p>} />
    </div>
  </>;
}
createRoot(document.getElementById('root')!).render(<App/>);
