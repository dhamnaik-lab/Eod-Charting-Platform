import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react';
import type { ChartDrawing, DrawingLabelPosition, DrawingLineStyle, TextDrawingBase } from '@/engine/types';
import type { DrawingPresentationSettings, UnifiedFillPresentationSettings, UnifiedLinePresentationSettings, UnifiedSettingsTimeframe, UnifiedTimeframeVisibilitySettings } from '@/engine/UnifiedStyleContracts';
import { DRAWING_SETTINGS_TABS, getDrawingSettingsTabs, getDrawingStyleSchema, isAdvancedDrawingStyleKind, type DrawingSettingsTab } from '@/engine/DrawingStyleSchema';
import { drawingSupportsExtension, drawingSupportsLabelPosition, drawingSupportsLabelVisibility } from '@/engine/DrawingCapabilities';
import { getDrawingKindTitle } from '@/engine/DrawingMetadata';
import {
  getDrawingTemplates,
  saveDrawingTemplate,
  deleteDrawingTemplate,
  setDefaultDrawingTemplate,
  applyDrawingTemplate,
  type DrawingTemplate,
} from '@/features/drawings/drawingTemplates';
import { ColorToolbox } from './common/ColorToolbox';

export interface DrawingPropertiesState {
  drawingId: string;
  color: string;
  lineWidth: string;
  lineStyle: DrawingLineStyle;
  locked: boolean;
  extendLeft: boolean;
  extendRight: boolean;
  showLabel: boolean;
  labelPosition: DrawingLabelPosition;
  price: string;
  barIndex: string;
  startIndex: string;
  endIndex: string;
  startPrice: string;
  endPrice: string;
  anchorCoordinates: Array<{ barIndex: string; price: string }>;
  offset: string;
  text: string;
  fontSize: string;
  fontFamily: NonNullable<TextDrawingBase['fontFamily']>;
  bold: boolean;
  italic: boolean;
  textAlign: NonNullable<TextDrawingBase['textAlign']>;
  boxWidth: string;
  boxHeight: string;
  presentation: DrawingPresentationSettings;
  visibility: UnifiedTimeframeVisibilitySettings;
  positionEntry: string;
  positionTarget: string;
  positionStop: string;
  fibArcFullCircles: boolean;
  fibArcCoefficientFormat: 'coefficient' | 'percent';
  fibArcLabelSides: { left: boolean; right: boolean; top: boolean; bottom: boolean };
  fibWedgeCoefficientFormat: 'coefficient' | 'percent';
  fibSpiralCounterclockwise: boolean;
  fibFanCoefficientFormat: 'coefficient' | 'percent';
  fibFanReverse: boolean;
  fibFanShowBackground: boolean;
  fibFanShowGrid: boolean;
  fibFanPriceLabelSides: { left: boolean; right: boolean };
  fibFanTimeLabelSides: { top: boolean; bottom: boolean };
}

interface ChartDrawingPropertiesDialogProps {
  drawingProperties: DrawingPropertiesState | null;
  selectedDrawing: ChartDrawing | null;
  setDrawingProperties: Dispatch<SetStateAction<DrawingPropertiesState | null>>;
  onClose: () => void;
  onDelete: (drawingId: string) => void;
  onSave: () => void;
  actionButtonStyle: CSSProperties;
}

