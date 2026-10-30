// Read-only browser fixture. No desktop API, database connection or Apply handler.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { IdentityHistoricalPreview } from '/src/features/corporateActions/identity/IdentityHistoricalPreview';
import '/src/features/corporateActions/identity/identityImportWorkspace.css';
import data from '/tmp/nse-historical-repair-fde3f3e95dc4/repaired-preview.json';

function Fixture() {
  const [filter, setFilter] = useState('NEW');
  const rows = data.historyRows.filter(row => filter === 'all' || row.disposition === filter);
  return <div className="identity-import-workspace" style={{ height: '100vh', background: '#f4f7fb', color: '#202d42' }}>
    <header style={{ height: 95, flex: 'none', padding: 12 }}><h2>Historical identity — UI fixture</h2>
      <span>Retained preview data only. Apply is disabled.</span></header>
    <main className="identity-workspace-content identity-historical-content">
      <IdentityHistoricalPreview rows={rows} total={data.historyRows.length} busy={false}
        summary={<div>Symbol {data.newSymbolChanges} · Name {data.newNameChanges} · Combined {data.newCombinedChanges} · Errors {data.errorRows}</div>}
        filters={<div>{[['NEW','Actionable'],['all','All'],['DUPLICATE','Duplicates'],['SKIPPED','Skipped'],['ERROR','Errors']].map(([key,label]) =>
          <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>}
        currentEffects={data.currentUniversePreviewRows} />
    </main>
    <footer className="identity-workspace-footer"><span>UI fixture — no database writes</span><button disabled>Apply disabled</button></footer>
  </div>;
}
document.documentElement.style.cssText = '--text:#202d42;--text-dim:#526379;--border:#ced9e7;--bg2:#fff;--control-bg:#fff;--control-bg-hover:#eef3ff;--accent:#3668ff';
createRoot(document.getElementById('root')!).render(<Fixture />);
