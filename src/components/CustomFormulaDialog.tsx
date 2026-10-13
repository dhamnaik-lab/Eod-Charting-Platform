import { useEffect, useMemo, useState } from 'react';
import type { OverlayIndicator } from '@/engine/types';
import {
  type CustomFormulaIndicatorInput,
  normalizeCustomFormulaInput,
  validateCustomFormulaDefinition,
} from '@/modules/formulaEngine/customFormulaEngine';
import { ColorToolbox } from './common/ColorToolbox';

type CustomFormulaIndicator = Extract<OverlayIndicator, { kind: 'CUSTOM' }>;

interface CustomFormulaDialogProps {
  indicator?: CustomFormulaIndicator | null;
  onSubmit: (draft: CustomFormulaIndicatorInput) => void;
  onClose: () => void;
  onRemove?: (id: string) => void;
}

export function CustomFormulaDialog({
  indicator,
  onSubmit,
  onClose,
  onRemove,
}: CustomFormulaDialogProps) {
  const [draft, setDraft] = useState<CustomFormulaIndicatorInput>(() => toDraft(indicator));
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    setDraft(toDraft(indicator));
    setSubmitAttempted(false);
  }, [indicator?.id]);

  const normalizedDraft = useMemo(
    () => normalizeCustomFormulaInput(draft),
    [draft],
  );
  const validation = useMemo(
    () => validateCustomFormulaDefinition(normalizedDraft.formula),
    [normalizedDraft.formula],
  );
  const canSubmit = normalizedDraft.name.trim().length > 0 && validation.ok;
  const showValidation = submitAttempted || normalizedDraft.formula.length > 0;

  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (!canSubmit) {
      return;
    }

    onSubmit(normalizedDraft);
  };

  return (
    <div style={dialogBackdropStyle} onMouseDown={onClose}>
      <div style={dialogPanelStyle} onMouseDown={(event) => event.stopPropagation()}>
        <div style={dialogHeaderStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <strong style={{ fontSize: 17, color: 'var(--text)' }}>
              {indicator ? 'Custom Formula Settings' : 'Add Custom Formula'}
            </strong>
            <div style={dialogSubheadStyle}>
              Controlled formula MVP. Numeric assignments plot as lines; boolean assignments are helper logic only in this pass.
            </div>
          </div>
          <button type="button" style={dialogCloseStyle} onClick={onClose}>
            x
          </button>
        </div>

        <div style={dialogBodyStyle}>
          <div style={fieldGridStyle}>
            <label style={fieldStyle}>
              <span>Name</span>
              <input
                value={draft.name}
                onChange={(event) => setDraft((state) => ({ ...state, name: event.target.value }))}
                placeholder="MA Cross"
                style={textInputStyle}
              />
            </label>

            <label style={fieldStyle}>
              <span>Placement</span>
              <select
                value={draft.placement}
                onChange={(event) =>
                  setDraft((state) => ({
                    ...state,
                    placement: event.target.value === 'pane' ? 'pane' : 'overlay',
                  }))
                }
                style={selectFieldStyle}
              >
                <option value="overlay">Overlay on price</option>
                <option value="pane">Separate pane</option>
              </select>
            </label>

            <div style={fieldStyle}>
              <span>Primary Color</span>
              <ColorToolbox
                value={draft.color}
                onChange={(color) => setDraft((state) => ({ ...state, color }))}
                ariaLabel="Primary color"
              />
            </div>
          </div>

          <label style={formulaFieldStyle}>
            <span>Formula</span>
            <textarea
              value={draft.formula}
              onChange={(event) => setDraft((state) => ({ ...state, formula: event.target.value }))}
              placeholder={`MA50 = SMA(close, 50)\nMA200 = SMA(close, 200)\nBUY = crossover(MA50, MA200)\nSELL = crossunder(MA50, MA200)`}
              spellCheck={false}
              style={textareaStyle}
            />
          </label>

          <div style={helperBlockStyle}>
            <div style={helperTitleStyle}>Supported fields</div>
            <div style={helperTextStyle}>open, high, low, close, volume</div>
          </div>

          <div style={helperBlockStyle}>
            <div style={helperTitleStyle}>Supported functions</div>
            <div style={helperTextStyle}>
              SMA, EMA, RSI, highest, lowest, ref, change, crossover, crossunder, abs, min, max
            </div>
          </div>

          {showValidation ? (
            <div style={validationPanelStyle(validation.errors.length === 0)}>
              <div style={validationTitleStyle(validation.errors.length === 0)}>
                {validation.errors.length === 0 ? 'Formula looks valid' : 'Validation issues'}
              </div>
              {validation.errors.length ? (
                <div style={validationListStyle}>
                  {validation.errors.map((error) => (
                    <div key={error} style={validationErrorStyle}>
                      {error}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={helperTextStyle}>
                  Plots: {validation.plotLabels.join(', ')}
                  {validation.booleanOutputs.length ? ` | helper boolean vars: ${validation.booleanOutputs.join(', ')}` : ''}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div style={dialogFooterStyle}>
          {indicator && onRemove ? (
            <button
              type="button"
              style={{ ...actionButtonStyle, minWidth: 88 }}
              onClick={() => onRemove(indicator.id)}
            >
              Remove
            </button>
          ) : null}
          <button type="button" style={{ ...actionButtonStyle, minWidth: 88 }} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            style={{
              ...actionButtonStyle,
              minWidth: 88,
              borderColor: canSubmit ? 'var(--accent)' : 'var(--border)',
              color: canSubmit ? 'var(--text)' : 'var(--text-mute)',
            }}
            onClick={handleSubmit}
          >
            {indicator ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

function toDraft(indicator?: CustomFormulaIndicator | null): CustomFormulaIndicatorInput {
  if (!indicator) {
    return {
      name: 'Custom Formula',
      placement: 'overlay',
      color: '#6a9bcc',
      formula: '',
    };
  }

  return {
    name: indicator.name,
    placement: indicator.placement,
    color: indicator.color,
    formula: indicator.formula,
  };
}

const dialogBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--overlay-bg)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 44,
};

const dialogPanelStyle: React.CSSProperties = {
  width: 'min(760px, calc(100vw - 56px))',
  maxHeight: 'min(720px, calc(100vh - 56px))',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 12,
  overflow: 'hidden',
  border: '1px solid var(--border)',
  background: 'var(--bg2)',
  boxShadow: 'var(--shadow-lg)',
};

const dialogHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
  padding: '18px 20px 14px',
  borderBottom: '1px solid var(--border)',
};

const dialogSubheadStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-dim)',
  lineHeight: 1.5,
  maxWidth: 560,
};

const dialogCloseStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: 17,
  lineHeight: '30px',
};

const dialogBodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  padding: '18px 20px',
  overflowY: 'auto',
};

const fieldGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(220px, 1fr) 180px 120px',
  gap: 12,
};

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  color: 'var(--text-dim)',
  fontSize: 11,
  fontWeight: 600,
};

const formulaFieldStyle: React.CSSProperties = {
  ...fieldStyle,
  alignItems: 'stretch',
};

const textInputStyle: React.CSSProperties = {
  height: 32,
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--control-bg)',
  color: 'var(--text)',
  padding: '0 10px',
  outline: 'none',
};

