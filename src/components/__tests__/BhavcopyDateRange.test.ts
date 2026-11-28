import { describe, expect, it } from 'vitest';
import { calendarMonth, formatBhavcopyDate, parseBhavcopyDate } from '../BhavcopyDateRange';

describe('Bhavcopy Date Range', () => {
  it('displays valid dates day-first while preserving an unfinished draft', () => {
    expect(formatBhavcopyDate('1986-01-02')).toBe('02-01-1986');
    expect(formatBhavcopyDate('09/07/1875')).toBe('09-07-1875');
    expect(formatBhavcopyDate('02-01-19')).toBe('02-01-19');
  });

  it('accepts direct entry in either format without a historical floor', () => {
    expect(parseBhavcopyDate('02-01-1986')).toBe('1986-01-02');
    expect(parseBhavcopyDate('1875-07-09')).toBe('1875-07-09');
    expect(parseBhavcopyDate(' 09/07/1875 ')).toBe('1875-07-09');
    expect(parseBhavcopyDate('01-02-0099')).toBe('0099-02-01');
  });

  it('rejects partial and impossible dates', () => {
    for (const date of ['1986', '1986-00-02', '1986-01-00', '31-04-1986', '1900-02-29', '0000-01-01', '01-02/1986']) {
      expect(parseBhavcopyDate(date)).toBeUndefined();
    }
    expect(parseBhavcopyDate('29-02-2000')).toBe('2000-02-29');
  });

  it('lays out a historical month with Monday as the first column', () => {
    expect(calendarMonth(1986, 1)).toEqual({ offset: 2, days: 31 });
    expect(calendarMonth(1875, 7)).toEqual({ offset: 3, days: 31 });
    expect(calendarMonth(1900, 2).days).toBe(28);
    expect(calendarMonth(2000, 2).days).toBe(29);
  });
});
