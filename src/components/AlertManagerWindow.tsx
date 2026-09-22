import React, { useEffect, useMemo, useState } from 'react';
import { FloatingWindow } from '@/components/FloatingWindow';
import { readAppSettings, writeAppSettings, type AppSettings } from '@/features/app/appSettingsService';
import {
  formatAlertCondition,
  formatAlertFrequency,
  formatAlertRuleName,
  type EodAlertConditionType,
  type EodAlertRule,
} from '@/features/alerts/eodAlerts';
import { useUiStore } from '@/store/uiStore';
import { useWindowStore } from '@/store/windowStore';

const ALERT_MANAGER_WINDOW_ID = 'alert-manager-window';
type AlertTypeFilter = 'all' | EodAlertConditionType;
type AlertStatusFilter = 'all' | 'enabled' | 'disabled' | 'locked' | 'unlocked';

export function AlertManagerWindow() {
  const isOpen = useUiStore((state) => state.alertManagerOpen);
  const openRequestCount = useUiStore((state) => state.alertManagerOpenRequestCount);
  const onClose = useUiStore((state) => state.closeAlertManager);
  const registerWindow = useWindowStore((state) => state.registerWindow);
  const openWindow = useWindowStore((state) => state.openWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const closeWindow = useWindowStore((state) => state.closeWindow);

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [status, setStatus] = useState('Loading alert rules...');
  const [error, setError] = useState('');
  const [symbolFilter, setSymbolFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<AlertTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<AlertStatusFilter>('all');
  const rules = settings?.eodAlertRules ?? [];
  const history = settings?.eodAlertHistory ?? [];
  const filteredRules = useMemo(
    () => filterAlertRules(rules, { symbolFilter, typeFilter, statusFilter }),
    [rules, symbolFilter, typeFilter, statusFilter],
  );

  useEffect(() => {
    registerWindow({
      id: ALERT_MANAGER_WINDOW_ID,
      title: 'Alert Manager',
      bounds: {
        x: 220,
        y: 110,
        width: 1040,
        height: 620,
      },
      minWidth: 820,
      minHeight: 460,
    });
  }, [registerWindow]);

  useEffect(() => {
    if (isOpen) {
      openWindow(ALERT_MANAGER_WINDOW_ID);
      focusWindow(ALERT_MANAGER_WINDOW_ID);
    } else {
      closeWindow(ALERT_MANAGER_WINDOW_ID);
    }
  }, [isOpen, openWindow, focusWindow, closeWindow]);

  useEffect(() => {
    if (isOpen && openRequestCount > 0) {
      openWindow(ALERT_MANAGER_WINDOW_ID);
      focusWindow(ALERT_MANAGER_WINDOW_ID);
    }
  }, [openRequestCount, isOpen, openWindow, focusWindow]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;
    setStatus('Loading alert rules...');
    setError('');
    readAppSettings()
      .then((nextSettings) => {
        if (cancelled) {
          return;
        }
        setSettings(nextSettings);
        setStatus('');
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load alert rules.');
          setStatus('');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, openRequestCount]);

  const saveRules = async (nextRules: EodAlertRule[], message: string) => {
    if (!settings) {
      return;
    }
    const nextSettings = { ...settings, eodAlertRules: nextRules };
    setSettings(nextSettings);
    setStatus(message);
    setError('');
    try {
      await writeAppSettings(nextSettings);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save alert rules.');
    }
  };

  const updateRule = async (ruleId: string, patch: Partial<EodAlertRule>) => {
    const now = new Date().toISOString();
    await saveRules(
      rules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch, updatedAt: now } : rule)),
      'Alert rule updated.',
    );
  };

  const deleteRule = async (ruleId: string) => {
    const rule = rules.find((candidate) => candidate.id === ruleId);
    if (!rule) {
      return;
    }
    if (rule.locked !== false) {
      setStatus(`Unlock "${rule.name}" before deleting it.`);
      return;
    }
    await saveRules(rules.filter((candidate) => candidate.id !== ruleId), 'Alert rule deleted.');
  };

  return (
    <FloatingWindow id={ALERT_MANAGER_WINDOW_ID} onClose={onClose}>
      <div style={shellStyle}>
        <div style={toolbarStyle}>
          <div>
            <div style={titleStyle}>EOD alert rules</div>
            <div style={subtitleStyle}>
              Manage persisted rules here. Create alerts from chart or scanner context.
            </div>
          </div>
        </div>

        <div style={summaryBarStyle}>
          <span>{rules.length} rules</span>
          <span>{filteredRules.length} shown</span>
          <span>{rules.filter((rule) => rule.enabled).length} enabled</span>
          <span>{rules.filter((rule) => rule.locked !== false).length} locked</span>
          <span>{rules.filter((rule) => rule.conditionType === 'scanner_match').length} scanner-match</span>
          <span>{rules.filter((rule) => rule.conditionType === 'indicator').length} indicator</span>
          <span>{rules.filter((rule) => rule.conditionType === 'drawing').length} drawing</span>
          <span>{history.length} history events</span>
        </div>

        <div style={filterBarStyle}>
          <label style={filterFieldStyle}>
            <span style={filterLabelStyle}>Symbol</span>
            <input
              type="search"
              style={compactInputStyle}
              value={symbolFilter}
              onChange={(event) => setSymbolFilter(event.target.value)}
              placeholder="Filter symbol"
            />
          </label>
          <label style={filterFieldStyle}>
            <span style={filterLabelStyle}>Type</span>
            <select
              style={compactInputStyle}
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as AlertTypeFilter)}
            >
              <option value="all">All types</option>
              <option value="price">Price</option>
              <option value="indicator">Indicator</option>
              <option value="drawing">Drawing</option>
              <option value="scanner_match">Scanner match</option>
            </select>
          </label>
          <label style={filterFieldStyle}>
            <span style={filterLabelStyle}>Status</span>
            <select
              style={compactInputStyle}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as AlertStatusFilter)}
            >
              <option value="all">All status</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
              <option value="locked">Locked</option>
              <option value="unlocked">Unlocked</option>
            </select>
          </label>
        </div>

        {status ? <div style={statusStyle}>{status}</div> : null}
        {error ? <div style={errorStyle}>{error}</div> : null}

        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Lock</th>
                <th style={thStyle}>Enabled</th>
                <th style={thStyle}>Rule</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Symbol</th>
                <th style={thStyle}>Condition</th>
                <th style={thStyle}>Frequency</th>
                <th style={thStyle}>Last Triggered</th>
                <th style={thStyle}>Message</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.length === 0 ? (
                <tr>
                  <td style={emptyCellStyle} colSpan={10}>
                    No alert rules match the current filters.
                  </td>
                </tr>
              ) : (
                filteredRules.map((rule) => {
                  const locked = rule.locked !== false;
                  const missingDrawing = rule.conditionType === 'drawing' && rule.drawingStatus === 'missing';
                  return (
                    <tr key={rule.id}>
                      <td style={tdStyle}>
                        <button
                          type="button"
                          style={iconButtonStyle(locked)}
                          onClick={() => void updateRule(rule.id, { locked: !locked })}
                          title={locked ? 'Unlock alert rule' : 'Lock alert rule'}
                          aria-label={locked ? `Unlock ${rule.name}` : `Lock ${rule.name}`}
                        >
                          {locked ? '🔒' : '🔓'}
                        </button>
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          disabled={missingDrawing}
                          onChange={(event) => void updateRule(rule.id, { enabled: event.target.checked })}
                          title={missingDrawing ? 'Linked drawing was deleted' : 'Toggle alert rule'}
                          aria-label={missingDrawing ? `Linked drawing was deleted for ${rule.name}` : `Toggle ${rule.name}`}
                        />
                      </td>
                      <td style={tdStyle}>{formatAlertRuleName(rule)}</td>
                      <td style={tdStyle}>{formatRuleType(rule.conditionType)}</td>
                      <td style={tdStyle}>{formatAlertRuleSymbol(rule)}</td>
                      <td style={tdStyle}>{formatAlertCondition(rule)}</td>
                      <td style={tdStyle}>{formatAlertFrequency(rule.frequency)}</td>
                      <td style={tdStyle}>{rule.lastTriggeredAt ? formatDateTime(rule.lastTriggeredAt) : '-'}</td>
                      <td style={tdStyle}>{rule.message || '-'}</td>
                      <td style={tdStyle}>
                        <button
                          type="button"
                          style={locked ? disabledDangerButtonStyle : dangerButtonStyle}
                          onClick={() => void deleteRule(rule.id)}
                          disabled={locked}
                          title={locked ? 'Unlock this alert before deleting it' : 'Delete alert rule'}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={sectionHeaderStyle}>Alert history</div>
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Scan Time</th>
                <th style={thStyle}>Symbol</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Rule</th>
                <th style={thStyle}>Value</th>
                <th style={thStyle}>Message</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td style={emptyCellStyle} colSpan={6}>
                    No persisted alert history yet.
                  </td>
                </tr>
              ) : (
                history.slice(0, 100).map((event) => (
                  <tr key={event.id}>
                    <td style={tdStyle}>{formatDateTime(event.scannedAt)}</td>
                    <td style={tdStyle}>{event.exchange}:{event.symbol}</td>
                    <td style={tdStyle}>{event.date}</td>
                    <td style={tdStyle}>{event.ruleName}</td>
                    <td style={tdStyle}>{event.triggerValue ?? '-'}</td>
                    <td style={tdStyle}>{event.message}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </FloatingWindow>
  );
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function formatRuleType(conditionType: EodAlertRule['conditionType']): string {
  if (conditionType === 'scanner_match') {
    return 'Scanner match';
  }
  if (conditionType === 'indicator') {
    return 'Indicator';
  }
  if (conditionType === 'drawing') {
    return 'Drawing';
  }
  return 'Price';
}

function formatAlertRuleSymbol(rule: EodAlertRule): string {
  if (rule.scope === 'any-scanned-symbol') {
    return 'Any scanned symbol';
  }
  if (rule.exchange && rule.symbol) {
    return `${rule.exchange}:${rule.symbol}`;
  }
  return 'Specific symbol';
}

function filterAlertRules(
  rules: EodAlertRule[],
  filters: {
    symbolFilter: string;
    typeFilter: AlertTypeFilter;
    statusFilter: AlertStatusFilter;
  },
): EodAlertRule[] {
  const symbolNeedle = filters.symbolFilter.trim().toUpperCase();
  return rules.filter((rule) => {
    if (filters.typeFilter !== 'all' && rule.conditionType !== filters.typeFilter) {
      return false;
    }
    if (filters.statusFilter === 'enabled' && !rule.enabled) {
      return false;
    }
    if (filters.statusFilter === 'disabled' && rule.enabled) {
      return false;
    }
    if (filters.statusFilter === 'locked' && rule.locked === false) {
      return false;
    }
    if (filters.statusFilter === 'unlocked' && rule.locked !== false) {
      return false;
    }
    if (!symbolNeedle) {
      return true;
    }
    return formatAlertRuleSymbol(rule).toUpperCase().includes(symbolNeedle);
  });
}

const shellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minHeight: 0,
  height: '100%',
  padding: 12,
  background: 'var(--bg)',
  color: 'var(--text)',
};

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const titleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
};

const subtitleStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 12,
  marginTop: 4,
};

const summaryBarStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  color: 'var(--text-dim)',
  fontSize: 12,
};

const sectionHeaderStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 700,
};

