import React, { useEffect, useState } from 'react';
import {
  lookupDnnTrendPrecomputedPrediction,
  type DnnTrendPrecomputedLookupResult,
  type DnnTrendPrecomputedPredictionSource,
} from '@/plugins/forecast/dnnTrend/precomputedPredictionSource';
import {
  DNN_TREND_SUPPORTED_HORIZONS,
  type DnnTrendHorizon,
} from '@/plugins/forecast/dnnTrend/types';

export interface DnnTrendPredictionPanelProps {
  source: DnnTrendPrecomputedPredictionSource;
  activeSymbol?: string | null;
  activeExchange?: string | null;
  activeAsOfDate?: string | null;
}

export function DnnTrendPredictionPanel({
  source,
  activeSymbol,
  activeExchange,
  activeAsOfDate,
}: DnnTrendPredictionPanelProps) {
  const [symbol, setSymbol] = useState(activeSymbol ?? '');
  const [exchange, setExchange] = useState(activeExchange ?? 'NSE');
  const [asOfDate, setAsOfDate] = useState(activeAsOfDate ?? source.summary.lastAsOfDate);
  const [horizonBars, setHorizonBars] = useState<DnnTrendHorizon>(10);
  const [result, setResult] = useState<DnnTrendPrecomputedLookupResult | null>(null);

  useEffect(() => {
    setResult(null);
  }, [source]);

  const useActiveChart = () => {
    if (activeSymbol) setSymbol(activeSymbol);
    if (activeExchange) setExchange(activeExchange);
    if (activeAsOfDate) setAsOfDate(activeAsOfDate);
    setResult(null);
  };

  const runLookup = () => {
    setResult(lookupDnnTrendPrecomputedPrediction(source, {
      symbol,
      exchange,
      asOfDate,
      horizonBars,
    }));
  };

  return (
    <div style={panelStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <div style={panelTitleStyle}>Read-only prediction viewer</div>
          <div style={mutedStyle}>Exact symbol, date, and horizon lookup. No chart or trading action is performed.</div>
        </div>
        <button type="button" style={smallButtonStyle} onClick={useActiveChart} disabled={!activeSymbol}>
          Use Active Chart
        </button>
      </div>

      <div style={queryGridStyle}>
        <label style={fieldStyle}>
          <span style={fieldLabelStyle}>Symbol</span>
          <input
            value={symbol}
            onChange={(event) => {
              setSymbol(event.target.value.toUpperCase());
              setResult(null);
            }}
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={fieldLabelStyle}>Exchange</span>
          <select
            value={exchange}
            onChange={(event) => {
              setExchange(event.target.value);
              setResult(null);
            }}
            style={inputStyle}
          >
            <option value="NSE">NSE</option>
            <option value="BSE">BSE</option>
          </select>
        </label>
        <label style={fieldStyle}>
          <span style={fieldLabelStyle}>As-of date</span>
          <input
            type="date"
            value={asOfDate}
            onChange={(event) => {
              setAsOfDate(event.target.value);
              setResult(null);
            }}
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={fieldLabelStyle}>Horizon</span>
          <select
            value={horizonBars}
            onChange={(event) => {
              setHorizonBars(Number(event.target.value) as DnnTrendHorizon);
              setResult(null);
            }}
            style={inputStyle}
          >
            {DNN_TREND_SUPPORTED_HORIZONS.map((horizon) => (
              <option key={horizon} value={horizon}>{horizon} sessions</option>
            ))}
          </select>
        </label>
      </div>

      <button type="button" style={lookupButtonStyle} onClick={runLookup}>Lookup Prediction</button>

      {result?.status === 'valid' && (
        <div style={resultStyle}>
          <div style={resultHeadingStyle}>
            {result.predictedClass.toUpperCase()} · {(result.confidence * 100).toFixed(1)}% confidence
          </div>
          <div style={probabilityGridStyle}>
            <Probability label="Bullish" value={result.record.bullishProbability} />
            <Probability label="Sideways" value={result.record.sidewaysProbability} />
            <Probability label="Bearish" value={result.record.bearishProbability} />
          </div>
          <div style={mutedStyle}>Data revision: {result.record.dataRevision}</div>
        </div>
      )}

      {result && result.status !== 'valid' && (
        <div style={errorStyle}>{result.reason}</div>
      )}
    </div>
  );
}

function Probability({ label, value }: { label: string; value: number }) {
  return (
    <div style={probabilityStyle}>
      <span style={mutedStyle}>{label}</span>
      <strong>{(value * 100).toFixed(1)}%</strong>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  borderTop: '1px solid var(--border-color, #26384a)',
  marginTop: 12,
  paddingTop: 12,
};
const panelHeaderStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' };
const panelTitleStyle: React.CSSProperties = { fontWeight: 700, marginBottom: 3 };
const mutedStyle: React.CSSProperties = { color: 'var(--text-secondary, #9fb0c3)', fontSize: 12 };
const queryGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 };
const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const fieldLabelStyle: React.CSSProperties = { fontSize: 11, color: 'var(--text-secondary, #9fb0c3)' };
const inputStyle: React.CSSProperties = { minWidth: 0, border: '1px solid var(--border-color, #34495e)', borderRadius: 4, background: 'var(--surface-2, #0f1a25)', color: 'inherit', padding: '6px 8px' };
const smallButtonStyle: React.CSSProperties = { border: '1px solid var(--border-color, #34495e)', borderRadius: 4, background: 'transparent', color: 'inherit', padding: '5px 8px', cursor: 'pointer' };
const lookupButtonStyle: React.CSSProperties = { ...smallButtonStyle, marginTop: 10, background: 'var(--accent-color, #1769aa)' };
const resultStyle: React.CSSProperties = { marginTop: 10, border: '1px solid var(--border-color, #34495e)', borderRadius: 6, padding: 10 };
const resultHeadingStyle: React.CSSProperties = { fontWeight: 700, marginBottom: 8 };
const probabilityGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 8 };
const probabilityStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2, border: '1px solid var(--border-color, #34495e)', borderRadius: 4, padding: 7 };
const errorStyle: React.CSSProperties = { marginTop: 10, border: '1px solid #8b3a3a', borderRadius: 4, padding: 8, color: '#ffb7b7', fontSize: 12 };
