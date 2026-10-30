import type { EodRow } from './types';

export const BINARY_EOD_ROW_BYTES = 64;
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  const len = clean.length;
  if (len === 0) return new Uint8Array(0);
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const outLen = ((len * 3) >> 2) - pad;
  const out = new Uint8Array(outLen);
  let outIdx = 0;
  for (let i = 0; i < len; i += 4) {
    const c0 = B64_CHARS.indexOf(clean[i] ?? 'A');
    const c1 = B64_CHARS.indexOf(clean[i + 1] ?? 'A');
    const c2 = B64_CHARS.indexOf(clean[i + 2] ?? 'A');
    const c3 = B64_CHARS.indexOf(clean[i + 3] ?? 'A');
    const n = (Math.max(0, c0) << 18) | (Math.max(0, c1) << 12) | (Math.max(0, c2) << 6) | Math.max(0, c3);
    if (outIdx < outLen) out[outIdx++] = (n >> 16) & 0xff;
    if (outIdx < outLen) out[outIdx++] = (n >> 8) & 0xff;
    if (outIdx < outLen) out[outIdx++] = n & 0xff;
  }
  return out;
}

export function encodeBinaryEodBars(rows: EodRow[]): string {
  const buf = new ArrayBuffer(rows.length * BINARY_EOD_ROW_BYTES);
  const view = new DataView(buf);
  rows.forEach((r, idx) => {
    const off = idx * BINARY_EOD_ROW_BYTES;
    const ymd = Number(r.date.replace(/-/g, '')) || 0;
    const hasPrev = typeof r.prevClose === 'number' && Number.isFinite(r.prevClose);
    view.setUint32(off, ymd, true);
    view.setUint32(off + 4, hasPrev ? 1 : 0, true);
    view.setFloat64(off + 8, r.open, true);
    view.setFloat64(off + 16, r.high, true);
    view.setFloat64(off + 24, r.low, true);
    view.setFloat64(off + 32, r.close, true);
    view.setFloat64(off + 40, hasPrev ? (r.prevClose ?? 0) : 0, true);
    view.setFloat64(off + 48, r.volume, true);
    view.setFloat64(off + 56, 0, true);
  });
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = i + 1 < bytes.length ? (bytes[i + 1] ?? 0) : 0;
    const b2 = i + 2 < bytes.length ? (bytes[i + 2] ?? 0) : 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    out += B64_CHARS[(n >> 18) & 63];
    out += B64_CHARS[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64_CHARS[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64_CHARS[n & 63] : '=';
  }
  return out;
}

export function decodeBinaryEodBars(barsB64: string, barCount: number): EodRow[] {
  const paddingStart = barsB64.indexOf('=');
  if (!Number.isSafeInteger(barCount) || barCount < 0
    || barsB64.length % 4 !== 0
    || /[^A-Za-z0-9+/=]/.test(barsB64)
    || (paddingStart >= 0 && (paddingStart < barsB64.length - 2
      || !['=', '=='].includes(barsB64.slice(paddingStart))))) {
    throw new Error('Invalid binary chart data envelope.');
  }
  const bytes = decodeBase64ToBytes(barsB64);
  if (bytes.byteLength !== barCount * BINARY_EOD_ROW_BYTES) {
    throw new Error(`Incomplete binary chart data: expected ${barCount} bars (${barCount * BINARY_EOD_ROW_BYTES} bytes), received ${bytes.byteLength} bytes.`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = barCount;
  const rows: EodRow[] = new Array(count);

  for (let i = 0; i < count; i += 1) {
    const off = i * BINARY_EOD_ROW_BYTES;
    const ymd = view.getUint32(off, true);
    const flags = view.getUint32(off + 4, true);
    const y = Math.floor(ymd / 10000);
    const m = Math.floor((ymd % 10000) / 100);
    const d = ymd % 100;
    const calendarDate = new Date(0);
    calendarDate.setUTCFullYear(y, m - 1, d);
    if (y < 1 || y > 9999 || calendarDate.getUTCFullYear() !== y
      || calendarDate.getUTCMonth() !== m - 1 || calendarDate.getUTCDate() !== d
      || (i > 0 && ymd <= view.getUint32(off - BINARY_EOD_ROW_BYTES, true))) {
      throw new Error(`Invalid or unordered binary chart date at bar ${i + 1}.`);
    }
    const date = String(y).padStart(4, '0') + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const row: EodRow = {
      date,
      open: view.getFloat64(off + 8, true),
      high: view.getFloat64(off + 16, true),
      low: view.getFloat64(off + 24, true),
      close: view.getFloat64(off + 32, true),
      volume: view.getFloat64(off + 48, true),
    };
    if ((flags & 1) !== 0) {
      row.prevClose = view.getFloat64(off + 40, true);
    }
    if (![row.open, row.high, row.low, row.close, row.volume, ...(row.prevClose == null ? [] : [row.prevClose])].every(Number.isFinite)) {
      throw new Error(`Non-finite binary chart value at bar ${i + 1}.`);
    }
    rows[i] = row;
  }
  return rows;
}
