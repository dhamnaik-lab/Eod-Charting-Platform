import { useId, useRef, useState, type ReactNode } from 'react';
import { CorporateActionClassicDialog } from '../workspace/CorporateActionClassicWorkspace';
import { identityStatusText } from './identityImportModel';
import './identityImportWorkspace.css';
import type { IdentityDisplayPreferences, IdentityView } from './identityDisplayPreferences';
import { identityReadinessNotice } from './identityReceiptPresentation';

type View = IdentityView;
export interface IdentityImportWorkspaceProps {
  databasePath: string | null;
  busy: boolean;
  header: ReactNode;
  sourceControls: ReactNode;
  historicalSourceControls?: ReactNode;
  summary: ReactNode;
  historicalSummary?: ReactNode;
  status: string;
  current: ReactNode;
  currentToolbar: ReactNode;
  currentFooter: ReactNode;
  historical?: ReactNode;
  historicalToolbar?: ReactNode;
  historicalFooter?: ReactNode;
  recent?: ReactNode;
  preferences?: IdentityDisplayPreferences;
  onPreferencesChange?: (patch: Partial<IdentityDisplayPreferences>) => void;
  settingsWarning?: boolean;
  diagnostics: ReactNode;
}

export function IdentityImportWorkspace(props: IdentityImportWorkspaceProps) {
  const [localView, setLocalView] = useState<View>('current');
  const requestedView = props.preferences?.view ?? localView;
  const view = requestedView === 'recent' && !props.recent || requestedView === 'historical' && !props.historical ? 'current' : requestedView;
  const setView = (value: View) => props.onPreferencesChange ? props.onPreferencesChange({ view: value }) : setLocalView(value);
  const [showStatusDetails, setShowStatusDetails] = useState(false);
  const id = useId();
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const views = [
    { key: 'current' as const, label: 'Current universe' },
    ...(props.historical ? [{ key: 'historical' as const, label: 'Historical identity' }] : []),
    ...(props.recent ? [{ key: 'recent' as const, label: 'Recent Applied' }] : []),
    { key: 'diagnostics' as const, label: 'Source diagnostics' },
  ];
  const readinessNotice=identityReadinessNotice(props.status);
  const message = readinessNotice?.summary ?? identityStatusText(props.status);
  return <section className="identity-import-workspace" aria-label="Identity Import">
    <header className="identity-workspace-heading">
      <div className="identity-workspace-title"><strong>Identity Import</strong><span title={props.databasePath ?? undefined}>
        {props.databasePath ? `Database: ${props.databasePath}` : 'Open a database to preview identity changes'}
      </span></div>
      <div className="identity-workspace-controls">{props.header}</div>
    </header>
    <div className="identity-workspace-navigation">
    <div className="identity-workspace-tabs" role="tablist" aria-label="Identity workspace views">
      {views.map((item, index) => <button key={item.key} type="button" role="tab"
        ref={element => { tabs.current[index] = element; }} id={`${id}-${item.key}-tab`}
        aria-selected={view === item.key} aria-controls={`${id}-${item.key}-panel`}
        tabIndex={view === item.key ? 0 : -1} disabled={props.busy}
        onClick={() => setView(item.key)} onKeyDown={event => {
          let next: number;
          if (event.key === 'ArrowRight') next = (index + 1) % views.length;
          else if (event.key === 'ArrowLeft') next = (index + views.length - 1) % views.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = views.length - 1;
          else return;
          event.preventDefault(); setView(views[next].key); tabs.current[next]?.focus();
        }}>{item.label}</button>)}
    </div>
    <div className="identity-workspace-toolbar">
      {view === 'current' ? props.currentToolbar : view === 'historical' ? props.historicalToolbar : null}
    </div>
    {view !== 'diagnostics' && view !== 'recent' ? <details className="identity-source-disclosure"
      open={props.preferences?.sourceStatusOpen} onToggle={event => {
        if (props.preferences && props.preferences.sourceStatusOpen !== event.currentTarget.open) props.onPreferencesChange?.({ sourceStatusOpen: event.currentTarget.open });
      }}>
      <summary>Source status</summary>
      <div className="identity-workspace-source-summary">{view === 'historical' && props.historicalSummary !== undefined ? props.historicalSummary : props.summary}
        <button type="button" disabled={props.busy} onClick={() => setView('diagnostics')}>View diagnostics</button>
      </div>
    </details> : null}
    {props.status ? <div className="identity-workspace-status" role="status">
      <button type="button" title={readinessNotice?.detail ?? message} aria-label="Identity operation status details"
        onClick={() => setShowStatusDetails(true)}>
        {props.busy ? message : /^(Applied|Previewed) /.test(message) ? 'Operation details' : message}
      </button>
    </div> : null}
    </div>
    {view === 'historical' && props.historicalSourceControls !== undefined ? props.historicalSourceControls : view !== 'diagnostics' && view !== 'recent' ? props.sourceControls : null}
    {props.settingsWarning ? <p role="status" className="identity-review-note">Display settings could not be saved. Changes are kept for this session.</p> : null}
    {views.map(item => <div key={item.key} role="tabpanel" id={`${id}-${item.key}-panel`}
      aria-labelledby={`${id}-${item.key}-tab`} hidden={view !== item.key} tabIndex={0}
      className={`identity-workspace-content identity-${item.key}-content`}>
      {view === item.key ? item.key === 'current' ? props.current
        : item.key === 'historical' ? props.historical : item.key === 'recent' ? props.recent : props.diagnostics : null}
    </div>)}
    {view !== 'diagnostics' && view !== 'recent' ? <footer className="identity-workspace-footer">
      {view === 'current' ? props.currentFooter : props.historicalFooter}
    </footer> : null}
    {showStatusDetails ? <CorporateActionClassicDialog title="Identity operation details" onClose={() => setShowStatusDetails(false)}>
      {readinessNotice ? <p>{readinessNotice.detail}</p> : null}
      <pre className="identity-diagnostic-raw">{props.status}</pre>
    </CorporateActionClassicDialog> : null}
  </section>;
}
