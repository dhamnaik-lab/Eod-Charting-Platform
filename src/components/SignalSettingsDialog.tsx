import { useEffect, useState, type CSSProperties } from 'react';
import type { ChartSignalRule, OverlayIndicator, SignalConditionType, SignalMarkerPosition, SignalMarkerShape, SignalTarget } from '@/engine/types';
import { getIndicatorCatalogItemByKind } from '@/indicators/catalog';
import { useWindowStore } from '@/store/windowStore';
import { FloatingWindow } from '@/components/FloatingWindow';

const SIGNAL_SETTINGS_WINDOW_ID = 'signal-settings-dialog';

interface SignalSettingsDialogProps {
  rules: ChartSignalRule[];
  allIndicators?: OverlayIndicator[];
  onSaveRules: (rules: ChartSignalRule[]) => void;
  onClose: () => void;
}

export function SignalSettingsDialog({
  rules,
  allIndicators = [],
  onSaveRules,
  onClose,
}: SignalSettingsDialogProps) {
  const registerWindow = useWindowStore((state) => state.registerWindow);
  const openWindow = useWindowStore((state) => state.openWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);

  const [ruleList, setRuleList] = useState<ChartSignalRule[]>(() => JSON.parse(JSON.stringify(rules)));
  const [editingRule, setEditingRule] = useState<ChartSignalRule | null>(null);

  useEffect(() => {
    registerWindow({
      id: SIGNAL_SETTINGS_WINDOW_ID,
      title: 'Visual Crossover Signals & Alerts',
      bounds: {
        x: 240,
        y: 110,
        width: 660,
        height: 540,
      },
      minWidth: 540,
      minHeight: 380,
    });
  }, [registerWindow]);

  useEffect(() => {
    openWindow(SIGNAL_SETTINGS_WINDOW_ID);
    focusWindow(SIGNAL_SETTINGS_WINDOW_ID);
  }, [openWindow, focusWindow]);

  const handleToggleRule = (id: string, enabled: boolean) => {
    const updated = ruleList.map((r) => (r.id === id ? { ...r, enabled } : r));
    setRuleList(updated);
  };

  const handleDeleteRule = (id: string) => {
    const updated = ruleList.filter((r) => r.id !== id);
    setRuleList(updated);
  };

  const handleSaveEdit = (updatedRule: ChartSignalRule) => {
    const exists = ruleList.some((r) => r.id === updatedRule.id);
    const updated = exists
      ? ruleList.map((r) => (r.id === updatedRule.id ? updatedRule : r))
      : [...ruleList, updatedRule];
    setRuleList(updated);
    setEditingRule(null);
  };

  const handleDone = () => {
    onSaveRules(ruleList);
    onClose();
  };

  return (
    <FloatingWindow id={SIGNAL_SETTINGS_WINDOW_ID} onClose={onClose}>
      <div style={containerStyle}>
        <div style={dialogBodyStyle}>
          {editingRule ? (
            <RuleEditorForm
              rule={editingRule}
              allIndicators={allIndicators}
              onSave={handleSaveEdit}
              onCancel={() => setEditingRule(null)}
            />
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>Configured Signal Triggers</span>
                <button
                  type="button"
                  style={btnPrimaryStyle}
                  onClick={() => setEditingRule(createNewRule())}
                >
                  + Add Signal Rule
                </button>
              </div>

              {!ruleList.length ? (
                <div style={emptyStyle}>No signal rules configured. Click "+ Add Signal Rule" to create one.</div>
              ) : (
                <div style={ruleListContainerStyle}>
                  {ruleList.map((rule) => (
                    <div key={rule.id} style={ruleRowStyle}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) => handleToggleRule(rule.id, e.target.checked)}
                        />
                        <span style={{ width: 12, height: 12, borderRadius: 2, background: rule.color ?? '#22c55e' }} />
                        <strong>{rule.label}</strong>
                      </label>
                      <button
                        type="button"
                        style={btnSecondaryStyle}
                        onClick={() => setEditingRule(rule)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        style={btnDangerStyle}
                        onClick={() => handleDeleteRule(rule.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {!editingRule && (
          <div style={dialogFooterStyle}>
            <button type="button" style={btnSecondaryStyle} onClick={onClose}>
              Cancel
            </button>
            <button type="button" style={btnPrimaryStyle} onClick={handleDone}>
              Save & Apply
            </button>
          </div>
        )}
      </div>
    </FloatingWindow>
  );
}

function RuleEditorForm({
  rule,
  allIndicators,
  onSave,
  onCancel,
}: {
  rule: ChartSignalRule;
  allIndicators: OverlayIndicator[];
  onSave: (rule: ChartSignalRule) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ChartSignalRule>(() => JSON.parse(JSON.stringify(rule)));

  const handleTargetChange = (key: 'seriesA' | 'seriesB', valueStr: string) => {
    if (valueStr.startsWith('ind:')) {
      const targetId = valueStr.replace('ind:', '');
      setDraft((prev) => ({ ...prev, [key]: { indicatorId: targetId } }));
    } else if (valueStr.startsWith('static:')) {
      const num = Number(valueStr.replace('static:', '')) || 0;
      setDraft((prev) => ({ ...prev, [key]: { staticValue: num } }));
    } else {
      setDraft((prev) => ({ ...prev, [key]: { source: valueStr as import('@/engine/types').IndicatorSource } }));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={fieldStyle}>
        <span>Rule Label</span>
        <input
          type="text"
          value={draft.label}
          onChange={(e) => setDraft((p) => ({ ...p, label: e.target.value }))}
          style={inputTextStyle}
        />
      </label>

      <div style={grid2Style}>
        <label style={fieldStyle}>
          <span>Series A (Source)</span>
          <select
            value={formatTargetValue(draft.seriesA)}
            onChange={(e) => handleTargetChange('seriesA', e.target.value)}
            style={selectStyle}
          >
            <optgroup label="Price Data">
              <option value="close">Close</option>
              <option value="open">Open</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </optgroup>
            {allIndicators.length > 0 && (
              <optgroup label="Active Indicators">
                {allIndicators.map((ind) => (
                  <option key={ind.id} value={`ind:${ind.id}`}>
                    {getIndicatorCatalogItemByKind(ind.kind)?.label ?? ind.kind} ({ind.id})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        <label style={fieldStyle}>
          <span>Condition</span>
          <select
            value={draft.conditionType}
            onChange={(e) => setDraft((p) => ({ ...p, conditionType: e.target.value as SignalConditionType }))}
            style={selectStyle}
          >
            <option value="crosses_above">Crosses Above (Bullish)</option>
            <option value="crosses_below">Crosses Below (Bearish)</option>
            <option value="greater_than">Greater Than</option>
            <option value="less_than">Less Than</option>
          </select>
        </label>
      </div>

      <div style={grid2Style}>
        <label style={fieldStyle}>
          <span>Series B (Target / Threshold)</span>
          <select
            value={formatTargetValue(draft.seriesB)}
            onChange={(e) => handleTargetChange('seriesB', e.target.value)}
            style={selectStyle}
          >
            <optgroup label="Price Data">
              <option value="close">Close</option>
              <option value="open">Open</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </optgroup>
            <optgroup label="Static Thresholds">
              <option value="static:0">0</option>
              <option value="static:20">20 (Oversold)</option>
              <option value="static:30">30 (Oversold)</option>
              <option value="static:50">50 (Midline)</option>
              <option value="static:70">70 (Overbought)</option>
              <option value="static:80">80 (Overbought)</option>
            </optgroup>
            {allIndicators.length > 0 && (
              <optgroup label="Active Indicators">
                {allIndicators.map((ind) => (
                  <option key={ind.id} value={`ind:${ind.id}`}>
                    {getIndicatorCatalogItemByKind(ind.kind)?.label ?? ind.kind} ({ind.id})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        {typeof draft.seriesB.staticValue === 'number' && (
          <label style={fieldStyle}>
            <span>Custom Static Level</span>
            <input
              type="number"
              value={draft.seriesB.staticValue}
              onChange={(e) => {
                const val = Number(e.target.value);
                setDraft((p) => ({ ...p, seriesB: { staticValue: val } }));
              }}
              style={inputTextStyle}
            />
          </label>
        )}
      </div>

      <div style={grid3Style}>
        <label style={fieldStyle}>
          <span>Marker Shape</span>
          <select
            value={draft.shape ?? 'arrow_up'}
            onChange={(e) => setDraft((p) => ({ ...p, shape: e.target.value as SignalMarkerShape }))}
            style={selectStyle}
          >
            <option value="arrow_up">Up Arrow (▲)</option>
            <option value="arrow_down">Down Arrow (▼)</option>
            <option value="circle">Circle (•)</option>
            <option value="square">Square (■)</option>
            <option value="cross">Cross (+)</option>
          </select>
        </label>

        <label style={fieldStyle}>
          <span>Color</span>
          <input
            type="color"
            value={draft.color ?? '#22c55e'}
            onChange={(e) => setDraft((p) => ({ ...p, color: e.target.value }))}
            style={{ width: '100%', height: 32, padding: 0, border: 'none', background: 'none' }}
          />
        </label>

        <label style={fieldStyle}>
          <span>Position</span>
          <select
            value={draft.position ?? 'below_bar'}
            onChange={(e) => setDraft((p) => ({ ...p, position: e.target.value as SignalMarkerPosition }))}
            style={selectStyle}
          >
            <option value="below_bar">Below Bar</option>
            <option value="above_bar">Above Bar</option>
            <option value="on_series">On Series</option>
          </select>
        </label>
      </div>

      <label style={fieldStyle}>
        <span>Marker Text Badge</span>
        <input
          type="text"
          value={draft.text ?? ''}
          placeholder="e.g. BUY, SELL, CROSS"
          onChange={(e) => setDraft((p) => ({ ...p, text: e.target.value }))}
          style={inputTextStyle}
        />
      </label>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid #26384d' }}>
        <button type="button" style={btnSecondaryStyle} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" style={btnPrimaryStyle} onClick={() => onSave(draft)}>
          Save Rule
        </button>
      </div>
    </div>
  );
}

function createNewRule(): ChartSignalRule {
  return {
    id: `rule_${Date.now()}`,
    label: 'New Crossover Signal',
    enabled: true,
    conditionType: 'crosses_above',
    seriesA: { source: 'close' },
    seriesB: { staticValue: 50 },
    shape: 'arrow_up',
    color: '#22c55e',
    position: 'below_bar',
    text: 'BUY',
  };
}

function formatTargetValue(target: SignalTarget): string {
  if (typeof target.staticValue === 'number') {
    return `static:${target.staticValue}`;
  }
  if (target.indicatorId) {
    return `ind:${target.indicatorId}`;
  }
  return target.source ?? 'close';
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  background: '#121e2b',
  color: '#e2e8f0',
  overflow: 'hidden',
};

const dialogBodyStyle: CSSProperties = {
  padding: 16,
  overflowY: 'auto',
  flex: 1,
};

const dialogFooterStyle: CSSProperties = {
  padding: '12px 16px',
  borderTop: '1px solid #26384d',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  background: '#0e1726',
};

const ruleListContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const ruleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  background: '#1a293b',
  borderRadius: 6,
  border: '1px solid #2d425c',
};

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  color: '#94a3b8',
};

const inputTextStyle: CSSProperties = {
  background: '#1a293b',
  border: '1px solid #2d425c',
  borderRadius: 4,
  padding: '6px 8px',
  color: '#f8fafc',
  fontSize: 13,
};

const selectStyle: CSSProperties = {
  background: '#1a293b',
  border: '1px solid #2d425c',
  borderRadius: 4,
  padding: '6px 8px',
  color: '#f8fafc',
  fontSize: 13,
};

const grid2Style: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
};

const grid3Style: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 12,
};

const emptyStyle: CSSProperties = {
  padding: 24,
  textAlign: 'center',
  color: '#64748b',
  fontSize: 13,
};

const btnPrimaryStyle: CSSProperties = {
  background: '#2563eb',
  color: '#ffffff',
  border: 'none',
  borderRadius: 4,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnSecondaryStyle: CSSProperties = {
  background: '#334155',
  color: '#f8fafc',
  border: 'none',
  borderRadius: 4,
  padding: '6px 12px',
  fontSize: 12,
  cursor: 'pointer',
};
const btnDangerStyle: CSSProperties = {
  background: '#dc2626',
  color: '#ffffff',
  border: 'none',
  borderRadius: 4,
  padding: '6px 12px',
  fontSize: 12,
  cursor: 'pointer',
};
