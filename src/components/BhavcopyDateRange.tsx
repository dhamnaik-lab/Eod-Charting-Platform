import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { dateInputStyle, dateRangeStyle, inputGroupStyle, labelStyle } from './BhavcopyDownloadWindow.styles';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
type Field = 'start' | 'end';

function utcDate(year: number, month: number, day: number) {
  const date = new Date(0);
  // Date.UTC interprets years 0 through 99 as 1900 through 1999.
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

export function calendarMonth(year: number, month: number) {
  return {
    offset: (utcDate(year, month, 1).getUTCDay() + 6) % 7,
    days: utcDate(year, month + 1, 0).getUTCDate(),
  };
}

function dateKey(year: number, month: number, day: number) {
  return [String(year).padStart(4, '0'), ...[month, day].map((part) => String(part).padStart(2, '0'))].join('-');
}

export function parseBhavcopyDate(value: string): string | undefined {
  const text = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const local = /^(\d{2})([-/])(\d{2})\2(\d{4})$/.exec(text);
  const parts = iso ? iso.slice(1) : local ? [local[4], local[3], local[1]] : [];
  const [year, month, day] = parts.map(Number);
  if (!year || month < 1 || month > 12 || day < 1 || day > calendarMonth(year, month).days) {
    return undefined;
  }
  return dateKey(year, month, day);
}

export function formatBhavcopyDate(value: string): string {
  const iso = parseBhavcopyDate(value);
  if (!iso) return value;
  const [year, month, day] = iso.split('-');
  return `${day}-${month}-${year}`;
}

const fieldRow: CSSProperties = { position: 'relative', minWidth: 0 };
const dateFieldStyle: CSSProperties = {
  ...dateInputStyle, width: '100%', boxSizing: 'border-box', paddingRight: 30,
};
const calendarButtonStyle: CSSProperties = {
  position: 'absolute', top: 3, right: 3, bottom: 3, width: 24,
  border: 0, borderRadius: 3, background: 'transparent', color: 'var(--text)',
  padding: 0, cursor: 'pointer', fontSize: 13,
  fontFamily: '"Segoe Fluent Icons", "Segoe MDL2 Assets"',
};
const calendarPanel: CSSProperties = {
  position: 'fixed', zIndex: 20, width: 224, maxWidth: 'calc(100vw - 16px)',
  boxSizing: 'border-box', overflowY: 'auto', color: 'var(--text)',
  border: '1px solid var(--border2)', borderRadius: 6,
  boxShadow: 'var(--shadow-lg, 0 4px 14px rgba(0, 0, 0, .18))',
  padding: 8, backgroundColor: 'var(--control-bg)',
};
const toolbar: CSSProperties = { display: 'flex', gap: 4, alignItems: 'center' };
const weekGrid: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 2, marginTop: 5, textAlign: 'center',
};
const buttonStyle: CSSProperties = { ...dateInputStyle, height: 26, padding: '0 5px' };
const dayStyle: CSSProperties = {
  border: 0, borderRadius: 4, height: 23, padding: 0,
  background: 'transparent', color: 'var(--text)', fontSize: 12,
};