export function ChartDrawingPropertiesDialog({
  drawingProperties,
  selectedDrawing,
  setDrawingProperties,
  onClose,
  onDelete,
  onSave,
  actionButtonStyle,
}: ChartDrawingPropertiesDialogProps) {
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<DrawingSettingsTab>('style');
  const [dialogBounds, setDialogBounds] = useState<DialogBounds>(() => readDrawingPropertiesDialogBounds());

  const [templates, setTemplates] = useState<DrawingTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');

  const drawingId = drawingProperties?.drawingId ?? '';
  const isPositionDrawing = selectedDrawing?.kind === 'longPosition' || selectedDrawing?.kind === 'shortPosition';
  const isFibArcsDrawing = selectedDrawing?.kind === 'fibArcs';
  const isFibWedgeDrawing = selectedDrawing?.kind === 'fibWedge';
  const isFibSpiralDrawing = selectedDrawing?.kind === 'fibSpiral';
  const isFibFanDrawing = selectedDrawing?.kind === 'fibFan';
  const settingsTabs = selectedDrawing ? getDrawingSettingsTabs(selectedDrawing.kind) : DRAWING_SETTINGS_TABS;

  useEffect(() => {
    if (selectedDrawing) {
      const list = getDrawingTemplates(selectedDrawing.kind);
      setTemplates(list);
      const defaultT = list.find((t) => t.isDefault);
      if (defaultT) setSelectedTemplateId(defaultT.id);
    }
  }, [selectedDrawing]);

  const handleApplyTemplate = (templateId: string) => {
    if (templateId === '__new__') {
      setIsSavingTemplate(true);
      return;
    }
    setSelectedTemplateId(templateId);
    const target = templates.find((t) => t.id === templateId);
    if (target && drawingProperties) {
      setDrawingProperties((state) => (state ? applyDrawingTemplate(target, state) : state));
    }
  };

  const handleSaveTemplate = () => {
    if (!templateNameInput.trim() || !selectedDrawing || !drawingProperties) return;
    const created = saveDrawingTemplate(templateNameInput.trim(), selectedDrawing.kind, drawingProperties);
    const updated = getDrawingTemplates(selectedDrawing.kind);
    setTemplates(updated);
    setSelectedTemplateId(created.id);
    setTemplateNameInput('');
    setIsSavingTemplate(false);
  };

  const handleDeleteTemplate = (templateId: string) => {
    deleteDrawingTemplate(templateId);
    if (selectedDrawing) {
      const updated = getDrawingTemplates(selectedDrawing.kind);
      setTemplates(updated);
      setSelectedTemplateId('');
    }
  };

  const handleToggleDefaultTemplate = (templateId: string) => {
    setDefaultDrawingTemplate(templateId);
    if (selectedDrawing) {
      const updated = getDrawingTemplates(selectedDrawing.kind);
      setTemplates(updated);
    }
  };

  useEffect(() => {
    setActiveTab(isPositionDrawing ? 'inputs' : 'style');
  }, [drawingId, isPositionDrawing]);

  useEffect(() => {
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!panel || !backdrop) return;

    const clampBounds = (next: DialogBounds): DialogBounds => {
      const maxWidth = Math.max(560, backdrop.clientWidth - 16);
      const maxHeight = Math.max(420, backdrop.clientHeight - 16);
      const width = Math.min(Math.max(next.width, 560), maxWidth);
      const height = Math.min(Math.max(next.height, 420), maxHeight);
      const x = Math.min(Math.max(next.x, 8), Math.max(8, backdrop.clientWidth - width - 8));
      const y = Math.min(Math.max(next.y, 8), Math.max(8, backdrop.clientHeight - height - 8));
      return { x, y, width, height };
    };

    setDialogBounds((current) => {
      const seeded = current.x < 0 || current.y < 0
        ? {
            ...current,
            x: Math.max(8, (backdrop.clientWidth - current.width) / 2),
            y: Math.max(8, (backdrop.clientHeight - current.height) / 2),
          }
        : current;
      return clampBounds(seeded);
    });

    const observer = new ResizeObserver(() => {
      const rect = panel.getBoundingClientRect();
      setDialogBounds((current) => {
        const next = clampBounds({ ...current, width: rect.width, height: rect.height });
        persistDrawingPropertiesDialogBounds(next);
        return next;
      });
    });
    observer.observe(panel);

    const handleWindowResize = () => {
      setDialogBounds((current) => {
        const next = clampBounds(current);
        persistDrawingPropertiesDialogBounds(next);
        return next;
      });
    };
    window.addEventListener('resize', handleWindowResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [drawingId]);

  if (!drawingProperties) {
    return null;
  }

  const selectedTextDrawing = selectedDrawing?.kind === 'text' ? selectedDrawing : null;
  const selectedAnchoredDrawing = selectedDrawing && 'startIndex' in selectedDrawing ? selectedDrawing : null;
  const selectedPointDrawing =
    selectedDrawing && 'barIndex' in selectedDrawing && 'price' in selectedDrawing && !('startIndex' in selectedDrawing)
      ? selectedDrawing
      : null;
  const selectedMultiAnchorDrawing = selectedDrawing && 'anchors' in selectedDrawing ? selectedDrawing : null;
  const supportsExtension = selectedDrawing ? drawingSupportsExtension(selectedDrawing.kind) : false;
  const supportsLabelVisibility = selectedDrawing ? drawingSupportsLabelVisibility(selectedDrawing.kind) : false;
  const supportsLabelPosition = selectedDrawing ? drawingSupportsLabelPosition(selectedDrawing.kind) : false;
  const propertiesTitle = selectedDrawing ? `${getDrawingKindTitle(selectedDrawing.kind)} Properties` : 'Drawing Properties';
  const selectedDrawingPaneId =
    selectedDrawing && selectedDrawing.kind !== 'vline' ? selectedDrawing.paneId ?? 'price' : 'price';
  const valueLabel = selectedDrawingPaneId === 'price' ? 'Price' : 'Value';
  const startValueLabel = selectedDrawingPaneId === 'price' ? 'Point 1 Price' : 'Point 1 Value';
  const endValueLabel = selectedDrawingPaneId === 'price' ? 'Point 2 Price' : 'Point 2 Value';
  const advancedStyleSchema =
    selectedDrawing && isAdvancedDrawingStyleKind(selectedDrawing.kind) ? getDrawingStyleSchema(selectedDrawing.kind) : null;

  const updateLinePresentation = (slotId: string, patch: Partial<UnifiedLinePresentationSettings>) => {
    setDrawingProperties((state) => {
      if (!state) return state;
      const current = state.presentation.lines?.[slotId] ?? {};
      return {
        ...state,
        presentation: {
          ...state.presentation,
          useOneColor: false,
          lines: { ...state.presentation.lines, [slotId]: { ...current, ...patch } },
        },
      };
    });
  };

  const updateFillPresentation = (slotId: string, patch: Partial<UnifiedFillPresentationSettings>) => {
    setDrawingProperties((state) => {
      if (!state) return state;
      const current = state.presentation.fills?.[slotId] ?? {};
      return {
        ...state,
        presentation: {
          ...state.presentation,
          fills: { ...state.presentation.fills, [slotId]: { ...current, ...patch } },
        },
      };
    });
  };

  const updateLabelPresentation = (patch: Partial<NonNullable<DrawingPresentationSettings['labels']>>) => {
    setDrawingProperties((state) => {
      if (!state) return state;
      return {
        ...state,
        presentation: {
          ...state.presentation,
          labels: { ...state.presentation.labels, ...patch },
        },
      };
    });
  };

  const updateVisibility = (patch: Partial<UnifiedTimeframeVisibilitySettings>) => {
    setDrawingProperties((state) => (state ? { ...state, visibility: { ...state.visibility, ...patch } } : state));
  };

  const updateTimeframeVisibility = (timeframe: UnifiedSettingsTimeframe, visible: boolean) => {
    setDrawingProperties((state) =>
      state
        ? {
            ...state,
            visibility: {
              ...state.visibility,
              timeframes: { ...state.visibility.timeframes, [timeframe]: visible },
            },
          }
        : state,
    );
  };

  const extensionMode = drawingProperties.extendLeft
    ? drawingProperties.extendRight ? 'both' : 'left'
    : drawingProperties.extendRight ? 'right' : 'none';

  const beginHeaderDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    const backdrop = backdropRef.current;
    if (!backdrop) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startBounds = dialogBounds;
    const onMove = (moveEvent: PointerEvent) => {
      const maxX = Math.max(8, backdrop.clientWidth - startBounds.width - 8);
      const maxY = Math.max(8, backdrop.clientHeight - startBounds.height - 8);
      setDialogBounds((current) => ({
        ...current,
        x: Math.min(Math.max(startBounds.x + moveEvent.clientX - startX, 8), maxX),
        y: Math.min(Math.max(startBounds.y + moveEvent.clientY - startY, 8), maxY),
      }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDialogBounds((current) => {
        persistDrawingPropertiesDialogBounds(current);
        return current;
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const renderAdvancedStyle = () => {
    if (!advancedStyleSchema) return null;
    return (
      <div style={advancedStyleSectionStyle}>
        <div style={advancedStyleHeaderStyle}>
          <strong>Component styles</strong>
          <span style={compactHintStyle}>Each line color is always editable.</span>
        </div>
        <label style={advancedCommonColorStyle}>
          <span>Handle / construction color</span>
          <PropertyColorPicker
            color={drawingProperties.color}
            onChange={(color) => setDrawingProperties((state) => (state ? { ...state, color } : state))}
            ariaLabel="Choose handle and construction color"
            popupAlign="right"
            actionButtonStyle={actionButtonStyle}
          />
        </label>
        <div style={advancedLineHeaderStyle}>
          <span>Show</span>
          <span>Line</span>
          <span>Color</span>
          <span>Width</span>
          <span>Style</span>
          <span>Opacity</span>
        </div>
        {advancedStyleSchema.lines.map((slotDefinition) => {
          const line = drawingProperties.presentation.lines?.[slotDefinition.id] ?? {};
          const lineColor = line.color ?? slotDefinition.defaultColor ?? drawingProperties.color;
          return (
            <div key={slotDefinition.id} style={advancedLineRowStyle}>
              <input
                type="checkbox"
                checked={line.visible !== false}
                onChange={(event) => updateLinePresentation(slotDefinition.id, { visible: event.target.checked })}
                aria-label={`Show ${slotDefinition.label}`}
              />
              <span style={advancedSlotLabelStyle}>{slotDefinition.label}</span>
              <PropertyColorPicker
                color={lineColor}
                onChange={(color) => updateLinePresentation(slotDefinition.id, { color })}
                ariaLabel={`Choose ${slotDefinition.label} color`}
                actionButtonStyle={actionButtonStyle}
              />
              <input
                type="number"
                min="1"
                max="6"
                step="0.2"
                value={line.lineWidth ?? Number(drawingProperties.lineWidth)}
                onChange={(event) => {
                  const lineWidth = Number(event.target.value);
                  if (Number.isFinite(lineWidth) && lineWidth > 0) updateLinePresentation(slotDefinition.id, { lineWidth });
                }}
                style={advancedCompactInputStyle}
                aria-label={`${slotDefinition.label} width`}
              />
              <select
                value={line.lineStyle ?? drawingProperties.lineStyle}
                onChange={(event) => updateLinePresentation(slotDefinition.id, { lineStyle: event.target.value as DrawingLineStyle })}
                style={advancedCompactInputStyle}
                aria-label={`${slotDefinition.label} style`}
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
              </select>
              <input
                type="number"
                min="0"
                max="100"
                step="5"
                value={Math.round((line.opacity ?? 1) * 100)}
                onChange={(event) => {
                  const opacityPct = Number(event.target.value);
                  if (Number.isFinite(opacityPct)) {
                    updateLinePresentation(slotDefinition.id, { opacity: Math.max(0, Math.min(opacityPct, 100)) / 100 });
                  }
                }}
                style={advancedCompactInputStyle}
                aria-label={`${slotDefinition.label} opacity percent`}
              />
            </div>
          );
        })}
        {advancedStyleSchema.fills.length > 0 ? (
          <>
            <div style={advancedFillHeaderStyle}>Background / zones</div>
            {advancedStyleSchema.fills.map((slotDefinition) => {
              const fillState = drawingProperties.presentation.fills?.[slotDefinition.id] ?? {};
              const fillColor = fillState.color ?? slotDefinition.defaultColor ?? drawingProperties.color;
              return (
                <div key={slotDefinition.id} style={advancedFillRowStyle}>
                  <input
                    type="checkbox"
                    checked={fillState.visible !== false}
                    onChange={(event) => updateFillPresentation(slotDefinition.id, { visible: event.target.checked })}
                    aria-label={`Show ${slotDefinition.label}`}
                  />
                  <span style={advancedSlotLabelStyle}>{slotDefinition.label}</span>
                  {slotDefinition.usesLineColors ? (
                    <span style={levelColorsBadgeStyle}>Level colors</span>
                  ) : (
                    <PropertyColorPicker
                      color={fillColor}
                      onChange={(color) => updateFillPresentation(slotDefinition.id, { color })}
                      ariaLabel={`Choose ${slotDefinition.label} color`}
                      actionButtonStyle={actionButtonStyle}
                    />
                  )}
                  <span style={advancedFillOpacityLabelStyle}>Opacity</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round((fillState.opacity ?? slotDefinition.defaultOpacity ?? 0.08) * 100)}
                    onChange={(event) => {
                      const opacityPct = Number(event.target.value);
                      if (Number.isFinite(opacityPct)) {
                        updateFillPresentation(slotDefinition.id, { opacity: Math.max(0, Math.min(opacityPct, 100)) / 100 });
                      }
                    }}
                    style={advancedCompactInputStyle}
                    aria-label={`${slotDefinition.label} opacity percent`}
                  />
                </div>
              );
            })}
          </>
        ) : null}
      </div>
    );
  };

  const renderStyleTab = () => (
    <div style={tabSectionStyle}>
      {advancedStyleSchema ? renderAdvancedStyle() : (
        <div style={twoColumnFormStyle}>
          <label style={propertyFieldStyle}>
            <span>Color</span>
            <PropertyColorPicker
              color={drawingProperties.color}
              onChange={(color) => setDrawingProperties((state) => (state ? { ...state, color } : state))}
              ariaLabel="Choose drawing color"
              actionButtonStyle={actionButtonStyle}
            />
          </label>
          <label style={propertyFieldStyle}>
            <span>Line Style</span>
            <select
              value={drawingProperties.lineStyle}
              onChange={(event) => setDrawingProperties((state) => state ? { ...state, lineStyle: event.target.value as DrawingLineStyle } : state)}
              style={propertyInputStyle}
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </label>
          <label style={propertyFieldStyle}>
            <span>Line Width</span>
            <input
              type="number"
              min="1"
              max="6"
              step="0.2"
              value={drawingProperties.lineWidth}
              onChange={(event) => setDrawingProperties((state) => state ? { ...state, lineWidth: event.target.value } : state)}
              style={propertyInputStyle}
            />
          </label>
        </div>
      )}

      {isFibArcsDrawing ? (
        <div style={subSectionStyle}>
          <strong style={subSectionTitleStyle}>Fib Speed Resistance Arcs</strong>
          <div style={compactOptionsGridStyle}>
            <label style={checkboxFieldStyle}>
              <input
                type="checkbox"
                checked={drawingProperties.fibArcFullCircles}
                onChange={(event) => setDrawingProperties((state) => state ? { ...state, fibArcFullCircles: event.target.checked } : state)}
              />
              <span>Full Circles</span>
            </label>
            <label style={propertyFieldStyle}>
              <span>Level format</span>
              <select
                value={drawingProperties.fibArcCoefficientFormat}
                onChange={(event) => setDrawingProperties((state) => state ? { ...state, fibArcCoefficientFormat: event.target.value as 'coefficient' | 'percent' } : state)}
                style={propertyInputStyle}
              >
                <option value="coefficient">Coefficient</option>
                <option value="percent">Percent</option>
              </select>
            </label>
          </div>
        </div>
      ) : null}

      {isFibSpiralDrawing ? (
        <div style={subSectionStyle}>
          <strong style={subSectionTitleStyle}>Fib Spiral</strong>
          <label style={checkboxFieldStyle}>
            <input
              type="checkbox"
              checked={drawingProperties.fibSpiralCounterclockwise}
              onChange={(event) => setDrawingProperties((state) => state ? { ...state, fibSpiralCounterclockwise: event.target.checked } : state)}
            />
            <span>Counterclockwise</span>
          </label>
        </div>
      ) : null}

      {isFibWedgeDrawing ? (
        <div style={subSectionStyle}>
          <strong style={subSectionTitleStyle}>Fib Wedge</strong>
          <div style={compactOptionsGridStyle}>
            <label style={propertyFieldStyle}>
              <span>Level format</span>
              <select
                value={drawingProperties.fibWedgeCoefficientFormat}
                onChange={(event) => setDrawingProperties((state) => state ? { ...state, fibWedgeCoefficientFormat: event.target.value as 'coefficient' | 'percent' } : state)}
                style={propertyInputStyle}
              >
                <option value="coefficient">Coefficient</option>
                <option value="percent">Percent</option>
              </select>
            </label>
          </div>
        </div>
      ) : null}

      {isFibFanDrawing ? (
        <div style={subSectionStyle}>
          <strong style={subSectionTitleStyle}>Fib Speed Resistance Fan</strong>
          <div style={compactOptionsGridStyle}>
            <label style={checkboxFieldStyle}>
              <input
                type="checkbox"
                checked={drawingProperties.fibFanReverse}
                onChange={(event) => setDrawingProperties((state) => state ? { ...state, fibFanReverse: event.target.checked } : state)}
              />
              <span>Reverse</span>
            </label>
            <label style={checkboxFieldStyle}>
              <input
                type="checkbox"
                checked={drawingProperties.fibFanShowGrid}
                onChange={(event) => setDrawingProperties((state) => state ? { ...state, fibFanShowGrid: event.target.checked } : state)}
              />
              <span>Grid</span>
            </label>
            <label style={checkboxFieldStyle}>
              <input
                type="checkbox"
                checked={drawingProperties.fibFanShowBackground}
                onChange={(event) => setDrawingProperties((state) => state ? { ...state, fibFanShowBackground: event.target.checked } : state)}
              />
              <span>Background</span>
            </label>
            <label style={propertyFieldStyle}>
              <span>Level format</span>
              <select
                value={drawingProperties.fibFanCoefficientFormat}
                onChange={(event) => setDrawingProperties((state) => state ? { ...state, fibFanCoefficientFormat: event.target.value as 'coefficient' | 'percent' } : state)}
                style={propertyInputStyle}
              >
                <option value="coefficient">Coefficient</option>
                <option value="percent">Percent</option>
              </select>
            </label>
          </div>
        </div>
      ) : null}

      <div style={compactOptionsGridStyle}>
        <label style={checkboxFieldStyle}>
          <input
            type="checkbox"
            checked={drawingProperties.locked}
            onChange={(event) => setDrawingProperties((state) => state ? { ...state, locked: event.target.checked } : state)}
          />
          <span>Lock position</span>
        </label>
        {supportsExtension ? (
          <label style={propertyFieldStyle}>
            <span>Extend</span>
            <select
              value={extensionMode}
              onChange={(event) => {
                const mode = event.target.value;
                setDrawingProperties((state) => state ? {
                  ...state,
                  extendLeft: mode === 'left' || mode === 'both',
                  extendRight: mode === 'right' || mode === 'both',
                } : state);
              }}
              style={propertyInputStyle}
            >
              <option value="none">Don't extend</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
              <option value="both">Both</option>
            </select>
          </label>
        ) : null}
      </div>

      {supportsLabelVisibility || advancedStyleSchema?.supportsLabelStyle ? (
        <div style={subSectionStyle}>
          <strong style={subSectionTitleStyle}>Labels</strong>
          <div style={compactOptionsGridStyle}>
            {supportsLabelVisibility ? (
              <label style={checkboxFieldStyle}>
                <input
                  type="checkbox"
                  checked={drawingProperties.showLabel}
                  onChange={(event) => setDrawingProperties((state) => state ? { ...state, showLabel: event.target.checked } : state)}
                />
                <span>Show labels</span>
              </label>
            ) : null}
            {isFibArcsDrawing ? (
              <div style={fibArcLabelSidesStyle}>
                {(['left', 'right', 'top', 'bottom'] as const).map((side) => (
                  <label key={side} style={checkboxFieldStyle}>
                    <input
                      type="checkbox"
                      checked={drawingProperties.fibArcLabelSides[side]}
                      onChange={(event) => setDrawingProperties((state) => state ? {
                        ...state,
                        fibArcLabelSides: { ...state.fibArcLabelSides, [side]: event.target.checked },
                      } : state)}
                    />
                    <span>{side[0].toUpperCase() + side.slice(1)}</span>
                  </label>
                ))}
              </div>
            ) : null}
            {supportsLabelPosition ? (
              <label style={propertyFieldStyle}>
                <span>Position</span>
                <select
                  value={drawingProperties.labelPosition}
                  onChange={(event) => setDrawingProperties((state) => state ? { ...state, labelPosition: event.target.value as DrawingLabelPosition } : state)}
                  style={propertyInputStyle}
                >
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </label>
            ) : null}
            {advancedStyleSchema?.supportsLabelStyle ? (
              <label style={propertyFieldStyle}>
                <span>Font Size</span>
                <input
                  type="number"
                  min="10"
                  max="16"
                  step="1"
                  value={drawingProperties.presentation.labels?.fontSize ?? 11}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isFinite(value)) updateLabelPresentation({ fontSize: Math.max(10, Math.min(16, value)) });
                  }}
                  style={propertyInputStyle}
                />
              </label>
            ) : null}
          </div>
        </div>
      ) : null}

      {selectedTextDrawing ? (
        <div style={subSectionStyle}>
          <strong style={subSectionTitleStyle}>Text</strong>
          <div style={twoColumnFormStyle}>
            <label style={propertyFieldStyle}>
              <span>Text</span>
              <input type="text" value={drawingProperties.text} onChange={(event) => setDrawingProperties((state) => state ? { ...state, text: event.target.value } : state)} style={propertyInputStyle} />
            </label>
            <label style={propertyFieldStyle}>
              <span>Font Size</span>
              <input type="number" min="10" max="28" step="1" value={drawingProperties.fontSize} onChange={(event) => setDrawingProperties((state) => state ? { ...state, fontSize: event.target.value } : state)} style={propertyInputStyle} />
            </label>
            <label style={propertyFieldStyle}>
              <span>Font</span>
              <select value={drawingProperties.fontFamily} onChange={(event) => setDrawingProperties((state) => state ? { ...state, fontFamily: event.target.value as DrawingPropertiesState['fontFamily'] } : state)} style={propertyInputStyle}>
                <option value="sans">Sans-serif</option>
                <option value="serif">Serif</option>
                <option value="mono">Monospace</option>
              </select>
            </label>
            <label style={propertyFieldStyle}>
              <span>Alignment</span>
              <select value={drawingProperties.textAlign} onChange={(event) => setDrawingProperties((state) => state ? { ...state, textAlign: event.target.value as DrawingPropertiesState['textAlign'] } : state)} style={propertyInputStyle}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
            <label style={checkboxFieldStyle}>
              <input type="checkbox" checked={drawingProperties.bold} onChange={(event) => setDrawingProperties((state) => state ? { ...state, bold: event.target.checked } : state)} />
              <span>Bold</span>
            </label>
            <label style={checkboxFieldStyle}>
              <input type="checkbox" checked={drawingProperties.italic} onChange={(event) => setDrawingProperties((state) => state ? { ...state, italic: event.target.checked } : state)} />
              <span>Italic</span>
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );

  const renderCoordinatesTab = () => (
    <div style={tabSectionStyle}>
      {selectedDrawing?.kind === 'hline' ? (
        <label style={propertyFieldStyle}>
          <span>{valueLabel}</span>
          <input type="number" step="0.01" value={drawingProperties.price} onChange={(event) => setDrawingProperties((state) => state ? { ...state, price: event.target.value } : state)} style={propertyInputStyle} />
        </label>
      ) : null}
      {selectedDrawing?.kind === 'vline' ? (
        <label style={propertyFieldStyle}>
          <span>Bar Index</span>
          <input type="number" step="1" value={drawingProperties.barIndex} onChange={(event) => setDrawingProperties((state) => state ? { ...state, barIndex: event.target.value } : state)} style={propertyInputStyle} />
        </label>
      ) : null}
      {selectedPointDrawing && selectedDrawing?.kind !== 'vline' ? (
        <div style={twoColumnFormStyle}>
          <label style={propertyFieldStyle}>
            <span>Bar Index</span>
            <input type="number" step="1" value={drawingProperties.barIndex} onChange={(event) => setDrawingProperties((state) => state ? { ...state, barIndex: event.target.value } : state)} style={propertyInputStyle} />
          </label>
          <label style={propertyFieldStyle}>
            <span>{valueLabel}</span>
            <input type="number" step="0.01" value={drawingProperties.price} onChange={(event) => setDrawingProperties((state) => state ? { ...state, price: event.target.value } : state)} style={propertyInputStyle} />
          </label>
        </div>
      ) : null}
      {selectedAnchoredDrawing ? (
        <div style={coordinateGridStyle}>
          <label style={propertyFieldStyle}>
            <span>Point 1 Bar Index</span>
            <input type="number" step="1" value={drawingProperties.startIndex} onChange={(event) => setDrawingProperties((state) => state ? { ...state, startIndex: event.target.value } : state)} style={propertyInputStyle} />
          </label>
          <label style={propertyFieldStyle}>
            <span>{startValueLabel}</span>
            <input type="number" step="0.01" value={drawingProperties.startPrice} onChange={(event) => setDrawingProperties((state) => state ? { ...state, startPrice: event.target.value } : state)} style={propertyInputStyle} />
          </label>
          <label style={propertyFieldStyle}>
            <span>Point 2 Bar Index</span>
            <input type="number" step="1" value={drawingProperties.endIndex} onChange={(event) => setDrawingProperties((state) => state ? { ...state, endIndex: event.target.value } : state)} style={propertyInputStyle} />
          </label>
          <label style={propertyFieldStyle}>
            <span>{endValueLabel}</span>
            <input type="number" step="0.01" value={drawingProperties.endPrice} onChange={(event) => setDrawingProperties((state) => state ? { ...state, endPrice: event.target.value } : state)} style={propertyInputStyle} />
          </label>
          {selectedDrawing?.kind === 'channel' ? (
            <label style={propertyFieldStyle}>
              <span>Channel Offset</span>
              <input type="number" step="0.01" value={drawingProperties.offset} onChange={(event) => setDrawingProperties((state) => state ? { ...state, offset: event.target.value } : state)} style={propertyInputStyle} />
            </label>
          ) : null}
        </div>
      ) : null}
      {selectedMultiAnchorDrawing && !isPositionDrawing ? (
        <div style={subSectionStyle}>
          <strong style={subSectionTitleStyle}>Anchor points</strong>
          <div style={multiAnchorCoordinateGridStyle}>
            {drawingProperties.anchorCoordinates.map((anchor, index) => (
              <div key={`anchor-${index}`} style={multiAnchorCoordinateRowStyle}>
                <span style={multiAnchorPointLabelStyle}>Point {index + 1}</span>
                <label style={propertyFieldStyle}>
                  <span>Bar Index</span>
                  <input
                    type="number"
                    step="1"
                    value={anchor.barIndex}
                    onChange={(event) => setDrawingProperties((state) => {
                      if (!state) return state;
                      const anchorCoordinates = state.anchorCoordinates.map((item, rowIndex) =>
                        rowIndex === index ? { ...item, barIndex: event.target.value } : item,
                      );
                      return { ...state, anchorCoordinates };
                    })}
                    style={propertyInputStyle}
                  />
                </label>
                <label style={propertyFieldStyle}>
                  <span>{valueLabel}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={anchor.price}
                    onChange={(event) => setDrawingProperties((state) => {
                      if (!state) return state;
                      const anchorCoordinates = state.anchorCoordinates.map((item, rowIndex) =>
                        rowIndex === index ? { ...item, price: event.target.value } : item,
                      );
                      return { ...state, anchorCoordinates };
                    })}
                    style={propertyInputStyle}
                  />
                </label>
              </div>
            ))}
          </div>
          <div style={propertiesHintStyle}>Saving coordinates also refreshes stable timestamp anchors for timeframe remapping.</div>
        </div>
      ) : null}
      {!selectedAnchoredDrawing && !selectedPointDrawing && !selectedMultiAnchorDrawing && selectedDrawing?.kind !== 'hline' && selectedDrawing?.kind !== 'vline' ? (
        <div style={propertiesHintStyle}>This drawing has no editable coordinate fields.</div>
      ) : null}
    </div>
  );

  const renderVisibilityTab = () => (
    <div style={tabSectionStyle}>
      <label style={checkboxFieldStyle}>
        <input type="checkbox" checked={drawingProperties.visibility.visible !== false} onChange={(event) => updateVisibility({ visible: event.target.checked })} />
        <span>Visible</span>
      </label>
      <div style={subSectionStyle}>
        <strong style={subSectionTitleStyle}>Show on timeframes</strong>
        <div style={timeframeGridStyle}>
          {(['D', 'W', 'M', 'Q', 'Y'] as UnifiedSettingsTimeframe[]).map((timeframe) => (
            <label key={timeframe} style={timeframeButtonStyle}>
              <input
                type="checkbox"
                checked={drawingProperties.visibility.timeframes?.[timeframe] !== false}
                onChange={(event) => updateTimeframeVisibility(timeframe, event.target.checked)}
              />
              <span>{timeframe}</span>
            </label>
          ))}
        </div>
      </div>
      <div style={propertiesHintStyle}>Hidden drawings are also excluded from hit-testing on the disabled timeframe.</div>
    </div>
  );

  const renderInputsTab = () => {
    if (!isPositionDrawing) return null;
    return (
      <div style={tabSectionStyle}>
        <div style={coordinateGridStyle}>
          <label style={propertyFieldStyle}>
            <span>Entry Price</span>
            <input type="number" step="0.01" value={drawingProperties.positionEntry} onChange={(event) => setDrawingProperties((state) => state ? { ...state, positionEntry: event.target.value } : state)} style={propertyInputStyle} />
          </label>
          <label style={propertyFieldStyle}>
            <span>Profit / Target Level</span>
            <input type="number" step="0.01" value={drawingProperties.positionTarget} onChange={(event) => setDrawingProperties((state) => state ? { ...state, positionTarget: event.target.value } : state)} style={propertyInputStyle} />
          </label>
          <label style={propertyFieldStyle}>
            <span>Stop Level</span>
            <input type="number" step="0.01" value={drawingProperties.positionStop} onChange={(event) => setDrawingProperties((state) => state ? { ...state, positionStop: event.target.value } : state)} style={propertyInputStyle} />
          </label>
        </div>
        <div style={positionRuleCardStyle}>
          <strong>{selectedDrawing?.kind === 'longPosition' ? 'LONG' : 'SHORT'} orientation</strong>
          <span>{selectedDrawing?.kind === 'longPosition' ? 'Target > Entry > Stop' : 'Stop > Entry > Target'}</span>
          <span style={compactHintStyle}>If a value is entered on the wrong side of Entry, Save mirrors its distance to the correct side.</span>
        </div>
        <div style={propertiesHintStyle}>Chart-planning only. No broker order, account sizing, or execution authority is added here.</div>
      </div>
    );
  };

  return (
    <div ref={backdropRef} style={propertiesBackdropStyle} onMouseDown={onClose}>
      <div
        ref={panelRef}
        style={{ ...propertiesPanelStyle, left: dialogBounds.x, top: dialogBounds.y, width: dialogBounds.width, height: dialogBounds.height }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div style={propertiesHeaderStyle} onPointerDown={beginHeaderDrag}>
          <strong>{propertiesTitle}</strong>
          <button type="button" style={propertiesCloseButtonStyle} onClick={onClose} aria-label="Close drawing properties">×</button>
        </div>
        <div style={propertiesTabsStyle}>
          {settingsTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              style={tab.id === activeTab ? propertiesTabActiveStyle : propertiesTabStyle}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div style={propertiesBodyStyle}>
          {activeTab === 'inputs' ? renderInputsTab() : null}
          {activeTab === 'style' ? renderStyleTab() : null}
          {activeTab === 'coordinates' ? renderCoordinatesTab() : null}
          {activeTab === 'visibility' ? renderVisibilityTab() : null}
        </div>
        <div style={propertiesFooterStyle}>
          {/* Templates controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>Template:</span>
            {isSavingTemplate ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="text"
                  placeholder="Template name..."
                  value={templateNameInput}
                  onChange={(e) => setTemplateNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTemplate();
                    if (e.key === 'Escape') setIsSavingTemplate(false);
                  }}
                  autoFocus
                  style={{
                    height: 24,
                    fontSize: 11,
                    background: 'var(--control-bg)',
                    color: 'var(--text)',
                    border: '1px solid var(--accent)',
                    borderRadius: 3,
                    padding: '0 6px',
                    outline: 'none',
                    width: 130,
                  }}
                />
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={!templateNameInput.trim()}
                  style={{
                    ...actionButtonStyle,
                    height: 24,
                    minWidth: 44,
                    padding: '0 6px',
                    fontSize: 10,
                    borderColor: 'var(--accent)',
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsSavingTemplate(false)}
                  style={{
                    ...actionButtonStyle,
                    height: 24,
                    minWidth: 44,
                    padding: '0 6px',
                    fontSize: 10,
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleApplyTemplate(e.target.value)}
                  style={{
                    height: 24,
                    fontSize: 11,
                    background: 'var(--control-bg)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                    padding: '0 4px',
                    outline: 'none',
                    maxWidth: 150,
                  }}
                >
                  <option value="">(Custom / None)</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.isDefault ? '★' : ''}
                    </option>
                  ))}
                  <option value="__new__">+ Save New Template...</option>
                </select>
                {selectedTemplateId && selectedTemplateId !== '__new__' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleToggleDefaultTemplate(selectedTemplateId)}
                      title={
                        templates.find((t) => t.id === selectedTemplateId)?.isDefault
                          ? 'Default Template'
                          : 'Set as Default Template'
                      }
                      style={{
                        height: 24,
                        padding: '0 6px',
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: 3,
                        color: templates.find((t) => t.id === selectedTemplateId)?.isDefault
                          ? '#f59e0b'
                          : 'var(--text-dim)',
                        fontSize: 10,
                        cursor: 'pointer',
                      }}
                    >
                      {templates.find((t) => t.id === selectedTemplateId)?.isDefault ? '★ Default' : '☆ Make Default'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(selectedTemplateId)}
                      title="Delete this template"
                      style={{
                        height: 24,
                        padding: '0 5px',
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: 3,
                        color: 'var(--text-dim)',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      🗑
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsSavingTemplate(true)}
                    title="Save current visual style as a reusable template"
                    style={{
                      height: 24,
                      padding: '0 6px',
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 3,
                      color: 'var(--text-dim)',
                      fontSize: 10,
                      cursor: 'pointer',
                    }}
                  >
                    Save As...
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              disabled={Boolean(selectedDrawing?.locked)}
              title={selectedDrawing?.locked ? 'Unlock the drawing before deleting it.' : undefined}
              style={{
                ...actionButtonStyle,
                minWidth: 72,
                opacity: selectedDrawing?.locked ? 0.45 : 1,
                cursor: selectedDrawing?.locked ? 'not-allowed' : 'pointer',
              }}
              onClick={() => {
                if (!selectedDrawing?.locked) onDelete(drawingProperties.drawingId);
              }}
            >
              Delete
            </button>
            <button type="button" style={{ ...actionButtonStyle, minWidth: 72 }} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              style={{ ...actionButtonStyle, minWidth: 72, borderColor: 'var(--accent)', color: 'var(--text)' }}
              onClick={onSave}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DialogBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DRAWING_PROPERTIES_BOUNDS_KEY = 'eod.chart.drawing-properties.bounds.v1';

function readDrawingPropertiesDialogBounds(): DialogBounds {
  if (typeof window === 'undefined') return { x: -1, y: -1, width: 720, height: 620 };
  try {
    const raw = window.localStorage.getItem(DRAWING_PROPERTIES_BOUNDS_KEY);
    if (!raw) return { x: -1, y: -1, width: 720, height: 620 };
    const parsed = JSON.parse(raw) as Partial<DialogBounds>;
    return {
      x: Number.isFinite(parsed.x) ? Number(parsed.x) : -1,
      y: Number.isFinite(parsed.y) ? Number(parsed.y) : -1,
      width: Number.isFinite(parsed.width) ? Number(parsed.width) : 720,
      height: Number.isFinite(parsed.height) ? Number(parsed.height) : 620,
    };
  } catch {
    return { x: -1, y: -1, width: 720, height: 620 };
  }
}

function persistDrawingPropertiesDialogBounds(bounds: DialogBounds): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DRAWING_PROPERTIES_BOUNDS_KEY, JSON.stringify(bounds));
  } catch {
    // Non-critical UI preference persistence.
  }
}

function PropertyColorPicker({
  color,
  onChange,
  ariaLabel,
  disabled = false,
  popupAlign = 'left',
}: {
  color: string;
  onChange: (color: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  popupAlign?: 'left' | 'right';
  actionButtonStyle?: CSSProperties;
}) {
  return (
    <ColorToolbox
      value={color}
      onChange={onChange}
      disabled={disabled}
      align={popupAlign}
      ariaLabel={ariaLabel}
    />
  );
}

function toHexColor(value: string): string {
  const trimmed = value.trim();
  const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trimmed);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toLowerCase();
    }
    return `#${hex}`.toLowerCase();
  }

  const rgbMatch = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i.exec(trimmed);
  if (rgbMatch) {
    return rgbToHex({
      red: clampByte(rgbMatch[1]),
      green: clampByte(rgbMatch[2]),
      blue: clampByte(rgbMatch[3]),
    });
  }

  return '#ffffff';
}

function hexToRgb(value: string): { red: number; green: number; blue: number } {
  const hex = toHexColor(value).slice(1);
  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHex({ red, green, blue }: { red: number; green: number; blue: number }): string {
  return `#${toHexByte(red)}${toHexByte(green)}${toHexByte(blue)}`;
}

function toHexByte(value: number): string {
  return clampByte(value).toString(16).padStart(2, '0');
}

function clampByte(value: number | string): number {
  return Math.max(0, Math.min(255, Number(value) || 0));
}

const advancedStyleSectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 10,
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--control-bg)',
};

const advancedStyleHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  color: 'var(--text)',
  fontSize: 12,
};

const advancedCommonColorStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  color: 'var(--text-dim)',
  fontSize: 11,
};

const advancedLineHeaderStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '34px minmax(84px, 1fr) 52px 70px 100px 74px',
  alignItems: 'center',
  gap: 8,
  paddingTop: 4,
  color: 'var(--text-dim)',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
};

const advancedLineRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '34px minmax(84px, 1fr) 52px 70px 100px 74px',
  alignItems: 'center',
  gap: 8,
};

const advancedFillHeaderStyle: CSSProperties = {
  marginTop: 4,
  paddingTop: 8,
  borderTop: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: 11,
  fontWeight: 700,
};

const advancedFillRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '34px minmax(100px, 1fr) 52px 54px 74px',
  alignItems: 'center',
  gap: 8,
};

const advancedFillOpacityLabelStyle: CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 10,
};

const advancedSlotLabelStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 11,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const advancedCompactInputStyle: CSSProperties = {
  height: 28,
  minWidth: 0,
  width: '100%',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  background: 'var(--bg2)',
  color: 'var(--text)',
  padding: '0 6px',
  outline: 'none',
  fontSize: 11,
};

const checkboxFieldStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  color: 'var(--text)',
  fontSize: 12,
};

const propertiesBackdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.15)', // Clear non-blur overlay
  zIndex: 10,
  overflow: 'hidden',
};

const propertiesPanelStyle: CSSProperties = {
  position: 'absolute',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 560,
  minHeight: 420,
  maxWidth: 'calc(100% - 16px)',
  maxHeight: 'calc(100% - 16px)',
  border: '1px solid var(--border2)',
  borderRadius: 10,
  background: 'var(--bg2)',
  boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.6), 0 0 0 1px var(--border2)',
  overflow: 'hidden',
  resize: 'both',
};

const propertiesHeaderStyle: CSSProperties = {
  display: 'flex',
  flexShrink: 0,
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 13,
  cursor: 'grab',
  userSelect: 'none',
  touchAction: 'none',
};

const propertiesCloseButtonStyle: CSSProperties = {
  width: 24,
  height: 24,
  border: '1px solid var(--border2)',
  borderRadius: 5,
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: 13,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const propertiesTabsStyle: CSSProperties = {
  display: 'flex',
  flexShrink: 0,
  alignItems: 'flex-end',
  gap: 2,
  padding: '0 10px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg1)',
};

const propertiesTabStyle: CSSProperties = {
  minWidth: 92,
  height: 34,
  padding: '0 12px',
  border: 'none',
  borderBottom: '2px solid transparent',
  background: 'transparent',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
};

const propertiesTabActiveStyle: CSSProperties = {
  ...propertiesTabStyle,
  borderBottomColor: 'var(--accent)',
  color: 'var(--text)',
  background: 'var(--control-bg)',
};

const propertiesBodyStyle: CSSProperties = {
  display: 'flex',
  flex: 1,
  minHeight: 0,
  flexDirection: 'column',
  gap: 10,
  padding: 12,
  overflow: 'auto',
};

const tabSectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const twoColumnFormStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
};

const compactOptionsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
};

const fibArcLabelSidesStyle: CSSProperties = {
  gridColumn: '1 / -1',
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 8,
};

const compactHintStyle: CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 10,
  fontWeight: 400,
};

const levelColorsBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 26,
  padding: '0 7px',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-dim)',
  background: 'var(--control-bg)',
  fontSize: 10,
};

const subSectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  paddingTop: 8,
  borderTop: '1px solid var(--border)',
};

const subSectionTitleStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 11,
};

const coordinateGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
};

const multiAnchorCoordinateGridStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const multiAnchorCoordinateRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '76px minmax(0, 1fr) minmax(0, 1fr)',
  gap: 10,
  alignItems: 'end',
  padding: 8,
  border: '1px solid var(--border)',
  borderRadius: 5,
  background: 'var(--control-bg)',
};

const multiAnchorPointLabelStyle: CSSProperties = {
  alignSelf: 'center',
  color: 'var(--text)',
  fontSize: 11,
  fontWeight: 700,
};

const timeframeGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(62px, 1fr))',
  gap: 8,
};

const timeframeButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  minHeight: 34,
  border: '1px solid var(--border2)',
  borderRadius: 5,
  background: 'var(--control-bg)',
  color: 'var(--text)',
  fontSize: 11,
};

const positionRuleCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: 10,
  border: '1px solid var(--border2)',
  borderRadius: 6,
  background: 'var(--control-bg)',
  color: 'var(--text)',
  fontSize: 11,
};

const propertyFieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  color: 'var(--text-dim)',
  fontSize: 11,
};

const propertyInputStyle: CSSProperties = {
  height: 30,
  border: '1px solid var(--border2)',
  borderRadius: 4,
  background: 'var(--control-bg)',
  color: 'var(--text)',
  padding: '0 8px',
  outline: 'none',
};

const colorPickerWrapStyle: CSSProperties = {
  position: 'relative',
  width: 'fit-content',
};

const propertiesHintStyle: CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
};

const propertiesFooterStyle: CSSProperties = {
  display: 'flex',
  flexShrink: 0,
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  padding: '10px 12px',
  borderTop: '1px solid var(--border)',
  background: 'var(--bg2)',
};

