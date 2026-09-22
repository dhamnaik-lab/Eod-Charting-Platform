import type { CSSProperties, ReactNode } from 'react';
import { FIBONACCI_MAX_LEVEL_ROWS, createFibonacciLevelId, type FibonacciLevelDefinition } from '@/engine/DrawingFibonacciContracts';
import type { UnifiedLinePresentationSettings, UnifiedLineStyle } from '@/engine/UnifiedStyleContracts';

export interface FibonacciLevelEditorProps {
  levels: readonly FibonacciLevelDefinition[];
  slotPrefix?: 'level' | 'price' | 'time';
  lineSettings?: Record<string, UnifiedLinePresentationSettings>;
  onLevelsChange: (levels: FibonacciLevelDefinition[]) => void;
  onLineSettingsChange?: (slotId: string, patch: Partial<UnifiedLinePresentationSettings>) => void;
  allowCustomText?: boolean;
  allowRemove?: boolean;
  allowAdd?: boolean;
  maxLevels?: number;
  renderColorControl?: (args: { slotId: string; color: string; onChange: (color: string) => void }) => ReactNode;
}

/**
 * Shared F1 level-row editor. F1A ships this component unmounted so the current
 * renderers cannot expose editable coefficients before they consume stable IDs.
 * F1B-F1D plug it into tool-specific Style panels as each geometry migrates.
 */
export function FibonacciLevelEditor({
  levels,
  slotPrefix = 'level',
  lineSettings = {},
  onLevelsChange,
  onLineSettingsChange,
  allowCustomText = false,
  allowRemove = true,
  allowAdd = true,
  maxLevels = FIBONACCI_MAX_LEVEL_ROWS,
  renderColorControl,
}: FibonacciLevelEditorProps) {
  const updateLevel = (index: number, patch: Partial<FibonacciLevelDefinition>) => {
    onLevelsChange(levels.map((level, rowIndex) => (rowIndex === index ? { ...level, ...patch } : { ...level })));
  };

  const removeLevel = (index: number) => {
    onLevelsChange(levels.filter((_level, rowIndex) => rowIndex !== index).map((level) => ({ ...level })));
  };

  const addLevel = () => {
    if (levels.length >= maxLevels) return;
    const lastValue = levels.at(-1)?.value ?? 0;
    const value = Math.round((lastValue + 0.1) * 1000) / 1000;
    onLevelsChange([...levels.map((level) => ({ ...level })), { id: createFibonacciLevelId(slotPrefix), value, enabled: true }]);
  };

  const gridTemplateColumns = buildGridTemplateColumns(allowCustomText, allowRemove);

  return (
    <div style={wrapStyle}>
      <div style={{ ...headerStyle, gridTemplateColumns }}>
        <span>Show</span>
        <span>Coefficient</span>
        <span>Color</span>
        <span>Width</span>
        <span>Style</span>
        <span>Opacity</span>
        {allowCustomText ? <span>Text</span> : null}
        {allowRemove ? <span /> : null}
      </div>
      {levels.map((level, index) => {
        const slotId = `${slotPrefix}:${level.id}`;
        const line = lineSettings[slotId] ?? {};
        const color = line.color ?? '#ffffff';
        return (
          <div key={level.id} style={{ ...rowStyle, gridTemplateColumns }} data-fibonacci-level-id={level.id}>
            <input
              aria-label={`Show Fibonacci level ${level.value}`}
              type="checkbox"
              checked={level.enabled !== false}
              onChange={(event) => updateLevel(index, { enabled: event.target.checked })}
            />
            <input
              aria-label={`Fibonacci coefficient ${index + 1}`}
              type="number"
              step="0.001"
              value={level.value}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) updateLevel(index, { value });
              }}
              style={inputStyle}
            />
            {renderColorControl ? (
              renderColorControl({
                slotId,
                color,
                onChange: (nextColor) => onLineSettingsChange?.(slotId, { color: nextColor }),
              })
            ) : (
              <input
                aria-label={`Fibonacci level ${index + 1} color`}
                type="color"
                value={normalizeHex(color)}
                onChange={(event) => onLineSettingsChange?.(slotId, { color: event.target.value })}
                style={colorInputStyle}
              />
            )}
            <input
              aria-label={`Fibonacci level ${index + 1} width`}
              type="number"
              min="1"
              max="6"
              step="0.2"
              value={line.lineWidth ?? 1.2}
              onChange={(event) => onLineSettingsChange?.(slotId, { lineWidth: Number(event.target.value) })}
              style={inputStyle}
            />
            <select
              aria-label={`Fibonacci level ${index + 1} style`}
              value={line.lineStyle ?? 'solid'}
              onChange={(event) => onLineSettingsChange?.(slotId, { lineStyle: event.target.value as UnifiedLineStyle })}
              style={inputStyle}
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
            <input
              aria-label={`Fibonacci level ${index + 1} opacity`}
              type="number"
              min="0"
              max="100"
              step="1"
              value={Math.round((line.opacity ?? 1) * 100)}
              onChange={(event) => {
                const opacity = Math.max(0, Math.min(100, Number(event.target.value) || 0)) / 100;
                onLineSettingsChange?.(slotId, { opacity });
              }}
              style={inputStyle}
            />
            {allowCustomText ? (
              <input
                aria-label={`Fibonacci level ${index + 1} custom text`}
                type="text"
                value={level.customText ?? ''}
                onChange={(event) => updateLevel(index, { customText: event.target.value })}
                style={inputStyle}
              />
            ) : null}
            {allowRemove ? (
              <button type="button" onClick={() => removeLevel(index)} style={removeButtonStyle} aria-label={`Remove Fibonacci level ${index + 1}`}>
                ×
              </button>
            ) : null}
          </div>
        );
      })}
      {allowAdd ? (
        <button
          type="button"
          onClick={addLevel}
          disabled={levels.length >= maxLevels}
          style={{ ...addButtonStyle, opacity: levels.length >= maxLevels ? 0.45 : 1 }}
        >
          + Add Level
        </button>
      ) : null}
    </div>
  );
}

function buildGridTemplateColumns(allowCustomText: boolean, allowRemove: boolean): string {
  return [
    '40px',
    '92px',
    '54px',
    '62px',
    '88px',
    '68px',
    ...(allowCustomText ? ['minmax(110px, 1fr)'] : []),
    ...(allowRemove ? ['30px'] : []),
  ].join(' ');
}

function normalizeHex(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '#ffffff';
}

const wrapStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const headerStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  color: 'var(--text-dim)',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
};
const rowStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  alignItems: 'center',
};
const inputStyle: CSSProperties = {
  minWidth: 0,
  width: '100%',
  height: 28,
  border: '1px solid var(--border2)',
  borderRadius: 4,
  background: 'var(--bg2)',
  color: 'var(--text)',
  padding: '0 6px',
  fontSize: 11,
};
const colorInputStyle: CSSProperties = { width: 46, height: 28, padding: 1, border: '1px solid var(--border2)', borderRadius: 4 };
const removeButtonStyle: CSSProperties = {
  width: 28,
  height: 28,
  padding: 0,
  border: '1px solid var(--border2)',
  borderRadius: 4,
  background: 'transparent',
  color: 'var(--text-dim)',
  cursor: 'pointer',
};

const addButtonStyle: CSSProperties = {
  alignSelf: 'flex-start',
  minWidth: 92,
  height: 28,
  marginTop: 2,
  padding: '0 10px',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  background: 'var(--control-bg)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: 11,
};
