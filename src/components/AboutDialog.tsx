import React, { useEffect, useMemo, useState } from 'react';
import { FloatingWindow } from '@/components/FloatingWindow';
import { APP_VERSION_HISTORY } from '@/features/app/appVersionHistory';
import { requireDesktopShellApi } from '@/platform/shell';
import type { AppInfo } from '@/types/desktop';
import { useUiStore } from '@/store/uiStore';
import { useWindowStore } from '@/store/windowStore';

const ABOUT_WINDOW_ID = 'about-dialog';

export function AboutDialog() {
  const isOpen = useUiStore((state) => state.aboutDialogOpen);
  const openRequestCount = useUiStore((state) => state.aboutOpenRequestCount);
  const onClose = useUiStore((state) => state.closeAboutDialog);

  const registerWindow = useWindowStore((state) => state.registerWindow);
  const openWindow = useWindowStore((state) => state.openWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const closeWindow = useWindowStore((state) => state.closeWindow);

  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    registerWindow({
      id: ABOUT_WINDOW_ID,
      title: 'About EOD Chart',
      bounds: {
        x: 220,
        y: 110,
        width: 760,
        height: 640,
      },
      minWidth: 620,
      minHeight: 420,
    });
  }, [registerWindow]);

  useEffect(() => {
    if (isOpen) {
      openWindow(ABOUT_WINDOW_ID);
      focusWindow(ABOUT_WINDOW_ID);
    } else {
      closeWindow(ABOUT_WINDOW_ID);
    }
  }, [isOpen, openRequestCount, openWindow, focusWindow, closeWindow]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    let shellApi;
    try {
      shellApi = requireDesktopShellApi();
    } catch (nextError) {
      setLoading(false);
      setError(nextError instanceof Error ? nextError.message : 'Desktop shell API bridge is unavailable.');
      setAppInfo(null);
      return;
    }

    void shellApi
      .getAppInfo()
      .then((nextInfo) => {
        if (cancelled) {
          return;
        }
        setAppInfo(nextInfo);
      })
      .catch((nextError: unknown) => {
        if (cancelled) {
          return;
        }
        setError(nextError instanceof Error ? nextError.message : 'Unable to load application information.');
        setAppInfo(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, openRequestCount]);

  const activeVersionEntry = useMemo(() => {
    if (!appInfo?.version) {
      return null;
    }
    return APP_VERSION_HISTORY.find((entry) => entry.version === appInfo.version) ?? null;
  }, [appInfo?.version]);

  if (!isOpen) {
    return null;
  }

  return (
    <FloatingWindow id={ABOUT_WINDOW_ID} onClose={onClose}>
      <div style={contentStyle} className="tab-strip-scroll">
        <div style={heroStyle}>
          <div style={titleRowStyle}>
            <div>
              <div style={appNameStyle}>{appInfo?.name ?? 'EOD Chart'}</div>
              <div style={versionLineStyle}>
                <span>Version {appInfo?.version ?? 'unknown'}</span>
                <span>Build {appInfo?.buildNumber ?? 'unknown'}</span>
              </div>
            </div>
            <div style={runtimeBadgeStyle}>{appInfo?.runtime?.toUpperCase() ?? 'TAURI'}</div>
          </div>
          <div style={metaGridStyle}>
            <MetaItem label="Built" value={formatBuildTime(appInfo?.builtAt)} />
            <MetaItem label="Profile" value={appInfo?.buildProfile ?? 'unknown'} />
            <MetaItem label="Data Mode" value={appInfo?.dataMode ?? 'system'} />
          </div>
        </div>

        {loading ? <div style={loadingStyle}>Loading application information...</div> : null}
        {error ? <div style={errorStyle}>{error}</div> : null}

        <Section title="What Changed">
          {activeVersionEntry ? (
            <VersionEntry entry={activeVersionEntry} emphasize />
          ) : (
            <div style={emptyStateStyle}>No release notes are recorded for version {appInfo?.version ?? 'unknown'}.</div>
          )}
        </Section>

        <Section title="Version History">
          <div style={historyListStyle}>
            {APP_VERSION_HISTORY.map((entry) => (
              <VersionEntry key={`${entry.version}-${entry.releasedOn}`} entry={entry} />
            ))}
          </div>
        </Section>

        <Section title="Runtime Paths">
          <PathRow label="Data" value={appInfo?.dataDir} />
          <PathRow label="State" value={appInfo?.stateDir} />
          <PathRow label="Log" value={appInfo?.logFile} />
          <PathRow label="Executable" value={appInfo?.executableDir} />
        </Section>
      </div>
      <div style={footerStyle}>
        <button type="button" onClick={onClose} style={footerButtonStyle}>
          Close
        </button>
      </div>
    </FloatingWindow>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={sectionStyle}>
      <div style={sectionTitleStyle}>{title}</div>
      <div style={sectionContentStyle}>{children}</div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={metaItemStyle}>
      <div style={metaLabelStyle}>{label}</div>
      <div style={metaValueStyle}>{value}</div>
    </div>
  );
}

function PathRow({ label, value }: { label: string; value?: string }) {
  return (
    <div style={pathRowStyle}>
      <div style={pathLabelStyle}>{label}</div>
      <div style={pathValueStyle}>{value?.trim() ? value : 'Unavailable'}</div>
    </div>
  );
}

function VersionEntry({
  entry,
  emphasize = false,
}: {
  entry: (typeof APP_VERSION_HISTORY)[number];
  emphasize?: boolean;
}) {
  return (
    <div style={{ ...versionEntryStyle, ...(emphasize ? versionEntryEmphasisStyle : null) }}>
      <div style={versionEntryHeaderStyle}>
        <div style={versionEntryVersionStyle}>Version {entry.version}</div>
        <div style={versionEntryDateStyle}>{entry.releasedOn}</div>
      </div>
      <div style={versionEntryTitleStyle}>{entry.title}</div>
      <ul style={notesListStyle}>
        {entry.notes.map((note) => (
          <li key={note} style={noteItemStyle}>
            {note}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatBuildTime(value?: string): string {
  if (!value) {
    return 'Unknown';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
};

const heroStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 18,
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--bg2)',
};

const titleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
};

const appNameStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  color: 'var(--text)',
};

const versionLineStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  marginTop: 6,
  fontSize: 13,
  color: 'var(--text-dim)',
  flexWrap: 'wrap',
};

const runtimeBadgeStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  color: 'var(--accent)',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.04em',
};

const metaGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
};

const metaItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: 12,
  borderRadius: 6,
  background: 'var(--bg3)',
  border: '1px solid var(--border)',
};

const metaLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-mute)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const metaValueStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text)',
};

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--accent)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid var(--accent-soft)',
  paddingBottom: 4,
};

const sectionContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const versionEntryStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 14,
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg2)',
};

const versionEntryEmphasisStyle: React.CSSProperties = {
  borderColor: 'var(--accent-soft)',
  boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)',
};

const versionEntryHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
};

const versionEntryVersionStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--text)',
};

const versionEntryDateStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-dim)',
};

const versionEntryTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text)',
};

const historyListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const notesListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const noteItemStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  lineHeight: 1.45,
  fontSize: 13,
};

const pathRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '90px minmax(0, 1fr)',
  gap: 10,
  alignItems: 'start',
  padding: 12,
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg2)',
};

const pathLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--text-mute)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const pathValueStyle: React.CSSProperties = {
  fontFamily: 'Consolas, "Courier New", monospace',
  fontSize: 12,
  color: 'var(--text)',
  wordBreak: 'break-word',
  lineHeight: 1.5,
};

const loadingStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-dim)',
};

const errorStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 6,
  background: 'color-mix(in srgb, var(--red) 12%, var(--bg))',
  border: '1px solid color-mix(in srgb, var(--red) 32%, transparent)',
  color: 'var(--text)',
  fontSize: 13,
};

const emptyStateStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 6,
  border: '1px dashed var(--border)',
  color: 'var(--text-dim)',
  fontSize: 13,
};

const footerStyle: React.CSSProperties = {
  padding: '12px 20px',
  borderTop: '1px solid var(--border)',
  display: 'flex',
  justifyContent: 'flex-end',
  backgroundColor: 'var(--bg3)',
};

const footerButtonStyle: React.CSSProperties = {
  padding: '8px 24px',
  backgroundColor: 'var(--accent)',
  color: 'var(--text)',
  border: 'none',
  borderRadius: 4,
  fontWeight: 600,
  cursor: 'pointer',
};