export function BhavcopyDateRange({
  start, end, today, disabled, onChange,
}: {
  start: string;
  end: string;
  today: string;
  disabled: boolean;
  onChange: (field: Field, value: string) => void;
}) {
  const id = useId();
  const startButton = useRef<HTMLButtonElement>(null);
  const endButton = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Field | null>(null);
  const [year, setYear] = useState(1);
  const [yearText, setYearText] = useState('');
  const [month, setMonth] = useState(1);
  const [currentYear, currentMonth] = today.split('-').map(Number);
  const draftYear = Number(yearText);
  const invalidYear = yearText.length === 4 && (draftYear < 1 || draftYear > currentYear);
  const monthEnd = year === currentYear ? currentMonth : 12;
  const monthInfo = calendarMonth(year, month);
  const selected = parseBhavcopyDate(active === 'start' ? start : end);
  const anchor = active === 'start' ? startButton.current : endButton.current;

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const field = anchor?.parentElement;
    if (!active || disabled || !panel || !field) return;

    function position() {
      if (!panel || !field) return;
      const rect = field.getBoundingClientRect();
      const below = Math.max(0, window.innerHeight - rect.bottom - 12);
      const above = Math.max(0, rect.top - 12);
      const height = panel.scrollHeight + 2;
      const opensAbove = height > below && above > below;
      const available = opensAbove ? above : below;
      panel.style.maxHeight = `${available}px`;
      panel.style.top = `${opensAbove ? rect.top - Math.min(height, available) - 4 : rect.bottom + 4}px`;
      panel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - panel.offsetWidth - 8))}px`;
    }
    function dismissOutside(event: Event) {
      if (event.target instanceof Node && !panel?.contains(event.target) && !field?.contains(event.target)) {
        setActive(null);
      }
    }
    position();
    panel.focus({ preventScroll: true });
    const observer = new ResizeObserver(position);
    observer.observe(panel);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('focusin', dismissOutside);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('focusin', dismissOutside);
    };
  }, [active, anchor, disabled]);

  function closeCalendar() {
    setActive(null);
    anchor?.focus();
  }

  function openCalendar(field: Field, value: string) {
    if (active === field) {
      closeCalendar();
      return;
    }
    const date = parseBhavcopyDate(value);
    const [nextYear, nextMonth] = (date && date <= today ? date : today).split('-');
    setYear(Number(nextYear));
    setYearText(nextYear);
    setMonth(Number(nextMonth));
    setActive(field);
  }

  function moveMonth(step: number) {
    const candidate = utcDate(year, month + step, 1);
    const nextYear = candidate.getUTCFullYear();
    setYear(nextYear);
    setYearText(String(nextYear).padStart(4, '0'));
    setMonth(candidate.getUTCMonth() + 1);
  }

  function applyYear(next: number) {
    setYear(next);
    setYearText(String(next).padStart(4, '0'));
    if (next === currentYear) setMonth((previous) => Math.min(previous, currentMonth));
  }

  return (
    <div onKeyDown={(event) => {
      if (event.key === 'Escape' && active) {
        event.stopPropagation();
        closeCalendar();
      }
    }}>
      <div style={dateRangeStyle}>
        {(['start', 'end'] as const).map((field) => {
          const label = field === 'start' ? 'Start' : 'End';
          const value = field === 'start' ? start : end;
          return (
            <div key={field} style={{ ...inputGroupStyle, flex: '0 1 140px', minWidth: 0 }}>
              <label htmlFor={`${id}-${field}`} style={labelStyle}>{label}</label>
              <div style={fieldRow}>
                <input
                  id={`${id}-${field}`}
                  type="text"
                  value={formatBhavcopyDate(value)}
                  maxLength={10}
                  placeholder="DD-MM-YYYY"
                  autoComplete="off"
                  spellCheck={false}
                  aria-description="Date in DD-MM-YYYY format"
                  disabled={disabled}
                  onChange={(event) => onChange(field, event.target.value)}
                  style={dateFieldStyle}
                />
                <button
                  ref={field === 'start' ? startButton : endButton}
                  type="button"
                  aria-label={`${label} calendar`}
                  title={`Pick ${label.toLowerCase()} date`}
                  aria-expanded={active === field && !disabled}
                  aria-controls={active === field && !disabled ? `${id}-calendar` : undefined}
                  disabled={disabled}
                  onClick={() => openCalendar(field, value)}
                  style={{ ...calendarButtonStyle, opacity: disabled ? 0.5 : 1 }}
                ><span aria-hidden="true">{'\uE787'}</span></button>
              </div>
            </div>
          );
        })}
      </div>
      {active && !disabled && anchor && createPortal(
        <div ref={panelRef} id={`${id}-calendar`} role="group" tabIndex={-1} aria-label={`${active === 'start' ? 'Start' : 'End'} date calendar`} style={{ ...calendarPanel, outline: 'none' }}>
          <div style={toolbar}>
            <button type="button" style={buttonStyle} aria-label="Previous month" disabled={year === 1 && month === 1} onClick={() => moveMonth(-1)}>‹</button>
            <select aria-label="Month" value={month} style={{ ...buttonStyle, flex: 1, minWidth: 0 }} onChange={(event) => setMonth(Number(event.target.value))}>
              {monthNames.map((name, index) => <option key={name} value={index + 1} disabled={index + 1 > monthEnd}>{name}</option>)}
            </select>
            <input
              aria-label="Year"
              title="Type a year or use the Up and Down arrow keys"
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={yearText}
              aria-invalid={invalidYear}
              onFocus={(event) => event.currentTarget.select()}
              onBlur={() => setYearText(String(year).padStart(4, '0'))}
              onChange={(event) => {
                const next = event.target.value;
                if (!/^\d{0,4}$/.test(next)) return;
                setYearText(next);
                const parsed = Number(next);
                if (next.length === 4 && parsed >= 1 && parsed <= currentYear) applyYear(parsed);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (draftYear >= 1 && draftYear <= currentYear) applyYear(draftYear);
                }
                if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                  event.preventDefault();
                  const step = event.key === 'ArrowUp' ? 1 : -1;
                  applyYear(Math.max(1, Math.min(currentYear, year + step)));
                }
              }}
              style={{ ...buttonStyle, width: 52, boxSizing: 'border-box', textAlign: 'center' }}
            />
            <button type="button" style={buttonStyle} aria-label="Next month" disabled={year === currentYear && month >= currentMonth} onClick={() => moveMonth(1)}>›</button>
          </div>
          {invalidYear && <div role="status" style={{ ...labelStyle, marginTop: 6 }}>Enter a year from 0001 to {currentYear}.</div>}
          <div style={weekGrid}>
            {weekdays.map((day) => <span key={day} style={labelStyle}>{day}</span>)}
            {Array.from({ length: monthInfo.offset }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
            {Array.from({ length: monthInfo.days }, (_, index) => {
              const day = index + 1;
              const key = dateKey(year, month, day);
              return (
                <button
                  type="button"
                  key={key}
                  aria-label={`${day} ${monthNames[month - 1]} ${year}`}
                  aria-pressed={key === selected}
                  disabled={key > today}
                  style={{
                    ...dayStyle, cursor: key > today ? 'default' : 'pointer',
                    ...(key === selected ? { backgroundColor: 'var(--accent)', color: 'var(--accent-contrast, white)' } : {}),
                    ...(key > today ? { opacity: 0.45 } : {}),
                  }}
                  onClick={() => {
                    onChange(active, formatBhavcopyDate(key));
                    closeCalendar();
                  }}
                >{day}</button>
              );
            })}
          </div>
        </div>,
        anchor.closest('[role="dialog"]') ?? document.body,
      )}
    </div>
  );
}