const selectFieldStyle: React.CSSProperties = {
  ...textInputStyle,
};

const textareaStyle: React.CSSProperties = {
  minHeight: 220,
  resize: 'vertical',
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--control-bg)',
  color: 'var(--text)',
  padding: '12px 12px',
  outline: 'none',
  fontFamily: 'Consolas, Monaco, monospace',
  fontSize: 12.5,
  lineHeight: 1.55,
};

const helperBlockStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--bg3)',
};

const helperTitleStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--text-dim)',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const helperTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-dim)',
  lineHeight: 1.5,
};

const validationPanelStyle = (valid: boolean): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '12px 14px',
  borderRadius: 8,
  border: `1px solid ${valid ? 'var(--green)' : 'var(--red)'}`,
  background: 'var(--control-bg)',
});

const validationTitleStyle = (valid: boolean): React.CSSProperties => ({
  fontSize: 11,
  fontWeight: 700,
  color: valid ? 'var(--green)' : 'var(--red)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
});

const validationListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const validationErrorStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--red)',
  lineHeight: 1.5,
};

const dialogFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '0 20px 18px',
};

const actionButtonStyle: React.CSSProperties = {
  height: 26,
  minWidth: 24,
  padding: '0 10px',
  border: '1px solid var(--border2)',
  background: 'var(--control-bg)',
  color: 'var(--text)',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 700,
};
