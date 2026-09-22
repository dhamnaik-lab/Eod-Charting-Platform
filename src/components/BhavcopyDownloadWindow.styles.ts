import type { CSSProperties } from 'react';

export const overlayStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'var(--overlay-bg)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

export const windowStyle: CSSProperties = {
  width: 900,
  height: '80vh',
  maxHeight: 700,
  backgroundColor: 'var(--bg2)',
  borderRadius: 8,
  border: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: 'var(--shadow-lg)',
};

export const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid var(--border)',
  backgroundColor: 'var(--bg3)',
};

export const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--text)',
};

export const headerRightStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

export const savedBadgeStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--green)',
  backgroundColor: 'var(--accent-faint)',
  padding: '2px 8px',
  borderRadius: 4,
};

export const closeButtonStyle: CSSProperties = {
  width: 28,
  height: 28,
  border: 'none',
  borderRadius: 4,
  backgroundColor: 'transparent',
  color: 'var(--text-dim)',
  fontSize: 20,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const contentStyle: CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
  minHeight: 0,
};

export const windowBodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  overflow: 'hidden',
};

export const tabRowStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  padding: '10px 16px 0',
  borderBottom: '1px solid var(--border)',
  backgroundColor: 'var(--bg3)',
};

export function tabButtonStyle(active: boolean): CSSProperties {
  return {
    minWidth: 0,
    height: 30,
    padding: '0 12px',
    border: '1px solid var(--border2)',
    borderBottomColor: active ? 'var(--accent)' : 'var(--border2)',
    borderRadius: '4px 4px 0 0',
    backgroundColor: active ? 'var(--control-bg-hover)' : 'var(--control-bg)',
    color: active ? 'var(--text)' : 'var(--text-dim)',
    fontSize: 12,
    cursor: 'pointer',
  };
}

export const marketHolidayPageStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  padding: 16,
};

export const marketHolidayHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 14,
};

export const marketHolidayTableStyle: CSSProperties = {
  border: '1px solid var(--border2)',
  borderRadius: 4,
  overflow: 'hidden',
  fontSize: 12,
};

export const excludeSeriesWindowBodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  height: '100%',
  minHeight: 0,
  padding: 16,
  overflow: 'hidden',
};

export const excludeSeriesWindowListStyle: CSSProperties = {
  flex: 1,
  minHeight: 80,
  overflowY: 'auto',
  border: '1px solid var(--border2)',
  borderRadius: 4,
};

export const leftPanelStyle: CSSProperties = {
  width: 300,
  borderRight: '1px solid var(--border)',
  padding: 16,
  overflow: 'auto',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

export const rightPanelStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  padding: 12,
  minHeight: 0,
  minWidth: 0,
};

export const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

export const sectionTitleStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

export const checkboxGroupStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

export const checkboxLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  color: 'var(--text)',
  cursor: 'pointer',
};

export const checkboxStyle: CSSProperties = {
  width: 16,
  height: 16,
  cursor: 'pointer',
};

export const modeSelectRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

export const modeSelectStyle: CSSProperties = {
  width: '100%',
  backgroundColor: 'var(--control-bg)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '8px 10px',
  fontSize: 13,
};

export const modeHintStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--text-dim)',
};

export const dateRangeStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
};

export const modeRangeInfoStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 6,
  backgroundColor: 'var(--control-bg)',
  color: 'var(--text-dim)',
  padding: '10px 12px',
  fontSize: 12,
  lineHeight: 1.5,
};

export const inputGroupStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  flex: 1,
};

export const labelStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--text-dim)',
};

export const dateInputStyle: CSSProperties = {
  height: 32,
  padding: '0 8px',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  backgroundColor: 'var(--control-bg)',
  color: 'var(--text)',
  fontSize: 12,
};

export const workersStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

export const workersInputStyle: CSSProperties = {
  width: 60,
  height: 32,
  padding: '0 8px',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  backgroundColor: 'var(--control-bg)',
  color: 'var(--text)',
  fontSize: 14,
  textAlign: 'center',
};

export const workersHintStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--text-dim)',
};

export const excludedListStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  maxHeight: 80,
  overflow: 'auto',
};

export const excludedChipStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 6px',
  backgroundColor: 'var(--bg3)',
  borderRadius: 4,
  fontSize: 11,
  color: 'var(--text)',
};

export const removeChipButtonStyle: CSSProperties = {
  width: 14,
  height: 14,
  border: 'none',
  borderRadius: 2,
  backgroundColor: 'transparent',
  color: 'var(--text-dim)',
  fontSize: 12,
  cursor: 'pointer',
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const addSeriesStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  marginTop: 4,
};

export const addSeriesInputStyle: CSSProperties = {
  flex: 1,
  height: 28,
  padding: '0 8px',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  backgroundColor: 'var(--control-bg)',
  color: 'var(--text)',
  fontSize: 12,
};

export const addButtonStyle: CSSProperties = {
  height: 28,
  padding: '0 10px',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  backgroundColor: 'var(--bg3)',
  color: 'var(--text)',
  fontSize: 11,
  cursor: 'pointer',
};

