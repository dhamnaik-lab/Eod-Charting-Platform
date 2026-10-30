import { useEffect, useRef, useState } from 'react';
import { copyTextToClipboard } from '@/platform/clipboard';
import { friendlyIdentitySourcePath, type IdentityReportOutcome } from './identityReceiptPresentation';

export function IdentityEvidenceValue({ label, value, path = false, copy = copyTextToClipboard }: {
  label: string; value: string | null | undefined; path?: boolean; copy?: (value: string) => Promise<void>;
}) {
  const [message,setMessage]=useState('');
  const live=useRef(value);live.current=value;
  const generation=useRef(0);
  useEffect(()=>{setMessage('');return()=>{++generation.current;};},[value]);
  const copyValue=async()=>{
    if(!value)return;
    const id=++generation.current;setMessage('');
    try { await copy(value);if(id===generation.current && live.current===value)setMessage(`${label} copied.`); }
    catch { if(id===generation.current && live.current===value)setMessage(`Could not copy ${label.toLowerCase()}. Select the value and copy it manually.`); }
  };
  return <span className="identity-evidence-field"><span className="identity-evidence-value" title={value ?? undefined}>{value ? path ? friendlyIdentitySourcePath(value) : value : '—'}</span>
    {value ? <button type="button" aria-label={`Copy ${label}`} title="Copy the full stored value" onClick={()=>void copyValue()}>Copy</button> : null}
    {message ? <span className="identity-evidence-feedback" role="status">{message}</span> : null}</span>;
}

export function IdentityReportFilters({ value, counts, onChange }: {
  value: IdentityReportOutcome; counts: Record<IdentityReportOutcome,number>; onChange: (value: IdentityReportOutcome) => void;
}) {
  const labels: Record<IdentityReportOutcome,string>={applied:'Applied',all:'All',skipped:'Skipped',duplicates:'Duplicates',held:'Held',errors:'Errors'};
  return <div className="identity-outcome-filters" role="group" aria-label="Saved history outcome filters">
    {(Object.keys(labels) as IdentityReportOutcome[]).filter(key=>!['held','errors'].includes(key) || counts[key]>0 || value===key).map(key=><button key={key} type="button"
      aria-pressed={value===key} onClick={()=>onChange(key)}>{labels[key]} {counts[key].toLocaleString('en-IN')}</button>)}
  </div>;
}
