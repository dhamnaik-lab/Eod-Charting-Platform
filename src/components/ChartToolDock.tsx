import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DrawingTool } from '@/engine/types';
import { useChartStore } from '@/store/chartStore';
import { useUiStore } from '@/store/uiStore';
import { isScannerOverlayDrawingId } from '@/components/ChartCanvas';
import {
  DIRECT_DRAWING_TOOL_IDS,
  DRAWING_TOOL_GROUPS,
  createDefaultDrawingToolGroupSelections,
  findDrawingToolGroup,
  sanitizeDrawingToolGroupSelections,
  type DrawingToolGroupId,
  type DrawingToolGroupSelections,
} from '@/components/DrawingToolGroups';

// ─── SVG icon helpers ─────────────────────────────────────────────────────────
// Used for characters that render inconsistently across font stacks on Windows
// (box-drawing chars, rare Unicode blocks). All others stay as text.

const ICO_SZ = 13;

/** Thin wrapper for 13×13 stroke-based SVG icons. */
function Ico({ children }: { children: ReactNode }) {
  return (
    <svg
      width={ICO_SZ}
      height={ICO_SZ}
      viewBox={`0 0 ${ICO_SZ} ${ICO_SZ}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

// ─ Horizontal Line  (was U+2500 BOX DRAWINGS LIGHT HORIZONTAL)
const IcoHLine = () => <Ico><line x1="1" y1="6.5" x2="12" y2="6.5" /></Ico>;

// │ Vertical Line  (was U+2502 BOX DRAWINGS LIGHT VERTICAL)
const IcoVLine = () => <Ico><line x1="6.5" y1="1" x2="6.5" y2="12" /></Ico>;

// ▭ Rectangle  (was U+25AD WHITE RECTANGLE)
const IcoRect = () => <Ico><rect x="1.5" y="3.5" width="10" height="6" rx="0.5" /></Ico>;

// ⇌ Parallel Channel  (was U+21CC)
const IcoChannel = () => (
  <Ico>
    <line x1="1" y1="4" x2="12" y2="4" />
    <line x1="1" y1="9" x2="12" y2="9" />
  </Ico>
);

// ⌯ Fibonacci Fan  (was U+232F — very rare; fan rays from left anchor)
const IcoFibFan = () => (
  <Ico>
    <line x1="1" y1="12" x2="12" y2="1" />
    <line x1="1" y1="12" x2="12" y2="5" />
    <line x1="1" y1="12" x2="12" y2="9" />
    <line x1="1" y1="12" x2="12" y2="12" />
  </Ico>
);

// ✦ Gann Fan  (was U+2726 — not in Segoe UI regular; fan grid from anchor)
const IcoGann = () => (
  <Ico>
    <line x1="1" y1="12" x2="12" y2="1" />
    <line x1="1" y1="12" x2="12" y2="4" />
    <line x1="1" y1="12" x2="12" y2="7" />
    <line x1="1" y1="12" x2="12" y2="10" />
    <line x1="1" y1="12" x2="7"  y2="12" />
  </Ico>
);

// ⚙ Drawing Properties  (was U+2699 — renders as emoji on some systems)
const IcoSettings = () => (
  <Ico>
    <circle cx="6.5" cy="6.5" r="2" />
    <circle cx="6.5" cy="1.5" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="6.5" cy="11.5" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="1.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="11.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
  </Ico>
);

// ⌫ Delete drawing  (was U+232B ERASE TO THE LEFT — Miscellaneous Technical)
const IcoBackspace = () => (
  <Ico>
    <path d="M5 2h6a1 1 0 011 1v7a1 1 0 01-1 1H5L1 6.5z" />
    <line x1="7.5" y1="4.5" x2="10.5" y2="7.5" />
    <line x1="10.5" y1="4.5" x2="7.5" y2="7.5" />
  </Ico>
);

// ⊡ Reset pane heights  (was U+22A1 SQUARED DOT — not in common fonts)
const IcoResetPanes = () => (
  <Ico>
    <line x1="2" y1="3.5" x2="11" y2="3.5" />
    <line x1="2" y1="6.5" x2="11" y2="6.5" />
    <line x1="2" y1="9.5" x2="11" y2="9.5" />
  </Ico>
);

// ─── Tool metadata ────────────────────────────────────────────────────────────

export interface DrawingToolMeta {
  id: DrawingTool;
  icon: ReactNode;   // ReactNode so SVG components can be used alongside text chars
  title: string;
  hint: string;
}

export const PRIMARY_DRAWING_TOOLS: DrawingToolMeta[] = [
  { id: 'cursor',    icon: '↖',          title: 'Cursor / Select',       hint: 'Drag to pan. Scroll to zoom. Shift+scroll to pan.' },
  { id: 'crosshair', icon: '+',          title: 'Crosshair',             hint: 'Inspect bars with the crosshair without selecting a drawing tool.' },
  { id: 'hline',     icon: <IcoHLine />, title: 'Horizontal Line',        hint: 'Click once to place a price level. Esc cancels.' },
  { id: 'vline',     icon: <IcoVLine />, title: 'Vertical Line',          hint: 'Click once to mark a date/bar. Esc cancels.' },
  { id: 'trendline', icon: '↗',          title: 'Trend Line',             hint: 'Click two points to draw a trend line. Esc cancels.' },
];

export const ADVANCED_DRAWING_TOOLS: DrawingToolMeta[] = [
  { id: 'extendedLine',  icon: '↔',            title: 'Extended Line',          hint: 'Click two points to draw a line extended in both directions.' },
  { id: 'horizontalRay', icon: '⇢',            title: 'Horizontal Ray',         hint: 'Click once to extend a horizontal level to the right.' },
  { id: 'crossLine',     icon: '⊕',            title: 'Cross Line',             hint: 'Click once to place a persistent horizontal and vertical cross.' },
  { id: 'infoLine',      icon: 'i',            title: 'Info Line',              hint: 'Click two points to show price, percent, bar, and date-span information.' },
  { id: 'trendAngle',    icon: '∠',            title: 'Trend Angle',            hint: 'Click two points to show slope per bar and the current visual angle.' },
  { id: 'priceRange',    icon: '↕',            title: 'Price Range',            hint: 'Click two price anchors to highlight and measure a price band.' },
  { id: 'dateRange',       icon: 'D',     title: 'Date Range',             hint: 'Click two bars to highlight and measure their exact time span.' },
  { id: 'regressionTrend', icon: 'LR',    title: 'Regression Trend',       hint: 'Click two bars to calculate a close-price linear regression channel with ±2σ bands.' },
  { id: 'fibTimeZone',     icon: 'Ft',    title: 'Fib Time Zone',          hint: 'Click two bars to project Fibonacci time intervals.' },
  { id: 'fibCircles',      icon: '◎',     title: 'Fib Circles',            hint: 'Click a center and radius point to draw Fibonacci concentric circles.' },
  { id: 'fibSpiral',       icon: 'FS',    title: 'Fib Spiral',             hint: 'Click the spiral center, then a radius/phase point.' },
  { id: 'fibArcs',         icon: '◔',     title: 'Fib Speed Resistance Arcs',               hint: 'Click pivot and extent points to draw Fibonacci speed/resistance arcs.' },
  { id: 'gannBox',         icon: '▦',     title: 'Gann Box',               hint: 'Click two corners to draw a Gann price/time grid.' },
  { id: 'circle',          icon: '○',     title: 'Circle',                 hint: 'Click a center and edge point to draw a circle.' },
  { id: 'ellipse',         icon: '⬭',     title: 'Ellipse',                hint: 'Click two opposite bounding corners to draw an ellipse.' },
  { id: 'forecast',        icon: 'F',     title: 'Forecast',               hint: 'Click start and target points to draw a manual price/time projection.' },
  { id: 'arrowMarker',     icon: '△',     title: 'Arrow Marker',           hint: 'Click once to place an outlined arrow marker.' },
  { id: 'arrowUp',         icon: '▲',     title: 'Arrow Up',               hint: 'Click once to place an upward arrow marker.' },
  { id: 'arrowDown',       icon: '▼',     title: 'Arrow Down',             hint: 'Click once to place a downward arrow marker.' },
  { id: 'flatChannel',     icon: '⌔',     title: 'Flat Top / Bottom',      hint: 'Click three points: trend start, trend end, then flat level.' },
  { id: 'disjointChannel', icon: '≋',     title: 'Disjoint Channel',        hint: 'Click four points to define two independent channel lines.' },
  { id: 'triangle',        icon: '△',     title: 'Triangle',                hint: 'Click three vertices to draw a triangle.' },
  { id: 'rotatedRect',     icon: '◇',     title: 'Rotated Rectangle',       hint: 'Click an edge start, edge end, then a third point to set height.' },
  { id: 'arc',             icon: '⌒',     title: 'Arc',                     hint: 'Click center, radius point, then endpoint to draw an arc.' },
  { id: 'andrewsPitchfork',       icon: 'PF', title: "Andrews' Pitchfork",       hint: 'Click pivot and two swing points.' },
  { id: 'schiffPitchfork',        icon: 'SF', title: 'Schiff Pitchfork',          hint: 'Click pivot and two swing points.' },
  { id: 'modifiedSchiffPitchfork', icon: 'MS', title: 'Modified Schiff Pitchfork', hint: 'Click pivot and two swing points.' },
  { id: 'insidePitchfork',        icon: 'IF', title: 'Inside Pitchfork',          hint: 'Click pivot and two swing points.' },
  { id: 'trendFibExtension',      icon: 'F3', title: 'Trend-Based Fib Extension', hint: 'Click A, B, then C to project Fibonacci extension levels.' },
  { id: 'fibChannel',             icon: 'FC', title: 'Fibonacci Channel',         hint: 'Click baseline start, baseline end, then channel width point.' },
  { id: 'fibTimeExtension',       icon: 'FT', title: 'Trend-Based Fib Time',      hint: 'Click trend start, trend end, then projection origin.' },
  { id: 'fibWedge',               icon: 'FW', title: 'Fib Wedge',           hint: 'Click apex and two boundary points.' },
  { id: 'pitchfan',               icon: 'PF', title: 'Pitchfan',                  hint: 'Click pivot and two swing points.' },
  { id: 'longPosition',           icon: 'LP', title: 'Long Position',              hint: 'Click entry, target, then stop to plan a long risk/reward setup.' },
  { id: 'shortPosition',          icon: 'SP', title: 'Short Position',             hint: 'Click entry, target, then stop to plan a short risk/reward setup.' },
  { id: 'projection',             icon: 'PR', title: 'Projection',                 hint: 'Click A, B, then C to repeat the measured A-B move from C.' },
  { id: 'measure',         icon: '⍈',     title: 'Measure',                hint: 'Click two points to measure price and time differences.' },
  { id: 'ray',          icon: '→',            title: 'Ray',                    hint: 'Click two points to extend a ray forward. Esc cancels.' },
  { id: 'arrow',        icon: '↑',            title: 'Arrow',                  hint: 'Click two points to draw an arrow. Esc cancels.' },
  { id: 'rect',         icon: <IcoRect />,    title: 'Rectangle / Box',        hint: 'Click two corners to draw a box. Esc cancels.' },
  { id: 'text',         icon: 'T',            title: 'Text Label',             hint: 'Click to place a text marker. Edit from Properties.' },
  { id: 'channel',      icon: <IcoChannel />, title: 'Parallel Channel',       hint: 'Click start, end, then offset point. Esc cancels.' },
  { id: 'fib',          icon: 'φ',            title: 'Fibonacci Retracement',  hint: 'Click two points to project fib levels.' },
  { id: 'fibExtension', icon: 'ƒ',            title: 'Fib Projection (Legacy)',    hint: 'Legacy two-point EOD Fib projection. New work should use Fibonacci Retracement or Trend-Based Fib Extension.' },
  { id: 'fibFan',       icon: <IcoFibFan />,  title: 'Fibonacci Fan',          hint: 'Click two points to project Fibonacci fan rays.' },
  { id: 'gann',         icon: <IcoGann />,    title: 'Gann Fan',               hint: 'Click two points to project Gann fan lines. Esc cancels.' },
];

export const DRAWING_TOOL_META_BY_ID = new Map<DrawingTool, DrawingToolMeta>(
  [...PRIMARY_DRAWING_TOOLS, ...ADVANCED_DRAWING_TOOLS].map((tool) => [tool.id, tool]),
);

export function getDrawingToolMeta(toolId: DrawingTool): DrawingToolMeta {
  const tool = DRAWING_TOOL_META_BY_ID.get(toolId);
  if (!tool) {
    throw new Error(`Missing drawing-tool metadata for ${toolId}`);
  }
  return tool;
}

const DOCK_COLLAPSED_KEY = 'eod-chart.chartToolDock.collapsed.v1';
const DOCK_GROUP_LAST_USED_KEY = 'eod-chart.chartToolDock.groupLastUsed.v1';

function loadDrawingToolGroupSelections(): DrawingToolGroupSelections {
  if (typeof window === 'undefined') return createDefaultDrawingToolGroupSelections();
  const raw = window.localStorage.getItem(DOCK_GROUP_LAST_USED_KEY);
  if (!raw) return createDefaultDrawingToolGroupSelections();
  try {
    return sanitizeDrawingToolGroupSelections(JSON.parse(raw));
  } catch {
    return createDefaultDrawingToolGroupSelections();
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChartToolDock() {
  const activeDrawingTool  = useUiStore((state) => state.activeDrawingTool);
  const chartTabs          = useChartStore((state) => state.chartTabs);
  const activeChartTabId   = useChartStore((state) => state.activeChartTabId);
  const setDrawingTool     = useUiStore((state) => state.setDrawingTool);
  const magnetEnabled      = useUiStore((state) => state.magnetEnabled);
  const toggleMagnet       = useUiStore((state) => state.toggleMagnet);
  const selectDrawing      = useChartStore((state) => state.selectDrawing);
  const openDrawingProperties   = useUiStore((state) => state.openDrawingProperties);
  const toggleDrawingLock       = useChartStore((state) => state.toggleDrawingLock);
  const deleteSelectedDrawing   = useChartStore((state) => state.deleteSelectedDrawing);
  const clearDrawings           = useChartStore((state) => state.clearDrawings);
  const removeLastDrawing       = useChartStore((state) => state.removeLastDrawing);
  const addIndicatorCatalog     = useChartStore((state) => state.addIndicatorCatalog);
  const removeIndicator         = useChartStore((state) => state.removeIndicator);
  const updateIndicator         = useChartStore((state) => state.updateIndicator);
  const resetIndicatorPaneHeights = useChartStore((state) => state.resetIndicatorPaneHeights);
  const clearScannerChartOverlay = useUiStore((state) => state.clearScannerChartOverlay);
  const favoriteDrawingTools = useUiStore((state) => state.favoriteDrawingTools);
  const favoriteToolbarVisible = useUiStore((state) => state.favoriteToolbarVisible);
  const toggleFavoriteDrawingTool = useUiStore((state) => state.toggleFavoriteDrawingTool);
  const toggleFavoriteToolbar = useUiStore((state) => state.toggleFavoriteToolbar);

  const dockRef = useRef<HTMLElement | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(DOCK_COLLAPSED_KEY) === '1';
  });
  const [openGroupId, setOpenGroupId] = useState<DrawingToolGroupId | null>(null);
  const [lastUsedByGroup, setLastUsedByGroup] = useState<DrawingToolGroupSelections>(
    loadDrawingToolGroupSelections,
  );

  const activeTab    = chartTabs.find((tab) => tab.id === activeChartTabId) ?? chartTabs[0] ?? null;
  const selectedDrawingId = activeTab?.selectedDrawingId ?? null;
  const hasScannerOverlaySelection = isScannerOverlayDrawingId(selectedDrawingId);
  const hasSelection = Boolean(selectedDrawingId);
  const selectedDrawing = activeTab?.drawings.find((d) => d.id === activeTab.selectedDrawingId) ?? null;
  const isLocked     = selectedDrawing?.locked ?? false;
  const canEditSelectedDrawing = hasSelection && !hasScannerOverlaySelection;


  const handleDeleteSelection = () => {
    if (hasScannerOverlaySelection) {
      clearScannerChartOverlay();
      selectDrawing(null);
      return;
    }
    deleteSelectedDrawing();
  };

  const handleClearDrawings = () => {
    clearDrawings();
    clearScannerChartOverlay();
    selectDrawing(null);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DOCK_COLLAPSED_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DOCK_GROUP_LAST_USED_KEY, JSON.stringify(lastUsedByGroup));
  }, [lastUsedByGroup]);

  useEffect(() => {
    if (activeDrawingTool !== 'cursor' || hasSelection) {
      setCollapsed(false);
    }
  }, [activeDrawingTool, hasSelection]);

  useEffect(() => {
    const group = findDrawingToolGroup(activeDrawingTool);
    if (!group) return;
    setLastUsedByGroup((current) =>
      current[group.id] === activeDrawingTool
        ? current
        : { ...current, [group.id]: activeDrawingTool },
    );
  }, [activeDrawingTool]);

  useEffect(() => {
    if (!openGroupId || typeof document === 'undefined') return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!dockRef.current?.contains(event.target as Node)) {
        setOpenGroupId(null);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [openGroupId]);

  const handleToolClick = (toolId: DrawingTool) => {
    setOpenGroupId(null);
    if (activeDrawingTool === toolId) {
      setDrawingTool('cursor');
      selectDrawing(null);
      return;
    }
    setDrawingTool(toolId);
    selectDrawing(null);
  };

  const handleGroupToolSelect = (groupId: DrawingToolGroupId, toolId: DrawingTool) => {
    setLastUsedByGroup((current) => ({ ...current, [groupId]: toolId }));
    handleToolClick(toolId);
  };

  if (collapsed) {
    return (
      <aside ref={dockRef} style={collapsedDockStyle}>
        <button
          type="button"
          style={collapseToggleStyle}
          onClick={() => setCollapsed(false)}
          title="Expand tool dock"
        >
          {'›'}
        </button>
      </aside>
    );
  }

  return (
    <aside ref={dockRef} style={expandedDockStyle}>
      {/* Collapse toggle */}
      <button
        type="button"
        style={collapseToggleStyle}
        onClick={() => {
          setOpenGroupId(null);
          setCollapsed(true);
        }}
        title="Collapse tool dock"
      >
        {'‹'}
      </button>

      <div style={sectionStyle}>
        {DIRECT_DRAWING_TOOL_IDS.map((toolId) => {
          const tool = getDrawingToolMeta(toolId);
          return (
            <ToolButton
              key={tool.id}
              icon={tool.icon}
              title={tool.title}
              active={activeDrawingTool === tool.id}
              onClick={() => handleToolClick(tool.id)}
            />
          );
        })}
      </div>

      <div style={dividerStyle} />

      <div style={sectionStyle}>
        {DRAWING_TOOL_GROUPS.map((group) => {
          const groupActive = group.toolIds.includes(activeDrawingTool);
          const displayToolId = groupActive ? activeDrawingTool : lastUsedByGroup[group.id];
          const displayTool = getDrawingToolMeta(displayToolId);
          const groupOpen = openGroupId === group.id;
          return (
            <div key={group.id} style={groupToolsAnchorStyle}>
              <GroupToolButton
                icon={displayTool.icon}
                title={displayTool.title}
                groupTitle={group.title}
                active={groupActive}
                open={groupOpen}
                onActivate={() => handleToolClick(displayTool.id)}
                onToggleMenu={() => setOpenGroupId((current) => (current === group.id ? null : group.id))}
              />

              {groupOpen && (
                <div style={groupToolsFlyoutStyle} role="menu" aria-label={`${group.title} drawing tools`}>
                  <div style={groupToolsFlyoutHeaderStyle}>{group.title}</div>
                  {group.toolIds.map((toolId) => {
                    const tool = getDrawingToolMeta(toolId);
                    return (
                      <FlyoutToolButton
                        key={tool.id}
                        icon={tool.icon}
                        title={tool.title}
                        active={activeDrawingTool === tool.id}
                        isFavorite={favoriteDrawingTools.includes(tool.id)}
                        onClick={() => handleGroupToolSelect(group.id, tool.id)}
                        onToggleFavorite={() => toggleFavoriteDrawingTool(tool.id)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={dividerStyle} />

      {/* Selection actions */}
      <div style={sectionStyle}>
        <ToolButton
          icon={<IcoSettings />}
          title="Drawing Properties"
          active={false}
          disabled={!canEditSelectedDrawing}
          onClick={() => openDrawingProperties(selectedDrawing?.id ?? null)}
        />
        <ToolButton
          icon={isLocked ? '🔒' : '🔓'}
          title={isLocked ? 'Unlock selected drawing' : 'Lock selected drawing'}
          active={isLocked}
          disabled={!canEditSelectedDrawing}
          onClick={() => toggleDrawingLock()}
        />
        <ToolButton
          icon="✕"
          title="Deselect drawing"
          active={false}
          disabled={!hasSelection}
          onClick={() => selectDrawing(null)}
        />
        <ToolButton
          icon={<IcoBackspace />}
          title={
            hasScannerOverlaySelection
              ? 'Remove scanner overlay'
              : isLocked
                ? 'Unlock the drawing before deleting it'
                : 'Delete selected drawing'
          }
          active={false}
          disabled={!hasSelection || (isLocked && !hasScannerOverlaySelection)}
          onClick={handleDeleteSelection}
          danger
        />
      </div>

      <div style={dividerStyle} />

      {/* Utility actions */}
      <div style={sectionStyle}>
        <ToolButton
          icon="★"
          title={favoriteToolbarVisible ? 'Hide Favorites Toolbar' : 'Show Favorites Toolbar'}
          active={favoriteToolbarVisible}
          onClick={() => toggleFavoriteToolbar()}
        />
        <ToolButton
          icon="↩"
          title="Undo last drawing"
          active={false}
          onClick={() => removeLastDrawing()}
        />
        <ToolButton
          icon={<BarMagnetIcon active={magnetEnabled} />}
          title={magnetEnabled ? 'Magnet: ON - snaps drawing points to candle high/low' : 'Magnet: OFF'}
          active={magnetEnabled}
          onClick={() => toggleMagnet()}
        />
        <ToolButton
          icon="⊗"
          title="Clear all drawings"
          active={false}
          onClick={handleClearDrawings}
          danger
        />
        <ToolButton
          icon={<IcoResetPanes />}
          title="Reset indicator pane heights"
          active={false}
          onClick={() => resetIndicatorPaneHeights()}
        />
      </div>
    </aside>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ToolButtonProps {
  icon: ReactNode;
  title: string;
  active: boolean;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}

function ToolButton({ icon, title, active, disabled = false, danger = false, onClick }: ToolButtonProps) {
  return (
    <button
      type="button"
      style={toolButtonStyle(active, disabled, danger)}
      onClick={disabled ? undefined : onClick}
      title={title}
      aria-label={title.split('\n')[0]}
      aria-pressed={active}
      disabled={disabled}
    >
      {icon}
    </button>
  );
}

interface GroupToolButtonProps {
  icon: ReactNode;
  title: string;
  groupTitle: string;
  active: boolean;
  open: boolean;
  onActivate: () => void;
  onToggleMenu: () => void;
}

function GroupToolButton({
  icon,
  title,
  groupTitle,
  active,
  open,
  onActivate,
  onToggleMenu,
}: GroupToolButtonProps) {
  return (
    <div style={groupToolButtonShellStyle}>
      <button
        type="button"
        style={groupMainButtonStyle(active)}
        onClick={onActivate}
        title={title}
        aria-label={title}
        aria-pressed={active}
      >
        {icon}
      </button>
      <button
        type="button"
        style={groupMenuButtonStyle(open, active)}
        onClick={onToggleMenu}
        title={`${groupTitle} tools`}
        aria-label={`Choose ${groupTitle} tool`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {'‹'}
      </button>
    </div>
  );
}

interface FlyoutToolButtonProps {
  icon: ReactNode;
  title: string;
  active: boolean;
  isFavorite: boolean;
  onClick: () => void;
  onToggleFavorite: () => void;
}

function FlyoutToolButton({
  icon,
  title,
  active,
  isFavorite,
  onClick,
  onToggleFavorite,
}: FlyoutToolButtonProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%', position: 'relative' }}>
      <button
        type="button"
        role="menuitemradio"
        aria-checked={active}
        style={{ ...flyoutToolButtonStyle(active), flex: 1, paddingRight: 24 }}
        onClick={onClick}
        title={title}
      >
        <span style={flyoutToolIconStyle}>{icon}</span>
        <span style={flyoutToolTitleStyle}>{title}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
        style={{
          position: 'absolute',
          right: 4,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 2,
          fontSize: 12,
          color: isFavorite ? '#f59e0b' : 'var(--text-dim)',
          opacity: isFavorite ? 1 : 0.4,
          lineHeight: 1,
        }}
      >
        {isFavorite ? '★' : '☆'}
      </button>
    </div>
  );
}

function BarMagnetIcon({ active }: { active: boolean }) {
  return (
    <span style={barMagnetIconShellStyle(active)}>
      <span style={barMagnetTopStyle}>S</span>
      <span style={barMagnetBottomStyle}>N</span>
    </span>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const BASE_DOCK: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  borderLeft: '1px solid var(--border)',
  background: 'var(--bg2)',
  flex: '0 0 auto',
  overflow: 'visible',
};

const collapsedDockStyle: React.CSSProperties = {
  ...BASE_DOCK,
  width: 20,
  minWidth: 20,
  padding: '5px 2px',
  gap: 2,
};

const expandedDockStyle: React.CSSProperties = {
  ...BASE_DOCK,
  width: 42,
  minWidth: 42,
  padding: '4px 3px',
  gap: 2,
};

const collapseToggleStyle: React.CSSProperties = {
  width: 18,
  height: 16,
  border: '1px solid var(--border2)',
  background: 'var(--bg3)',
  color: 'var(--text-dim)',
  borderRadius: 3,
  cursor: 'pointer',
  fontSize: 11,
  lineHeight: '14px',
  padding: 0,
  marginBottom: 2,
  flexShrink: 0,
};

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  width: '100%',
};

const dividerStyle: React.CSSProperties = {
  width: '80%',
  height: 1,
  background: 'var(--border2)',
  margin: '3px 0',
  flexShrink: 0,
};

const groupToolsAnchorStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  flexShrink: 0,
};

const groupToolButtonShellStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 9px',
  width: '100%',
  minHeight: 26,
};

function groupMainButtonStyle(active: boolean): React.CSSProperties {
  const base = toolButtonStyle(active);
  return {
    ...base,
    minHeight: 26,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderRightWidth: 0,
  };
}

function groupMenuButtonStyle(open: boolean, active: boolean): React.CSSProperties {
  return {
    minWidth: 9,
    width: 9,
    minHeight: 26,
    border: `1px solid ${open || active ? 'var(--accent)' : 'var(--border)'}`,
    background: open ? 'var(--accent-soft)' : active ? 'var(--blue-dim)' : 'var(--control-bg)',
    color: open || active ? 'var(--accent)' : 'var(--text-dim)',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    cursor: 'pointer',
    padding: 0,
    fontSize: 9,
    fontWeight: 700,
    lineHeight: '24px',
  };
}

const groupToolsFlyoutStyle: React.CSSProperties = {
  position: 'absolute',
  top: -4,
  right: 'calc(100% + 6px)',
  zIndex: 40,
  width: 218,
  maxHeight: 'min(430px, calc(100vh - 80px))',
  overflowY: 'auto',
  padding: 6,
  border: '1px solid var(--border2)',
  borderRadius: 'var(--panel-radius)',
  background: 'var(--bg2)',
  boxShadow: 'var(--shadow-lg)',
};

const groupToolsFlyoutHeaderStyle: React.CSSProperties = {
  padding: '3px 6px 6px',
  color: 'var(--text-dim)',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.02em',
  borderBottom: '1px solid var(--border2)',
  marginBottom: 4,
};

function flyoutToolButtonStyle(active: boolean): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: '28px 1fr',
    alignItems: 'center',
    width: '100%',
    minHeight: 28,
    border: `1px solid ${active ? 'var(--accent)' : 'transparent'}`,
    background: active ? 'var(--blue-dim)' : 'transparent',
    color: 'var(--text)',
    borderRadius: 4,
    cursor: 'pointer',
    padding: '2px 5px 2px 2px',
    textAlign: 'left',
  };
}

const flyoutToolIconStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 24,
  fontSize: 12,
  color: 'var(--text)',
};

const flyoutToolTitleStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 11,
  lineHeight: '18px',
};

function toolButtonStyle(active: boolean, disabled = false, danger = false): React.CSSProperties {
  let bg          = disabled ? 'transparent' : 'var(--control-bg)';
  let borderColor = disabled ? 'transparent' : 'var(--border)';
  let color       = 'var(--text)';

  if (active) {
    bg          = 'var(--blue-dim)';
    borderColor = 'var(--accent)';
    color       = 'var(--text)';
  } else if (disabled) {
    color = 'var(--text-dim)';
  } else if (danger) {
    color = 'var(--red)';
  }

  return {
    width: '100%',
    minHeight: 26,
    border: `1px solid ${borderColor}`,
    background: bg,
    color,
    borderRadius: 4,
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 13,
    lineHeight: '24px',
    opacity: disabled ? 0.4 : 1,
    padding: '0 2px',
    textAlign: 'center',
    transition: 'background 0.1s, color 0.1s',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

const barMagnetIconShellStyle = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  flexDirection: 'column',
  width: 13,
  height: 20,
  borderRadius: 2,
  overflow: 'hidden',
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border2)'}`,
  boxShadow: active ? '0 0 0 1px var(--accent-soft)' : 'none',
  opacity: active ? 1 : 0.72,
});

const barMagnetPoleBaseStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  fontSize: 7.5,
  fontWeight: 800,
  lineHeight: 1,
  color: 'var(--bg)',
};

const barMagnetTopStyle: React.CSSProperties = {
  ...barMagnetPoleBaseStyle,
  background: 'var(--blue)',
};

const barMagnetBottomStyle: React.CSSProperties = {
  ...barMagnetPoleBaseStyle,
  background: 'var(--red)',
};

function IcoCandlestickPattern() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 1v3M5 11v4M3 4h4v7H3V4z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M11 2v4M11 12v3M9 6h4v6H9V6z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