const tableWrapStyle: React.CSSProperties = {
  minHeight: 0,
  overflow: 'auto',
  border: '1px solid var(--border)',
  background: 'var(--bg1)',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
};

const thStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  padding: '8px 10px',
  textAlign: 'left',
  color: 'var(--text-dim)',
  background: 'var(--bg2)',
  borderBottom: '1px solid var(--border)',
};

const tdStyle: React.CSSProperties = {
  padding: 8,
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'top',
};

const emptyCellStyle: React.CSSProperties = {
  ...tdStyle,
  color: 'var(--text-dim)',
  textAlign: 'center',
  padding: 22,
};

const dangerButtonStyle: React.CSSProperties = {
  border: '1px solid var(--red)',
  background: 'transparent',
  color: 'var(--red)',
  borderRadius: 4,
  padding: '5px 8px',
  fontSize: 12,
  cursor: 'pointer',
};

const disabledDangerButtonStyle: React.CSSProperties = {
  ...dangerButtonStyle,
  border: '1px solid var(--border)',
  color: 'var(--text-dim)',
  cursor: 'not-allowed',
  opacity: 0.65,
};

const filterBarStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  alignItems: 'end',
};

const filterFieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  width: 180,
};

const filterLabelStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
  fontWeight: 700,
};

const compactInputStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  borderRadius: 4,
  padding: '5px 7px',
  fontSize: 12,
};

const iconButtonStyle = (active: boolean): React.CSSProperties => ({
  width: 28,
  height: 28,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  borderRadius: 4,
  background: active ? 'var(--control-bg-hover)' : 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
});

const statusStyle: React.CSSProperties = {
  color: 'var(--accent)',
  fontSize: 12,
  fontWeight: 700,
};

const errorStyle: React.CSSProperties = {
  color: 'var(--red)',
  fontSize: 12,
  fontWeight: 700,
};
