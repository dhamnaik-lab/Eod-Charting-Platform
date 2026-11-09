import React, { useEffect } from 'react';
import { useUiStore } from '@/store/uiStore';
import { useWindowStore } from '@/store/windowStore';
import { FloatingWindow } from '@/components/FloatingWindow';

const FAQ_WINDOW_ID = 'faq-dialog';

export function FAQDialog() {
  const isOpen = useUiStore((state) => state.faqDialogOpen);
  const openRequestCount = useUiStore((state) => state.faqOpenRequestCount);
  const onClose = useUiStore((state) => state.closeFaqDialog);

  const registerWindow = useWindowStore((state) => state.registerWindow);
  const openWindow = useWindowStore((state) => state.openWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const restoreWindow = useWindowStore((state) => state.restoreWindow);
  const closeWindow = useWindowStore((state) => state.closeWindow);

  useEffect(() => {
    registerWindow({
      id: FAQ_WINDOW_ID,
      title: 'Frequently Asked Questions',
      bounds: {
        x: 180,
        y: 90,
        width: 760,
        height: 620,
      },
      minWidth: 520,
      minHeight: 360,
    });
  }, [registerWindow]);

  useEffect(() => {
    if (isOpen) {
      openWindow(FAQ_WINDOW_ID);
      focusWindow(FAQ_WINDOW_ID);
    } else {
      closeWindow(FAQ_WINDOW_ID);
    }
  }, [isOpen, openRequestCount, openWindow, focusWindow, closeWindow]);

  if (!isOpen) return null;

  return (
    <FloatingWindow id={FAQ_WINDOW_ID} onClose={onClose}>
      <div style={contentStyle} className="tab-strip-scroll">
        <Section title="Getting Started">
          <Item
            question="What is EOD Chart?"
            answer="A high-performance Technical Analysis platform for End-Of-Day (EOD) data, built with Tauri and React."
          />
          <Item
            question="How to create a database?"
            answer="Use Database > New Database. It defaults to Binary mode for maximum performance."
          />
          <Item
            question="How to open a database?"
            answer="Use Database > Open Database to load an existing .db (SQLite) or .eod (Binary) database folder."
          />
        </Section>

        <Section title="Database & Storage">
          <Item
            question="Binary EOD (.eod)"
            answer="A high-speed, 64-bit binary format for price data (Open, High, Low, Close, Volume, Open Interest)."
          />
          <Item
            question="SQLite (.db)"
            answer="Stores metadata, symbol lists, watchlists, layouts, and download logs."
          />
          <Item
            question="Compatibility"
            answer="Legacy Hybrid databases (SQLite-only price storage) are still supported but Binary is recommended for performance."
          />
        </Section>

        <Section title="Charts">
          <Item
            question="How to zoom and scroll?"
            answer="Use the mouse wheel to zoom (at the price scale) or drag the chart to pan."
          />
          <Item
            question="What are Sheets?"
            answer="Each chart tab can have multiple 'Sheets' for different analysis views (e.g., different indicators or timeframes) of the same symbol."
          />
          <Item
            question="Indicators & Drawings"
            answer="Add Moving Averages, RSI, MACD, etc., via the Chart menu. Drawing tools like Trendlines and Fibonacci are also available."
          />
        </Section>

        <Section title="Bhavcopy Downloads">
          <Item
            question="Data Sources"
            answer="Supports NSE (National Stock Exchange) and BSE (Bombay Stock Exchange) equity and index data."
          />
          <Item
            question="Date Range"
            answer="You can download a single day or a specific range of dates. Existing data for those dates will be updated."
          />
          <Item
            question="Automatic Refresh"
            answer="Charts automatically reload and reflect new data immediately after a successful import."
          />
        </Section>

        <Section title="Watchlists">
          <Item
            question="Custom Watchlists"
            answer="Create your own groups of symbols via Watchlist > Manage Watchlists."
          />
          <Item
            question="Official Groups"
            answer="Import sector-wise or index-wise groups directly from official sources via Watchlist > Import Watchlist Groups."
          />
        </Section>

        <Section title="Quote Editor">
          <Item
            question="Manual Adjustments"
            answer="View and edit raw data rows via Database > Quote Editor. Changes are immediately reflected on the active chart."
          />
        </Section>

        <Section title="Corporate Actions">
          <Item
            question="Splits & Bonuses"
            answer="Tools are available to adjust historical data for splits, bonuses, or name changes to maintain chart continuity."
          />
        </Section>

        <Section title="Troubleshooting">
          <Item
            question="Missing data?"
            answer="Ensure the Bhavcopy for that specific date was downloaded and the symbol exists in the database."
          />
          <Item
            question="Chart not updating?"
            answer="Check if the database is locked or if there was a network error during download. Check the status bar for info."
          />
          <Item
            question="Where are the logs?"
            answer="View application information and runtime paths in the Help > About dialog."
          />
        </Section>

        <Section title="Application Behavior">
          <Item
            question="Tauri Native"
            answer="This is a native desktop application providing a smoother experience than a web-based tool."
          />
          <Item
            question="Maximized Startup"
            answer="The application is configured to open maximized by default to provide a ready-to-use workspace."
          />
        </Section>
      </div>
      <div style={footerStyle}>
        <button type="button" onClick={onClose} style={footerButtonStyle}>
          Done
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

function Item({ question, answer }: { question: string; answer: string }) {
  return (
    <div style={itemStyle}>
      <div style={questionStyle}>{question}</div>
      <div style={answerStyle}>{answer}</div>
    </div>
  );
}

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
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

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--accent-text)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid var(--accent-soft)',
  paddingBottom: 4,
};

const sectionContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const questionStyle: React.CSSProperties = {
  fontWeight: 600,
  color: 'var(--text)',
  fontSize: 14,
};

const answerStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  lineHeight: 1.5,
  fontSize: 13,
};