export const logHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 8,
  gap: 8,
  flexWrap: 'wrap',
};

export const logCountStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--text-dim)',
};

export const logAreaStyle: CSSProperties = {
  flex: 1,
  overflow: 'auto',
  overscrollBehavior: 'contain',
  padding: 10,
  backgroundColor: 'var(--bg)',
  border: '1px solid var(--border2)',
  borderRadius: 6,
  fontFamily: 'Cascadia Code, Consolas, monospace',
  fontSize: 11,
  lineHeight: 1.5,
  minHeight: 0,
};

export const emptyLogStyle: CSSProperties = {
  color: 'var(--text-dim)',
  textAlign: 'center',
  padding: '40px 16px',
  fontSize: 11,
};

export const logEntryStyle: CSSProperties = {
  padding: '1px 0',
  color: 'var(--text-dim)',
};

export const logTimeStyle: CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
  flexShrink: 0,
};

export const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexShrink: 0,
  padding: '12px 16px',
  borderTop: '1px solid var(--border)',
  backgroundColor: 'var(--bg3)',
};

export const resultsSummaryStyle: CSSProperties = {
  display: 'flex',
  gap: 16,
  fontSize: 12,
};

export const buttonGroupStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
};

export const secondaryButtonStyle: CSSProperties = {
  height: 36,
  padding: '0 16px',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  backgroundColor: 'transparent',
  color: 'var(--text)',
  fontSize: 13,
  cursor: 'pointer',
};

export const primaryButtonStyle: CSSProperties = {
  height: 36,
  padding: '0 20px',
  border: '1px solid var(--accent)',
  borderRadius: 4,
  backgroundColor: 'var(--accent)',
  color: '#ffffff',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s',
};

export const progressBarContainerStyle: CSSProperties = {
  width: 120,
  height: 6,
  backgroundColor: 'var(--bg3)',
  borderRadius: 3,
  overflow: 'hidden',
};

export const progressBarFillStyle: CSSProperties = {
  height: '100%',
  backgroundColor: 'var(--accent)',
  transition: 'width 0.3s ease',
};

export const copyButtonStyle: CSSProperties = {
  height: 28,
  padding: '0 10px',
  border: '1px solid var(--border2)',
  borderRadius: 6,
  backgroundColor: 'var(--control-bg)',
  color: 'var(--text-dim)',
  fontSize: 11,
  cursor: 'pointer',
};

export const logTitleStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-dim)',
};

export const progressBarStyle: CSSProperties = {
  width: 80,
  height: 4,
  backgroundColor: 'var(--bg)',
  borderRadius: 2,
  overflow: 'hidden',
};

export const progressFillStyle: CSSProperties = {
  height: '100%',
  background: 'var(--accent)',
  transition: 'width 0.3s ease',
};

export const statStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 1,
  minWidth: 42,
};

export const statValueStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: 'var(--text)',
};

export const statSuccessValueStyle: CSSProperties = {
  color: 'var(--green)',
};

export const statSkippedValueStyle: CSSProperties = {
  color: 'var(--yellow, #f59e0b)',
};

export const statFailedValueStyle: CSSProperties = {
  color: 'var(--red)',
};

export const statLabelStyle: CSSProperties = {
  fontSize: 9,
  textTransform: 'uppercase',
  color: 'var(--text-dim)',
};

export const logEntryErrorStyle: CSSProperties = {
  color: 'var(--red)',
};

export const logEntryWarningStyle: CSSProperties = {
  color: 'var(--yellow, #f59e0b)',
};

export const statusBadgeStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  padding: '5px 10px',
  borderRadius: 12,
  fontSize: 11,
  fontWeight: 500,
  backgroundColor: 'var(--control-bg)',
  border: '1px solid var(--border)',
  color: 'var(--text-dim)',
};

export const statusBadgeRunningStyle: CSSProperties = {
  backgroundColor: 'var(--accent-faint)',
  borderColor: 'var(--accent-soft)',
  color: 'var(--accent)',
};

export const statusBadgeSuccessStyle: CSSProperties = {
  backgroundColor: 'var(--accent-faint)',
  borderColor: 'var(--accent-soft)',
  color: 'var(--green)',
};

export const statusBadgeErrorStyle: CSSProperties = {
  backgroundColor: 'var(--accent-faint)',
  borderColor: 'var(--accent-soft)',
  color: 'var(--red)',
};

export const statusDotStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  backgroundColor: 'currentColor',
};

export const urlInputStyle: CSSProperties = {
  width: '100%',
  height: 32,
  padding: '0 8px',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  backgroundColor: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 11,
  fontFamily: 'monospace',
};

export const resetButtonStyle: CSSProperties = {
  marginTop: 4,
  padding: '6px 10px',
  fontSize: 11,
  color: 'var(--red)',
  backgroundColor: 'var(--control-bg)',
  border: '1px solid var(--red)',
  borderRadius: 4,
  cursor: 'pointer',
  alignSelf: 'flex-start',
};

