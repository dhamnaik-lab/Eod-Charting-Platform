import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import {
  isValidHex,
  parseColor,
  serializeColor,
  toHex6,
  TRADING_PALETTE_MATRIX,
  TRADING_SEMANTIC_SWATCHES,
} from './colorUtils';

export interface ColorToolboxProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  ariaLabel?: string;
  disabled?: boolean;
  allowAlpha?: boolean;
  align?: 'left' | 'right' | 'auto';
  className?: string;
  style?: CSSProperties;
  buttonStyle?: CSSProperties;
}

export function ColorToolbox({
  value,
  onChange,
  label,
  ariaLabel,
  disabled = false,
  allowAlpha = false,
  align = 'auto',
  className,
  style,
  buttonStyle,
}: ColorToolboxProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nativeInputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Parse incoming value
  const parsed = useMemo(() => parseColor(value), [value]);
  const [draftHex, setDraftHex] = useState(parsed.hex);
  const [draftAlpha, setDraftAlpha] = useState(parsed.alpha);
  const [hexInputText, setHexInputText] = useState(parsed.hex);

  // Sync internal draft state when prop value changes
  useEffect(() => {
    setDraftHex(parsed.hex);
    setDraftAlpha(parsed.alpha);
    setHexInputText(parsed.hex);
  }, [parsed.hex, parsed.alpha]);

  // Click-outside listener
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen]);

  const commitColor = (nextHex: string, nextAlpha: number) => {
    const formattedHex = toHex6(nextHex);
    setDraftHex(formattedHex);
    setHexInputText(formattedHex);
    setDraftAlpha(nextAlpha);
    const serialized = serializeColor(formattedHex, nextAlpha, allowAlpha ? 'auto' : 'hex', parsed.isRgba);
    onChange(serialized);
  };

  const handleSelectSwatch = (color: string) => {
    commitColor(color, draftAlpha);
  };

  const handleHexInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.toUpperCase();
    setHexInputText(raw);
    if (isValidHex(raw)) {
      commitColor(raw, draftAlpha);
    }
  };

  const handleHexInputBlur = () => {
    if (!isValidHex(hexInputText)) {
      setHexInputText(draftHex);
    } else {
      commitColor(hexInputText, draftAlpha);
    }
  };

  const handleHexInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleHexInputBlur();
    }
  };

  const handleAlphaChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextAlpha = parseFloat(event.target.value);
    if (!Number.isNaN(nextAlpha)) {
      commitColor(draftHex, nextAlpha);
    }
  };

  const handleNativeColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    commitColor(event.target.value, draftAlpha);
  };

  // Preview color for the trigger button
  const currentDisplayColor = serializeColor(draftHex, draftAlpha, allowAlpha ? 'auto' : 'hex', parsed.isRgba);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ ...wrapperStyle, ...style }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        style={{
          ...triggerButtonStyle,
          opacity: disabled ? 0.45 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          ...buttonStyle,
        }}
        aria-label={ariaLabel ?? label ?? `Color ${currentDisplayColor}`}
        aria-expanded={isOpen}
      >
        <span style={swatchBoxStyle}>
          <span
            style={{
              ...swatchColorStyle,
              backgroundColor: currentDisplayColor,
            }}
          />
        </span>
        <span style={triggerTextStyle}>
          {draftHex.toUpperCase()}
          {allowAlpha && draftAlpha < 1 ? ` (${Math.round(draftAlpha * 100)}%)` : ''}
        </span>
        <span style={chevronStyle}>▾</span>
      </button>

      {isOpen && (
        <div
          style={{
            ...popoverStyle,
            ...(align === 'right' ? { right: 0, left: 'auto' } : { left: 0, right: 'auto' }),
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Top Bar: Preview swatch, Hex input, and native picker button */}
          <div style={topBarStyle}>
            <div style={previewBoxStyle}>
              <span style={{ ...previewColorStyle, backgroundColor: currentDisplayColor }} />
            </div>

            <div style={hexInputWrapStyle}>
              <span style={hexHashStyle}>#</span>
              <input
                type="text"
                value={hexInputText.replace(/^#/, '')}
                onChange={handleHexInputChange}
                onBlur={handleHexInputBlur}
                onKeyDown={handleHexInputKeyDown}
                maxLength={8}
                spellCheck={false}
                style={hexInputFieldStyle}
                placeholder="RRGGBB"
              />
            </div>

            {/* Native OS Picker Button */}
            <button
              type="button"
              style={customColorWheelButtonStyle}
              onClick={() => nativeInputRef.current?.click()}
              title="Open system color wheel"
              aria-label="Open system color wheel"
            >
              🎨
            </button>
            <input
              ref={nativeInputRef}
              type="color"
              value={draftHex}
              onChange={handleNativeColorChange}
              style={hiddenNativeColorInputStyle}
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>

          {/* Quick Picks: Primary Trading Swatches */}
          <div style={sectionStyle}>
            <div style={sectionHeadingStyle}>Trading Primaries</div>
            <div style={semanticGridStyle}>
              {TRADING_SEMANTIC_SWATCHES.map((swatch) => {
                const isSelected = draftHex.toLowerCase() === swatch.toLowerCase();
                return (
                  <button
                    key={swatch}
                    type="button"
                    style={{
                      ...swatchButtonStyle(swatch, isSelected),
                      width: 24,
                      height: 24,
                    }}
                    onClick={() => handleSelectSwatch(swatch)}
                    title={swatch}
                    aria-label={`Select color ${swatch}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Palette Matrix */}
          <div style={sectionStyle}>
            <div style={sectionHeadingStyle}>Color Palette</div>
            <div style={paletteMatrixStyle}>
              {TRADING_PALETTE_MATRIX.map((row, rowIndex) => (
                <div key={rowIndex} style={paletteRowStyle}>
                  {row.map((swatch) => {
                    const isSelected = draftHex.toLowerCase() === swatch.toLowerCase();
                    return (
                      <button
                        key={swatch}
                        type="button"
                        style={swatchButtonStyle(swatch, isSelected)}
                        onClick={() => handleSelectSwatch(swatch)}
                        title={swatch}
                        aria-label={`Select color ${swatch}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Optional Opacity Slider */}
          {allowAlpha && (
            <div style={opacitySectionStyle}>
              <div style={opacityRowStyle}>
                <span style={opacityLabelStyle}>Opacity</span>
                <span style={opacityValueStyle}>{Math.round(draftAlpha * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={draftAlpha}
                onChange={handleAlphaChange}
                style={opacitySliderStyle}
                aria-label="Color opacity"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Standard settings dialog row with label on the left and ColorToolbox on the right.
 */
export function ColorToolboxRow({
  label,
  value,
  onChange,
  disabled,
  allowAlpha,
  align,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  allowAlpha?: boolean;
  align?: 'left' | 'right' | 'auto';
}) {
  return (
    <div style={colorRowStyle}>
      <span style={colorRowLabelStyle}>{label}</span>
      <ColorToolbox
        value={value}
        onChange={onChange}
        label={label}
        disabled={disabled}
        allowAlpha={allowAlpha}
        align={align}
      />
    </div>
  );
}

// ----------------- STYLES -----------------

const wrapperStyle: CSSProperties = {
  position: 'relative',
  display: 'inline-block',
};

const triggerButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 8px',
  background: 'var(--bg3)',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  color: 'var(--text)',
  fontSize: 12,
  fontWeight: 600,
  userSelect: 'none',
  transition: 'border-color 0.15s, background 0.15s',
};

const swatchBoxStyle: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 3,
  border: '1px solid var(--border2)',
  overflow: 'hidden',
  display: 'inline-block',
  background: 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 8px 8px',
  flexShrink: 0,
};

const swatchColorStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'block',
};

const triggerTextStyle: CSSProperties = {
  letterSpacing: '0.04em',
  fontVariantNumeric: 'tabular-nums',
};

const chevronStyle: CSSProperties = {
  fontSize: 10,
  opacity: 0.6,
  marginLeft: 2,
};

const popoverStyle: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  width: 254,
  background: 'var(--bg2)',
  border: '1px solid var(--border2)',
  borderRadius: 6,
  boxShadow: 'var(--shadow-lg, 0 10px 25px rgba(0, 0, 0, 0.45))',
  zIndex: 1000,
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const topBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const previewBoxStyle: CSSProperties = {
  width: 32,
  height: 28,
  borderRadius: 4,
  border: '1px solid var(--border2)',
  overflow: 'hidden',
  background: 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 8px 8px',
  flexShrink: 0,
};

const previewColorStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'block',
};

const hexInputWrapStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  background: 'var(--bg3)',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  padding: '0 6px',
};

const hexHashStyle: CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 12,
  fontWeight: 700,
  marginRight: 2,
};

const hexInputFieldStyle: CSSProperties = {
  width: '100%',
  height: 28,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: 'var(--text)',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.05em',
  fontVariantNumeric: 'tabular-nums',
  textTransform: 'uppercase',
};

const customColorWheelButtonStyle: CSSProperties = {
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg3)',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 14,
  padding: 0,
  flexShrink: 0,
};

const hiddenNativeColorInputStyle: CSSProperties = {
  position: 'absolute',
  opacity: 0,
  pointerEvents: 'none',
  width: 0,
  height: 0,
};

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const sectionHeadingStyle: CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const semanticGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(8, 24px)',
  gap: 5,
};

const paletteMatrixStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const paletteRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(9, 21px)',
  gap: 4,
};

const swatchButtonStyle = (color: string, isSelected: boolean): CSSProperties => ({
  width: 21,
  height: 21,
  borderRadius: 3,
  background: color,
  border: isSelected ? '2px solid var(--accent, #3b82f6)' : '1px solid rgba(0,0,0,0.2)',
  outline: isSelected ? '1px solid var(--bg2)' : 'none',
  outlineOffset: -2,
  cursor: 'pointer',
  padding: 0,
  transition: 'transform 0.1s, box-shadow 0.1s',
  boxShadow: isSelected ? '0 0 0 2px var(--accent, #3b82f6)' : 'none',
});

const opacitySectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  paddingTop: 4,
  borderTop: '1px solid var(--border2)',
};

const opacityRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const opacityLabelStyle: CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
  fontWeight: 600,
};

const opacityValueStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 11,
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
};

const opacitySliderStyle: CSSProperties = {
  width: '100%',
  accentColor: 'var(--accent, #3b82f6)',
  cursor: 'pointer',
  height: 4,
  margin: '4px 0',
};

const colorRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 0',
};

const colorRowLabelStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 500,
};
