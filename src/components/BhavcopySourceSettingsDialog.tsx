import { useState, useEffect } from 'react';
import {
  getDesktopApi,
  type BhavcopySettings,
  type BhavcopyDefaultTemplates,
} from '@/platform';
import {
  overlayStyle,
  closeButtonStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  inputGroupStyle,
  labelStyle,
  urlInputStyle,
  resetButtonStyle,
} from './BhavcopyDownloadWindow.styles';

interface BhavcopySourceSettingsDialogProps {
  onClose: () => void;
  onSave: (settings: BhavcopySettings) => void;
  initialSettings: BhavcopySettings;
}

export function BhavcopySourceSettingsDialog({
  onClose,
  onSave,
  initialSettings,
}: BhavcopySourceSettingsDialogProps) {
  const [settings, setSettings] = useState<BhavcopySettings>(initialSettings);
  const [defaults, setDefaults] = useState<BhavcopyDefaultTemplates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const api = getDesktopApi();

  useEffect(() => {
    const loadDefaults = async () => {
      if (!api) return;
      try {
        const defaultTemplates = await api.getBhavcopyDefaultTemplates();
        setDefaults(defaultTemplates);
      } catch (err) {
        console.error('Failed to load default templates:', err);
      }
    };
    loadDefaults();
  }, [api]);

  const handleOverrideChange = (field: keyof BhavcopySettings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value || null,
    }));
  };

  const handleReset = () => {
    setSettings((prev) => ({
      ...prev,
      nseEquityUrlOverride: null,
      nseIndexUrlOverride: null,
      bseEquityUrlOverride: null,
      bseIndexUrlOverride: null,
    }));
  };

  const validateUrl = (url: string | null | undefined) => {
    if (!url) return true;
    return url.startsWith('http://') || url.startsWith('https://');
  };

  const handleSave = () => {
    if (
      !validateUrl(settings.nseEquityUrlOverride) ||
      !validateUrl(settings.nseIndexUrlOverride) ||
      !validateUrl(settings.bseEquityUrlOverride) ||
      !validateUrl(settings.bseIndexUrlOverride)
    ) {
      setError('Custom URLs must start with http:// or https://');
      return;
    }

    onSave(settings);
    onClose();
  };

  return (
    <div style={{ ...overlayStyle, zIndex: 1100 }}>
      <div style={dialogWindowStyle}>
        <div style={dialogHeaderStyle}>
          <h3 style={dialogTitleStyle}>Bhavcopy Source Settings</h3>
          <button style={closeButtonStyle} onClick={onClose}>×</button>
        </div>

        <div style={dialogBodyStyle}>
          <div style={dialogInfoStyle}>
            Custom overrides take precedence. Leave blank to use built-in defaults.
            Placeholders supported: {'{ddmmyyyy}'}, {'{date_key}'}, {'{yyyymmdd}'}, {'{year}'}, {'{MMM}'}.
          </div>

          {error && <div style={errorStyle}>{error}</div>}

          <SourceCategory
            title="NSE Equity"
            field="nseEquityUrlOverride"
            currentOverride={settings.nseEquityUrlOverride}
            defaults={defaults?.nseEquity}
            onChange={handleOverrideChange}
          />

          <SourceCategory
            title="NSE Index Symbols / Full Index List"
            field="nseIndexUrlOverride"
            currentOverride={settings.nseIndexUrlOverride}
            defaults={defaults?.nseIndex}
            onChange={handleOverrideChange}
          />

          <SourceCategory
            title="BSE Equity"
            field="bseEquityUrlOverride"
            currentOverride={settings.bseEquityUrlOverride}
            defaults={defaults?.bseEquity}
            onChange={handleOverrideChange}
          />

          <SourceCategory
            title="BSE Index"
            field="bseIndexUrlOverride"
            currentOverride={settings.bseIndexUrlOverride}
            defaults={defaults?.bseIndex}
            onChange={handleOverrideChange}
          />
        </div>

        <div style={dialogFooterStyle}>
          <button style={resetButtonStyle} onClick={handleReset}>
            Reset to Defaults
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={secondaryButtonStyle} onClick={onClose}>
              Cancel
            </button>
            <button style={primaryButtonStyle} onClick={handleSave}>
              Save / Update
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SourceCategoryProps {
  title: string;
  field: keyof BhavcopySettings;
  currentOverride: string | null | undefined;
  defaults: string[] | undefined;
  onChange: (field: keyof BhavcopySettings, value: string) => void;
}

function SourceCategory({
  title,
  field,
  currentOverride,
  defaults,
  onChange,
}: SourceCategoryProps) {
  return (
    <div style={categoryStyle}>
      <div style={categoryTitleStyle}>{title}</div>
      
      <div style={defaultTemplatesListStyle}>
        <div style={defaultLabelStyle}>Built-in Defaults:</div>
        {defaults?.map((tmpl, i) => (
          <div key={i} style={templateRowStyle}>
            <span style={templateNumberStyle}>{i + 1}.</span>
            <span style={templateTextStyle}>{tmpl}</span>
          </div>
        )) || <div style={loadingTextStyle}>Loading defaults...</div>}
      </div>

      <div style={inputGroupStyle}>
        <label style={labelStyle}>Custom Override URL / Template</label>
        <input
          type="text"
          value={currentOverride || ''}
          onChange={(e) => onChange(field, e.target.value)}
          placeholder="Leave blank for defaults"
          style={urlInputStyle}
        />
      </div>
    </div>
  );
}

const dialogWindowStyle: React.CSSProperties = {
  width: 650,
  maxHeight: '90vh',
  backgroundColor: 'var(--bg2)',
  borderRadius: 8,
  border: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: 'var(--shadow-lg)',
};

const dialogHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid var(--border)',
  backgroundColor: 'var(--bg3)',
};

const dialogTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text)',
};

const dialogBodyStyle: React.CSSProperties = {
  padding: 16,
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
};

const dialogInfoStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-dim)',
  backgroundColor: 'var(--control-bg)',
  padding: '10px 12px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  lineHeight: 1.5,
};

const dialogFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 16px',
  borderTop: '1px solid var(--border)',
  backgroundColor: 'var(--bg3)',
};

const categoryStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const categoryTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text)',
  borderLeft: '2px solid var(--accent)',
  paddingLeft: 8,
};

const defaultTemplatesListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '8px 10px',
  backgroundColor: 'var(--bg)',
  borderRadius: 4,
  border: '1px solid var(--border)',
};

const defaultLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--text-dim)',
  marginBottom: 2,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const templateRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  fontSize: 10,
  fontFamily: 'monospace',
};

const templateNumberStyle: React.CSSProperties = {
  color: 'var(--accent-text)',
  flexShrink: 0,
};

const templateTextStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  wordBreak: 'break-all',
};

const loadingTextStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-dim)',
  fontStyle: 'italic',
};

const errorStyle: React.CSSProperties = {
  padding: '8px 12px',
  backgroundColor: 'var(--control-bg)',
  border: '1px solid var(--red)',
  borderRadius: 4,
  color: 'var(--red-text)',
  fontSize: 12,
};
