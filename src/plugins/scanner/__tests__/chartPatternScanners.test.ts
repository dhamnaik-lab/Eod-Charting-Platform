import { describe, expect, it } from 'vitest';
import { chartPatternScannerDefinitions, runChartPatternScanner } from '@/plugins/scanner/chartPatternScanners';
import type { EodBar, ScannerContext } from '@/plugins/scanner/types';

const definitions = Object.fromEntries(
  chartPatternScannerDefinitions.map((definition) => [definition.id, definition]),
);

describe('chart pattern gap scanners', () => {
  it('lists the first chart-pattern gap batch', () => {
    expect(Object.keys(definitions).sort()).toEqual([
      'chart_adam_eve_bottom',
      'chart_adam_eve_top',
      'chart_ascending_triangle',
      'chart_bear_flag',
      'chart_bear_pennant',
      'chart_blow_off_top',
      'chart_breakaway_gap',
      'chart_broadening_bottom',
      'chart_broadening_formation',
      'chart_bull_flag',
      'chart_bull_pennant',
      'chart_bump_run_bottom',
      'chart_bump_run_top',
      'chart_coil_volatility_squeeze',
      'chart_common_gap',
      'chart_complex_head_shoulders',
      'chart_cup_handle',
      'chart_descending_triangle',
      'chart_diamond_bottom',
      'chart_diamond_pattern',
      'chart_diamond_top',
      'chart_double_bottom',
      'chart_double_top',
      'chart_exhaustion_gap',
      'chart_falling_channel',
      'chart_falling_three_methods',
      'chart_falling_wedge_bottom',
      'chart_head_shoulders',
      'chart_high_tight_flag',
      'chart_horn_bottom',
      'chart_horn_top',
      'chart_inverse_head_shoulders',
      'chart_inverted_cup_handle',
      'chart_island_reversal_bottom',
      'chart_island_reversal_top',
      'chart_mat_hold_bearish',
      'chart_mat_hold_bullish',
      'chart_measured_move_down',
      'chart_measured_move_up',
      'chart_rectangle_range',
      'chart_rising_channel',
      'chart_rising_three_methods',
      'chart_rising_wedge_top',
      'chart_rounding_bottom',
      'chart_rounding_top',
      'chart_runaway_gap',
      'chart_scallop_handle',
      'chart_spike_top',
      'chart_symmetrical_triangle',
      'chart_three_falling_peaks',
      'chart_three_rising_valleys',
      'chart_triple_bottom',
      'chart_triple_top',
      'chart_v_bottom',
    ]);
  });

  it('matches common gaps in range-bound normal-volume context', () => {
    const result = run('chart_common_gap', [
      ...rangeBars(10),
      bar('2026-01-11', 102, 105, 98, 101, 100000),
      bar('2026-01-12', 106, 108, 104, 105, 105000),
    ]);

    expect(result?.direction).toBe('neutral');
    expect(result?.chartPattern?.family).toBe('gap');
    expect(result?.values?.gap_direction).toBe('up');
    expect(result?.chartPattern?.geometry?.family).toBe('gap-zone');
    expect(result?.chartPattern?.geometry?.zones?.map((zone) => zone.role)).toEqual(['gap']);
  });

  it('matches breakaway gaps through resistance on volume', () => {
    const base = Array.from({ length: 20 }, (_, index) =>
      bar(`2026-01-${String(index + 1).padStart(2, '0')}`, 100, 110, 95, 104, 100000),
    );

    const result = run('chart_breakaway_gap', [
      ...base,
      bar('2026-01-21', 103, 110, 99, 105, 100000),
      bar('2026-01-22', 116, 121, 115, 120, 180000),
    ]);

    expect(result?.direction).toBe('bullish');
    expect(result?.score).toBe(80);
    expect(result?.chartPattern?.breakoutLevel).toBe(110);
    expect(result?.chartPattern?.geometry?.family).toBe('gap-zone');
    expect(result?.chartPattern?.geometry?.zones).toHaveLength(1);
  });

  it('matches runaway gaps in an uptrend', () => {
    const trend = upTrendBars(20, '2026-02');
    const previous = bar('2026-02-21', 122, 125, 121, 124, 100000);
    const result = run('chart_runaway_gap', [
      ...trend,
      previous,
      bar('2026-02-22', 127, 132, 126, 131, 130000),
    ]);

    expect(result?.direction).toBe('bullish');
    expect(result?.values?.gap_pct).toBe(1.6);
    expect(result?.chartPattern?.geometry?.zones?.[0]).toMatchObject({ role: 'gap' });
  });

  it('matches exhaustion gaps after a strong uptrend', () => {
    const trend = upTrendBars(20, '2026-03');
    const previous = bar('2026-03-21', 130, 134, 128, 133, 100000);
    const result = run('chart_exhaustion_gap', [
      ...trend,
      previous,
      bar('2026-03-22', 138, 142, 132, 134, 250000),
    ]);

    expect(result?.direction).toBe('bearish');
    expect(result?.chartPattern?.resistanceLevel).toBe(142);
    expect(result?.chartPattern?.geometry?.family).toBe('gap-zone');
    expect(result?.chartPattern?.geometry?.zones?.[0]).toMatchObject({ role: 'gap' });
  });

  it('matches island reversal top and bottom structures', () => {
    const top = run('chart_island_reversal_top', [
      bar('2026-04-01', 100, 105, 98, 103),
      bar('2026-04-02', 108, 112, 107, 111),
      bar('2026-04-03', 110, 113, 108, 111),
      bar('2026-04-04', 109, 112, 107, 108),
      bar('2026-04-05', 104, 105, 98, 99),
    ]);

    const bottom = run('chart_island_reversal_bottom', [
      bar('2026-05-01', 100, 104, 96, 98),
      bar('2026-05-02', 92, 93, 88, 89),
      bar('2026-05-03', 90, 92, 86, 88),
      bar('2026-05-04', 89, 93, 87, 91),
      bar('2026-05-05', 96, 102, 95, 101),
    ]);

    expect(top?.direction).toBe('bearish');
    expect(top?.scannerName).toBe('Island Reversal (Top)');
    expect(top?.chartPattern?.geometry?.zones?.map((zone) => zone.role)).toEqual(['gap', 'island', 'gap']);
    expect(bottom?.direction).toBe('bullish');
    expect(bottom?.scannerName).toBe('Island Reversal (Bottom)');
    expect(bottom?.chartPattern?.geometry?.zones?.map((zone) => zone.role)).toEqual(['gap', 'island', 'gap']);
  });

  it('returns no result when the selected chart-pattern condition is absent', () => {
    expect(run('chart_breakaway_gap', [
      ...rangeBars(20),
      bar('2026-01-21', 100, 110, 95, 104, 100000),
      bar('2026-01-22', 111, 113, 108, 109, 100000),
    ])).toBeNull();
  });
});

describe('chart pattern basic reversal scanners', () => {
  it('matches double bottom and double top neckline breaks', () => {
    const doubleBottom = run('chart_double_bottom', [
      bar('2026-06-01', 122, 124, 118, 120),
      bar('2026-06-02', 118, 120, 112, 114),
      bar('2026-06-03', 114, 116, 108, 110),
      bar('2026-06-04', 110, 112, 96, 100),
      bar('2026-06-05', 100, 102, 92, 96),
      bar('2026-06-06', 95, 98, 90, 93),
      bar('2026-06-07', 94, 101, 92, 100),
      bar('2026-06-08', 100, 106, 98, 104),
      bar('2026-06-09', 104, 108, 101, 106),
      bar('2026-06-10', 105, 107, 98, 100),
      bar('2026-06-11', 100, 103, 94, 96),
      bar('2026-06-12', 96, 99, 91, 94),
      bar('2026-06-13', 95, 101, 93, 100),
      bar('2026-06-14', 100, 105, 98, 103),
      bar('2026-06-15', 103, 107, 101, 106),
      bar('2026-06-16', 107, 111, 106, 110),
    ]);

    const doubleTop = run('chart_double_top', [
      bar('2026-07-01', 80, 83, 78, 82),
      bar('2026-07-02', 83, 88, 82, 87),
      bar('2026-07-03', 88, 93, 87, 92),
      bar('2026-07-04', 92, 98, 90, 96),
      bar('2026-07-05', 96, 104, 95, 102),
      bar('2026-07-06', 102, 110, 100, 107),
      bar('2026-07-07', 106, 108, 99, 101),
      bar('2026-07-08', 101, 104, 94, 96),
      bar('2026-07-09', 96, 100, 93, 97),
      bar('2026-07-10', 98, 105, 96, 103),
      bar('2026-07-11', 103, 109, 101, 106),
      bar('2026-07-12', 106, 111, 104, 108),
      bar('2026-07-13', 107, 108, 99, 101),
      bar('2026-07-14', 100, 103, 95, 97),
      bar('2026-07-15', 96, 98, 91, 92),
    ]);

    expect(doubleBottom?.scannerName).toBe('Double Bottom (W)');
    expect(doubleBottom?.direction).toBe('bullish');
    expect(doubleBottom?.chartPattern?.necklineLevel).toBe(108);
    expect(doubleBottom?.chartPattern?.geometry?.family).toBe('double-top-bottom');
    expect(doubleBottom?.chartPattern?.geometry?.pivotMarkers).toHaveLength(2);
    expect(doubleBottom?.chartPattern?.geometry?.trendLines?.[0]).toMatchObject({
      role: 'neckline',
      start: { price: 108 },
      end: { date: '2026-06-16', price: 108 },
      extendRight: true,
    });
    expect(doubleTop?.scannerName).toBe('Double Top (M)');
    expect(doubleTop?.direction).toBe('bearish');
    expect(doubleTop?.chartPattern?.supportLevel).toBe(93);
    expect(doubleTop?.chartPattern?.geometry?.family).toBe('double-top-bottom');
    expect(doubleTop?.chartPattern?.geometry?.pivotMarkers).toHaveLength(2);
    expect(doubleTop?.chartPattern?.geometry?.trendLines?.[0]).toMatchObject({
      role: 'support',
      start: { price: 93 },
      end: { date: '2026-07-15', price: 93 },
      extendRight: true,
    });
  });

  it('matches triple bottom and triple top confirmations', () => {
    const tripleBottom = run('chart_triple_bottom', [
      bar('2026-08-01', 130, 132, 126, 128),
      bar('2026-08-02', 124, 126, 116, 118),
      bar('2026-08-03', 118, 121, 106, 110),
      bar('2026-08-04', 110, 114, 98, 102),
      bar('2026-08-05', 101, 104, 90, 95),
      bar('2026-08-06', 96, 108, 94, 106),
      bar('2026-08-07', 106, 112, 101, 110),
      bar('2026-08-08', 109, 111, 98, 100),
      bar('2026-08-09', 100, 103, 91, 95),
      bar('2026-08-10', 96, 108, 94, 106),
      bar('2026-08-11', 106, 113, 102, 111),
      bar('2026-08-12', 110, 112, 99, 101),
      bar('2026-08-13', 101, 104, 92, 96),
      bar('2026-08-14', 97, 109, 95, 107),
      bar('2026-08-15', 108, 112, 103, 109),
      bar('2026-08-16', 109, 113, 105, 111),
      bar('2026-08-17', 112, 116, 110, 115),
    ]);

    const tripleTop = run('chart_triple_top', [
      bar('2026-09-01', 70, 74, 68, 72),
      bar('2026-09-02', 74, 82, 73, 80),
      bar('2026-09-03', 80, 92, 78, 90),
      bar('2026-09-04', 90, 104, 88, 101),
      bar('2026-09-05', 101, 112, 99, 108),
      bar('2026-09-06', 107, 109, 96, 98),
      bar('2026-09-07', 98, 102, 91, 93),
      bar('2026-09-08', 94, 104, 93, 102),
      bar('2026-09-09', 102, 111, 100, 108),
      bar('2026-09-10', 108, 110, 96, 99),
      bar('2026-09-11', 99, 103, 90, 92),
      bar('2026-09-12', 93, 104, 92, 102),
      bar('2026-09-13', 102, 113, 100, 109),
      bar('2026-09-14', 108, 110, 95, 98),
      bar('2026-09-15', 98, 102, 94, 99),
      bar('2026-09-16', 99, 101, 93, 97),
      bar('2026-09-17', 96, 99, 87, 88),
    ]);

    expect(tripleBottom?.scannerName).toBe('Triple Bottom');
    expect(tripleBottom?.direction).toBe('bullish');
    expect(tripleBottom?.chartPattern?.geometry?.family).toBe('triple-top-bottom');
    expect(tripleBottom?.chartPattern?.geometry?.pivotMarkers).toHaveLength(3);
    expect(tripleBottom?.chartPattern?.geometry?.trendLines?.[0]).toMatchObject({
      role: 'neckline',
      end: { date: '2026-08-17' },
      extendRight: true,
    });
    expect(tripleTop?.scannerName).toBe('Triple Top');
    expect(tripleTop?.direction).toBe('bearish');
    expect(tripleTop?.chartPattern?.geometry?.family).toBe('triple-top-bottom');
    expect(tripleTop?.chartPattern?.geometry?.pivotMarkers).toHaveLength(3);
    expect(tripleTop?.chartPattern?.geometry?.trendLines?.[0]).toMatchObject({
      role: 'support',
      end: { date: '2026-09-17' },
      extendRight: true,
    });
  });

  it('matches V-bottom and spike-top reversals', () => {
    const vBottom = run('chart_v_bottom', [
      bar('2026-09-29', 130, 132, 126, 128),
      bar('2026-09-30', 126, 128, 122, 124),
      bar('2026-10-01', 120, 122, 118, 120),
      bar('2026-10-02', 116, 118, 112, 114),
      bar('2026-10-03', 112, 114, 108, 110),
      bar('2026-10-04', 108, 110, 104, 106),
      bar('2026-10-05', 104, 106, 100, 102),
      bar('2026-10-06', 100, 102, 96, 98),
      bar('2026-10-07', 96, 98, 92, 94),
      bar('2026-10-08', 94, 96, 88, 90),
      bar('2026-10-09', 91, 94, 84, 86),
      bar('2026-10-10', 87, 91, 82, 84),
      bar('2026-10-11', 84, 88, 78, 80),
      bar('2026-10-12', 82, 89, 76, 87),
      bar('2026-10-13', 88, 96, 86, 95),
    ]);

    const spikeTop = run('chart_spike_top', [
      bar('2026-10-29', 70, 73, 68, 70),
      bar('2026-10-30', 74, 77, 72, 75),
      bar('2026-11-01', 80, 83, 78, 80),
      bar('2026-11-02', 84, 87, 82, 85),
      bar('2026-11-03', 88, 91, 86, 90),
      bar('2026-11-04', 92, 96, 90, 94),
      bar('2026-11-05', 96, 100, 94, 98),
      bar('2026-11-06', 100, 104, 98, 102),
      bar('2026-11-07', 104, 108, 102, 106),
      bar('2026-11-08', 108, 112, 106, 110),
      bar('2026-11-09', 112, 118, 110, 116),
      bar('2026-11-10', 118, 126, 116, 124),
      bar('2026-11-11', 124, 132, 122, 130),
      bar('2026-11-12', 128, 134, 120, 122),
      bar('2026-11-13', 118, 119, 108, 110),
    ]);

    expect(vBottom?.scannerName).toBe('V-Bottom');
    expect(vBottom?.direction).toBe('bullish');
    expect(vBottom?.chartPattern?.geometry?.family).toBe('v-reversal');
    expect(vBottom?.chartPattern?.geometry?.pivotMarkers?.[0].label).toBe('V Low');
    expect(vBottom?.chartPattern?.geometry?.trendLines).toHaveLength(2);
    expect(spikeTop?.scannerName).toBe('Spike Top (V-Top)');
    expect(spikeTop?.direction).toBe('bearish');
    expect(spikeTop?.chartPattern?.geometry?.family).toBe('v-reversal');
    expect(spikeTop?.chartPattern?.geometry?.pivotMarkers?.[0].label).toBe('V High');
    expect(spikeTop?.chartPattern?.geometry?.trendLines).toHaveLength(2);
  });

  it('matches horn bottom and horn top structures', () => {
    const hornBottom = run('chart_horn_bottom', [
      bar('2026-11-29', 128, 130, 124, 126),
      bar('2026-11-30', 124, 126, 120, 122),
      bar('2026-12-01', 120, 122, 116, 118),
      bar('2026-12-02', 116, 118, 110, 112),
      bar('2026-12-03', 112, 114, 98, 104),
      bar('2026-12-04', 105, 111, 102, 110),
      bar('2026-12-05', 110, 115, 106, 113),
      bar('2026-12-06', 112, 114, 104, 106),
      bar('2026-12-07', 106, 109, 99, 102),
      bar('2026-12-08', 106, 112, 97, 108),
      bar('2026-12-09', 100, 110, 98, 108),
      bar('2026-12-10', 108, 113, 104, 111),
      bar('2026-12-11', 114, 119, 112, 118),
    ]);

    const hornTop = run('chart_horn_top', [
      bar('2026-12-30', 70, 74, 68, 72),
      bar('2026-12-31', 74, 78, 72, 76),
      bar('2027-01-01', 80, 84, 78, 82),
      bar('2027-01-02', 84, 92, 83, 90),
      bar('2027-01-03', 90, 106, 88, 100),
      bar('2027-01-04', 98, 101, 92, 94),
      bar('2027-01-05', 94, 98, 89, 91),
      bar('2027-01-06', 92, 101, 91, 99),
      bar('2027-01-07', 99, 109, 96, 104),
      bar('2027-01-08', 104, 106, 98, 100),
      bar('2027-01-09', 100, 103, 94, 97),
      bar('2027-01-10', 96, 101, 84, 86),
    ]);

    expect(hornBottom?.scannerName).toBe('Horn Bottom');
    expect(hornBottom?.direction).toBe('bullish');
    expect(hornBottom?.chartPattern?.geometry?.family).toBe('horn');
    expect(hornBottom?.chartPattern?.geometry?.pivotMarkers).toHaveLength(2);
    expect(hornBottom?.chartPattern?.geometry?.trendLines?.[0].role).toBe('neckline');
    expect(hornTop?.scannerName).toBe('Horn Top');
    expect(hornTop?.direction).toBe('bearish');
    expect(hornTop?.chartPattern?.geometry?.family).toBe('horn');
    expect(hornTop?.chartPattern?.geometry?.pivotMarkers).toHaveLength(2);
    expect(hornTop?.chartPattern?.geometry?.trendLines?.[0].role).toBe('support');
  });
});

describe('chart pattern structure scanners', () => {
  it('matches rectangle/range structures', () => {
    const result = run('chart_rectangle_range', [
      ...Array.from({ length: 20 }, (_value, index) => {
        const day = String(index + 1).padStart(2, '0');
        const high = index % 5 === 0 ? 110 : 106 + (index % 3);
        const low = index % 4 === 0 ? 100 : 101 + (index % 2);
        return bar(`2027-02-${day}`, 104, high, low, 105);
      }),
      bar('2027-02-21', 105, 108, 102, 106),
    ]);

    expect(result?.scannerName).toBe('Rectangle / Range');
    expect(result?.direction).toBe('neutral');
    expect(result?.chartPattern?.supportLevel).toBe(100);
    expect(result?.chartPattern?.resistanceLevel).toBe(110);
    expect(result?.chartPattern?.geometry?.family).toBe('range');
    expect(result?.chartPattern?.geometry?.trendLines?.map((line) => line.role)).toEqual(['support', 'resistance']);
    expect(result?.chartPattern?.geometry?.zones).toHaveLength(1);
  });

  it('matches ascending and descending triangle breakouts', () => {
    const ascending = run('chart_ascending_triangle', [
      bar('2027-03-01', 102, 105, 100, 103),
      bar('2027-03-02', 101, 104, 98, 100),
      bar('2027-03-03', 96, 102, 94, 98),
      bar('2027-03-04', 100, 106, 97, 104),
      bar('2027-03-05', 104, 110, 101, 108),
      bar('2027-03-06', 103, 108, 100, 104),
      bar('2027-03-07', 101, 106, 99, 102),
      bar('2027-03-08', 99, 105, 97, 101),
      bar('2027-03-09', 104, 108, 100, 106),
      bar('2027-03-10', 106, 110, 102, 109),
      bar('2027-03-11', 104, 107, 101, 103),
      bar('2027-03-12', 102, 106, 100, 102),
      bar('2027-03-13', 101, 105, 98.5, 103),
      bar('2027-03-14', 105, 109, 102, 107),
      bar('2027-03-15', 107, 110, 104, 109),
      bar('2027-03-16', 112, 114, 110, 113),
    ]);

    const descending = run('chart_descending_triangle', [
      bar('2027-04-01', 108, 110, 100, 106),
      bar('2027-04-02', 111, 114, 100, 112),
      bar('2027-04-03', 113, 116, 103, 115),
      bar('2027-04-04', 109, 112, 100, 104),
      bar('2027-04-05', 106, 110, 100, 103),
      bar('2027-04-06', 108, 112, 101, 111),
      bar('2027-04-07', 107, 111, 100, 103),
      bar('2027-04-08', 105, 109, 100, 102),
      bar('2027-04-09', 104, 108, 101, 107),
      bar('2027-04-10', 104, 107, 100, 102),
      bar('2027-04-11', 103, 106, 100, 102),
      bar('2027-04-12', 102, 105, 101, 104),
      bar('2027-04-13', 101, 104, 100, 101),
      bar('2027-04-14', 99, 101, 96, 97),
    ]);

    expect(ascending?.scannerName).toBe('Ascending Triangle');
    expect(ascending?.direction).toBe('bullish');
    expect(ascending?.chartPattern?.geometry?.family).toBe('triangle');
    expect(ascending?.chartPattern?.geometry?.trendLines?.map((line) => line.role)).toEqual(['resistance', 'lower']);
    expect(descending?.scannerName).toBe('Descending Triangle');
    expect(descending?.direction).toBe('bearish');
    expect(descending?.chartPattern?.geometry?.family).toBe('triangle');
    expect(descending?.chartPattern?.geometry?.trendLines?.map((line) => line.role)).toEqual(['upper', 'support']);
  });

  it('matches symmetrical triangle breakout', () => {
    const result = run('chart_symmetrical_triangle', [
      bar('2027-05-01', 106, 115, 100, 108),
      bar('2027-05-02', 110, 118, 96, 116),
      bar('2027-05-03', 116, 120, 94, 112),
      bar('2027-05-04', 110, 116, 92, 96),
      bar('2027-05-05', 96, 114, 90, 104),
      bar('2027-05-06', 104, 113, 94, 110),
      bar('2027-05-07', 110, 116, 96, 112),
      bar('2027-05-08', 108, 114, 95, 100),
      bar('2027-05-09', 100, 112, 94, 106),
      bar('2027-05-10', 106, 110, 96, 108),
      bar('2027-05-11', 108, 113, 98, 111),
      bar('2027-05-12', 109, 110, 99, 104),
      bar('2027-05-13', 104, 108, 98, 105),
      bar('2027-05-14', 114, 116, 112, 115),
    ]);

    expect(result?.scannerName).toBe('Symmetrical Triangle');
    expect(result?.direction).toBe('bullish');
    expect(result?.chartPattern?.geometry?.family).toBe('triangle');
    expect(result?.chartPattern?.geometry?.trendLines).toHaveLength(2);
    expect(result?.chartPattern?.geometry?.pivotMarkers?.length).toBeGreaterThanOrEqual(4);
  });
});

describe('chart pattern continuation scanners', () => {
  it('matches bull and bear flags', () => {
    const bullFlag = run('chart_bull_flag', [
      ...bullPole('2027-06'),
      bar('2027-06-08', 120, 122, 116, 118),
      bar('2027-06-09', 118, 120, 115, 117),
      bar('2027-06-10', 117, 119, 114, 116),
      bar('2027-06-11', 116, 118, 113, 115),
      bar('2027-06-12', 115, 117, 112, 114),
      bar('2027-06-13', 123, 126, 122, 125),
    ]);

    const bearFlag = run('chart_bear_flag', [
      ...bearPole('2027-07'),
      bar('2027-07-08', 90, 94, 88, 92),
      bar('2027-07-09', 92, 95, 89, 93),
      bar('2027-07-10', 93, 96, 90, 94),
      bar('2027-07-11', 94, 97, 91, 95),
      bar('2027-07-12', 95, 98, 92, 96),
      bar('2027-07-13', 88, 89, 84, 85),
    ]);

    expect(bullFlag?.scannerName).toBe('Bull Flag');
    expect(bullFlag?.direction).toBe('bullish');
    expect(bullFlag?.chartPattern?.geometry?.family).toBe('flag');
    expect(bullFlag?.chartPattern?.geometry?.trendLines?.map((line) => line.role)).toEqual([
      'pole',
      'upper',
      'lower',
    ]);
    expect(bearFlag?.scannerName).toBe('Bear Flag');
    expect(bearFlag?.direction).toBe('bearish');
    expect(bearFlag?.chartPattern?.geometry?.family).toBe('flag');
    expect(bearFlag?.chartPattern?.geometry?.trendLines).toHaveLength(3);
  });

  it('matches bull and bear pennants', () => {
    const bullPennant = run('chart_bull_pennant', [
      ...bullPole('2027-08'),
      bar('2027-08-08', 120, 124, 115, 119),
      bar('2027-08-09', 118, 123, 116, 120),
      bar('2027-08-10', 119, 122, 117, 120),
      bar('2027-08-11', 120, 121, 118, 120),
      bar('2027-08-12', 120, 120.5, 119, 120),
      bar('2027-08-13', 124, 127, 123, 126),
    ]);

    const bearPennant = run('chart_bear_pennant', [
      ...bearPole('2027-09'),
      bar('2027-09-08', 90, 96, 86, 91),
      bar('2027-09-09', 91, 95, 87, 90),
      bar('2027-09-10', 90, 94, 88, 90),
      bar('2027-09-11', 90, 93, 89, 90),
      bar('2027-09-12', 90, 92, 89.5, 90),
      bar('2027-09-13', 86, 87, 82, 83),
    ]);

    expect(bullPennant?.scannerName).toBe('Bull Pennant');
    expect(bullPennant?.direction).toBe('bullish');
    expect(bullPennant?.chartPattern?.geometry?.family).toBe('pennant');
    expect(bullPennant?.chartPattern?.geometry?.trendLines).toHaveLength(3);
    expect(bearPennant?.scannerName).toBe('Bear Pennant');
    expect(bearPennant?.direction).toBe('bearish');
    expect(bearPennant?.chartPattern?.geometry?.family).toBe('pennant');
    expect(bearPennant?.chartPattern?.geometry?.trendLines).toHaveLength(3);
  });

  it('matches rising and falling channels', () => {
    const risingChannel = run('chart_rising_channel', buildChannelFixture('2027-10', 'rising'));

    const fallingChannel = run('chart_falling_channel', buildChannelFixture('2027-11', 'falling'));

    expect(risingChannel?.scannerName).toBe('Rising Channel');
    expect(risingChannel?.direction).toBe('bullish');
    expect(risingChannel?.chartPattern?.geometry?.family).toBe('channel');
    expect(risingChannel?.chartPattern?.geometry?.trendLines).toHaveLength(3);
    expect(risingChannel?.chartPattern?.geometry?.trendLines?.map((line) => line.role)).toEqual([
      'support',
      'resistance',
      'midline',
    ]);
    expect(risingChannel?.chartPattern?.geometry?.trendLines?.[0].start.date).not.toBe(
      risingChannel?.chartPattern?.geometry?.trendLines?.[0].end.date,
    );
    expect(fallingChannel?.scannerName).toBe('Falling Channel');
    expect(fallingChannel?.direction).toBe('bearish');
    expect(fallingChannel?.chartPattern?.geometry?.family).toBe('channel');
    expect(fallingChannel?.chartPattern?.geometry?.trendLines).toHaveLength(3);
    expect(fallingChannel?.chartPattern?.geometry?.trendLines?.[2]?.role).toBe('midline');
    expect(fallingChannel?.chartPattern?.geometry?.trendLines?.[2]?.extendRight).toBe(false);
  });
});

function buildChannelFixture(monthPrefix: string, direction: 'rising' | 'falling') {
  return Array.from({ length: 36 }, (_value, index) => {
    const trend = direction === 'rising' ? 100 + index * 0.8 : 130 - index * 0.8;
    const wave = Math.sin((index * Math.PI) / 4) * 4;
    const open = trend + wave - 1;
    const close = trend + wave + 1;
    return bar(
      `${monthPrefix}-${String(index + 1).padStart(2, '0')}`,
      open,
      Math.max(open, close) + 4,
      Math.min(open, close) - 4,
      close,
    );
  });
}

describe('chart pattern remaining backlog scanners', () => {
  it('matches high tight flag and coil/squeeze setups', () => {
    const highTightFlag = run('chart_high_tight_flag', [
      bar('2027-12-01', 100, 105, 98, 102),
      bar('2027-12-02', 105, 118, 104, 116),
      bar('2027-12-03', 118, 132, 117, 130),
      bar('2027-12-04', 132, 148, 130, 146),
      bar('2027-12-05', 148, 165, 146, 162),
      bar('2027-12-06', 164, 182, 162, 180),
      bar('2027-12-07', 181, 198, 178, 195),
      bar('2027-12-08', 196, 210, 190, 205),
      bar('2027-12-09', 204, 209, 196, 200),
      bar('2027-12-10', 199, 205, 190, 194),
      bar('2027-12-11', 193, 198, 180, 188),
      bar('2027-12-12', 187, 194, 172, 182),
      bar('2027-12-13', 181, 190, 160, 176),
      bar('2027-12-14', 178, 192, 170, 188),
      bar('2027-12-15', 194, 202, 190, 200),
    ]);

    const coil = run('chart_coil_volatility_squeeze', [
      bar('2028-01-01', 100, 112, 92, 104),
      bar('2028-01-02', 103, 111, 93, 105),
      bar('2028-01-03', 104, 110, 95, 106),
      bar('2028-01-04', 105, 109, 97, 106),
      bar('2028-01-05', 106, 109, 99, 107),
      bar('2028-01-06', 107, 110, 102, 108),
      bar('2028-01-07', 108, 110, 104, 109),
      bar('2028-01-08', 109, 111, 106, 110),
      bar('2028-01-09', 110, 111, 107, 109),
    ]);

    expect(highTightFlag?.scannerName).toBe('High Tight Flag');
    expect(highTightFlag?.direction).toBe('bullish');
    expect(highTightFlag?.chartPattern?.geometry?.family).toBe('high-tight-flag');
    expect(highTightFlag?.chartPattern?.geometry?.pivotMarkers?.[0].label).toBe('Pullback Low');
    expect(highTightFlag?.chartPattern?.geometry?.trendLines).toHaveLength(4);
    expect(coil?.scannerName).toBe('Coil / Volatility Squeeze');
    expect(coil?.direction).toBe('neutral');
    expect(coil?.chartPattern?.geometry?.family).toBe('coil');
    expect(coil?.chartPattern?.geometry?.trendLines?.map((line) => line.role)).toEqual(['upper', 'lower']);
    expect(coil?.chartPattern?.geometry?.zones).toHaveLength(1);
  });

  it('matches three rising valleys and three falling peaks', () => {
    const risingValleys = run('chart_three_rising_valleys', [
      bar('2028-02-01', 120, 122, 116, 118),
      bar('2028-02-02', 116, 118, 108, 110),
      bar('2028-02-03', 110, 112, 98, 102),
      bar('2028-02-04', 103, 108, 100, 106),
      bar('2028-02-05', 107, 115, 104, 113),
      bar('2028-02-06', 112, 114, 105, 107),
      bar('2028-02-07', 108, 112, 102, 104),
      bar('2028-02-08', 105, 112, 103, 110),
      bar('2028-02-09', 111, 118, 108, 116),
      bar('2028-02-10', 115, 117, 110, 112),
      bar('2028-02-11', 112, 115, 106, 108),
      bar('2028-02-12', 109, 116, 107, 114),
      bar('2028-02-13', 116, 121, 114, 120),
      bar('2028-02-14', 118, 122, 115, 119),
      bar('2028-02-15', 123, 126, 122, 125),
    ]);

    const fallingPeaks = run('chart_three_falling_peaks', [
      bar('2028-03-01', 80, 86, 78, 84),
      bar('2028-03-02', 84, 96, 82, 94),
      bar('2028-03-03', 94, 112, 92, 108),
      bar('2028-03-04', 106, 110, 100, 102),
      bar('2028-03-05', 101, 105, 94, 96),
      bar('2028-03-06', 97, 108, 95, 106),
      bar('2028-03-07', 105, 109, 99, 101),
      bar('2028-03-08', 100, 104, 92, 94),
      bar('2028-03-09', 95, 104, 93, 102),
      bar('2028-03-10', 101, 105, 96, 98),
      bar('2028-03-11', 97, 101, 90, 92),
      bar('2028-03-12', 92, 96, 88, 90),
      bar('2028-03-13', 89, 91, 82, 84),
      bar('2028-03-14', 84, 86, 78, 80),
    ]);

    expect(risingValleys?.scannerName).toBe('Three Rising Valleys');
    expect(risingValleys?.direction).toBe('bullish');
    expect(risingValleys?.chartPattern?.geometry?.family).toBe('three-pivot');
    expect(risingValleys?.chartPattern?.geometry?.pivotMarkers?.map((marker) => marker.label)).toEqual([
      'Valley 1',
      'Valley 2',
      'Valley 3',
    ]);
    expect(risingValleys?.chartPattern?.geometry?.trendLines?.[2].role).toBe('resistance');
    expect(fallingPeaks?.scannerName).toBe('Three Falling Peaks');
    expect(fallingPeaks?.direction).toBe('bearish');
    expect(fallingPeaks?.chartPattern?.geometry?.family).toBe('three-pivot');
    expect(fallingPeaks?.chartPattern?.geometry?.pivotMarkers?.map((marker) => marker.label)).toEqual([
      'Peak 1',
      'Peak 2',
      'Peak 3',
    ]);
    expect(fallingPeaks?.chartPattern?.geometry?.trendLines?.[2].role).toBe('support');
  });

  it('matches measured move up and measured move down', () => {
    const measuredUp = run('chart_measured_move_up', [
      bar('2028-04-01', 100, 103, 99, 101),
      bar('2028-04-02', 102, 107, 101, 106),
      bar('2028-04-03', 106, 112, 105, 111),
      bar('2028-04-04', 111, 117, 110, 116),
      bar('2028-04-05', 116, 122, 115, 121),
      bar('2028-04-06', 120, 122, 116, 118),
      bar('2028-04-07', 118, 120, 114, 116),
      bar('2028-04-08', 116, 118, 113, 115),
      bar('2028-04-09', 115, 119, 114, 118),
      bar('2028-04-10', 118, 121, 117, 120),
      bar('2028-04-11', 121, 125, 120, 124),
      bar('2028-04-12', 124, 130, 123, 129),
      bar('2028-04-13', 129, 136, 128, 135),
      bar('2028-04-14', 135, 141, 134, 140),
      bar('2028-04-15', 140, 147, 139, 146),
    ]);

    const measuredDown = run('chart_measured_move_down', [
      bar('2028-05-01', 140, 142, 137, 139),
      bar('2028-05-02', 138, 139, 132, 133),
      bar('2028-05-03', 133, 134, 126, 127),
      bar('2028-05-04', 127, 128, 121, 122),
      bar('2028-05-05', 122, 123, 115, 116),
      bar('2028-05-06', 117, 122, 116, 120),
      bar('2028-05-07', 120, 124, 119, 123),
      bar('2028-05-08', 123, 126, 122, 124),
      bar('2028-05-09', 124, 125, 120, 122),
      bar('2028-05-10', 122, 123, 118, 119),
      bar('2028-05-11', 118, 119, 112, 113),
      bar('2028-05-12', 113, 114, 106, 107),
      bar('2028-05-13', 107, 108, 100, 101),
      bar('2028-05-14', 101, 102, 94, 95),
      bar('2028-05-15', 95, 96, 88, 89),
    ]);

    expect(measuredUp?.scannerName).toBe('Measured Move Up');
    expect(measuredUp?.direction).toBe('bullish');
    expect(measuredUp?.chartPattern?.geometry?.family).toBe('measured-move');
    expect(measuredUp?.chartPattern?.geometry?.pivotMarkers?.map((marker) => marker.label)).toEqual(['A', 'B', 'C', 'D']);
    expect(measuredUp?.chartPattern?.geometry?.trendLines?.[3].role).toBe('resistance');
    expect(measuredDown?.scannerName).toBe('Measured Move Down');
    expect(measuredDown?.direction).toBe('bearish');
    expect(measuredDown?.chartPattern?.geometry?.family).toBe('measured-move');
    expect(measuredDown?.chartPattern?.geometry?.trendLines?.[3].role).toBe('support');
  });
});

describe('chart pattern final CP6 scanners', () => {
  it('matches bump-and-run bottom, bump-and-run top, and blow-off top', () => {
    const bumpRunBottom = run('chart_bump_run_bottom', [
      ...bumpRunBottomBars('2029-11'),
      bar('2029-11-20', 68, 78, 66, 76),
    ]);

    const bumpRunTop = run('chart_bump_run_top', [
      ...bumpRunTopBars('2029-12'),
      bar('2029-12-20', 132, 134, 122, 124),
    ]);

    const blowOffTop = run('chart_blow_off_top', [
      ...Array.from({ length: 15 }, (_value, index) => {
        const price = 100 + index * 2;
        return bar(`2030-01-${String(index + 1).padStart(2, '0')}`, price, price + 5, price - 2, price + 4, 100000);
      }),
      bar('2030-01-16', 132, 145, 118, 120, 260000),
    ]);

    expect(bumpRunBottom?.scannerName).toBe('Bump-and-Run Bottom');
    expect(bumpRunBottom?.direction).toBe('bullish');
    expect(bumpRunBottom?.chartPattern?.geometry?.family).toBe('bump-and-run');
    expect(bumpRunBottom?.chartPattern?.geometry?.pivotMarkers?.[0].label).toBe('Bump Low');
    expect(bumpRunBottom?.chartPattern?.geometry?.trendLines?.map((line) => line.label)).toEqual([
      'Lead-in',
      'Bump',
      'Run',
    ]);
    expect(bumpRunTop?.scannerName).toBe('Bump-and-Run Top');
    expect(bumpRunTop?.direction).toBe('bearish');
    expect(bumpRunTop?.chartPattern?.geometry?.family).toBe('bump-and-run');
    expect(bumpRunTop?.chartPattern?.geometry?.pivotMarkers?.[0].label).toBe('Bump High');
    expect(bumpRunTop?.chartPattern?.geometry?.trendLines).toHaveLength(3);
    expect(blowOffTop?.scannerName).toBe('Blow-off Top');
    expect(blowOffTop?.direction).toBe('bearish');
    expect(blowOffTop?.chartPattern?.geometry?.family).toBe('blow-off');
    expect(blowOffTop?.chartPattern?.geometry?.pivotMarkers?.[0].label).toBe('Spike High');
    expect(blowOffTop?.chartPattern?.geometry?.trendLines?.map((line) => line.role)).toEqual([
      'generic',
      'generic',
      'support',
    ]);
  });

  it('matches three methods and mat hold continuation patterns', () => {
    const risingThree = run('chart_rising_three_methods', [
      bar('2030-02-01', 100, 116, 98, 114),
      bar('2030-02-02', 113, 115, 108, 110),
      bar('2030-02-03', 110, 113, 106, 108),
      bar('2030-02-04', 108, 112, 105, 109),
      bar('2030-02-05', 112, 120, 111, 118),
    ]);

    const fallingThree = run('chart_falling_three_methods', [
      bar('2030-03-01', 120, 122, 104, 106),
      bar('2030-03-02', 107, 114, 106, 112),
      bar('2030-03-03', 112, 116, 108, 114),
      bar('2030-03-04', 114, 118, 110, 112),
      bar('2030-03-05', 110, 111, 100, 102),
    ]);

    const matHoldBullish = run('chart_mat_hold_bullish', [
      bar('2030-04-01', 100, 116, 98, 114),
      bar('2030-04-02', 113, 118, 102, 110),
      bar('2030-04-03', 110, 116, 103, 108),
      bar('2030-04-04', 108, 115, 104, 112),
      bar('2030-04-05', 116, 122, 115, 120),
    ]);

    const matHoldBearish = run('chart_mat_hold_bearish', [
      bar('2030-05-01', 120, 122, 104, 106),
      bar('2030-05-02', 107, 118, 105, 112),
      bar('2030-05-03', 112, 117, 106, 110),
      bar('2030-05-04', 110, 116, 105, 108),
      bar('2030-05-05', 104, 105, 98, 100),
    ]);

    expect(risingThree?.scannerName).toBe('Rising Three Methods');
    expect(risingThree?.direction).toBe('bullish');
    expect(risingThree?.chartPattern?.geometry?.family).toBe('candle-continuation');
    expect(risingThree?.chartPattern?.geometry?.trendLines?.[3].role).toBe('resistance');
    expect(fallingThree?.scannerName).toBe('Falling Three Methods');
    expect(fallingThree?.direction).toBe('bearish');
    expect(fallingThree?.chartPattern?.geometry?.family).toBe('candle-continuation');
    expect(fallingThree?.chartPattern?.geometry?.trendLines?.[3].role).toBe('support');
    expect(matHoldBullish?.scannerName).toBe('Mat Hold (Bullish)');
    expect(matHoldBullish?.direction).toBe('bullish');
    expect(matHoldBullish?.chartPattern?.geometry?.family).toBe('candle-continuation');
    expect(matHoldBullish?.chartPattern?.geometry?.trendLines).toHaveLength(5);
    expect(matHoldBearish?.scannerName).toBe('Mat Hold (Bearish)');
    expect(matHoldBearish?.direction).toBe('bearish');
    expect(matHoldBearish?.chartPattern?.geometry?.family).toBe('candle-continuation');
    expect(matHoldBearish?.chartPattern?.geometry?.trendLines?.[4].role).toBe('support');
  });
});

describe('chart pattern advanced geometry scanners', () => {
  it('matches falling wedge bottom and rising wedge top', () => {
    const fallingWedge = run('chart_falling_wedge_bottom', [
      ...fallingWedgeBars('2029-04'),
      bar('2029-04-18', 102, 108, 100, 106),
    ]);

    const risingWedge = run('chart_rising_wedge_top', [
      ...risingWedgeBars('2029-05'),
      bar('2029-05-18', 106, 108, 102, 104),
    ]);

    expect(fallingWedge?.scannerName).toBe('Falling Wedge (Bottom)');
    expect(fallingWedge?.direction).toBe('bullish');
    expect(fallingWedge?.chartPattern?.geometry?.family).toBe('wedge');
    expect(fallingWedge?.chartPattern?.geometry?.trendLines?.map((line) => line.role)).toEqual([
      'upper',
      'lower',
    ]);
    expect(risingWedge?.scannerName).toBe('Rising Wedge (Top)');
    expect(risingWedge?.direction).toBe('bearish');
    expect(risingWedge?.chartPattern?.geometry?.family).toBe('wedge');
    expect(risingWedge?.chartPattern?.geometry?.trendLines).toHaveLength(2);
  });

  it('matches diamond bottom, diamond top, and unresolved diamond pattern', () => {
    const diamondBottom = run('chart_diamond_bottom', [
      ...diamondBars('2029-06'),
      bar('2029-06-19', 121, 126, 118, 124),
    ]);

    const diamondTop = run('chart_diamond_top', [
      ...diamondBars('2029-07'),
      bar('2029-07-19', 94, 96, 88, 90),
    ]);

    const diamondPattern = run('chart_diamond_pattern', [
      ...diamondBars('2029-08'),
      bar('2029-08-19', 108, 112, 104, 108),
    ]);

    expect(diamondBottom?.scannerName).toBe('Diamond Bottom');
    expect(diamondBottom?.direction).toBe('bullish');
    expect(diamondBottom?.chartPattern?.geometry?.family).toBe('diamond');
    expect(diamondBottom?.chartPattern?.geometry?.trendLines).toHaveLength(4);
    expect(diamondTop?.scannerName).toBe('Diamond Top');
    expect(diamondTop?.direction).toBe('bearish');
    expect(diamondTop?.chartPattern?.geometry?.family).toBe('diamond');
    expect(diamondTop?.chartPattern?.geometry?.pivotMarkers).toHaveLength(2);
    expect(diamondPattern?.scannerName).toBe('Diamond Pattern');
    expect(diamondPattern?.direction).toBe('neutral');
    expect(diamondPattern?.chartPattern?.geometry?.family).toBe('diamond');
  });

  it('matches broadening bottom and unresolved broadening formation', () => {
    const broadeningBottom = run('chart_broadening_bottom', [
      ...broadeningBars('2029-09'),
      bar('2029-09-18', 120, 126, 116, 124),
    ]);

    const broadeningFormation = run('chart_broadening_formation', [
      ...broadeningBars('2029-10'),
      bar('2029-10-18', 98, 104, 92, 100),
    ]);

    expect(broadeningBottom?.scannerName).toBe('Broadening Bottom');
    expect(broadeningBottom?.direction).toBe('bullish');
    expect(broadeningBottom?.chartPattern?.geometry?.family).toBe('broadening');
    expect(broadeningBottom?.chartPattern?.geometry?.trendLines).toHaveLength(2);
    expect(broadeningFormation?.scannerName).toBe('Broadening Formation');
    expect(broadeningFormation?.direction).toBe('neutral');
    expect(broadeningFormation?.chartPattern?.geometry?.family).toBe('broadening');
  });
});

describe('chart pattern complex base scanners', () => {
  it('matches head and shoulders and inverse head and shoulders', () => {
    const headShoulders = run('chart_head_shoulders', [
      bar('2028-06-01', 88, 92, 86, 90),
      bar('2028-06-02', 90, 96, 88, 94),
      bar('2028-06-03', 94, 104, 92, 101),
      bar('2028-06-04', 101, 110, 99, 106),
      bar('2028-06-05', 105, 108, 96, 98),
      bar('2028-06-06', 98, 103, 92, 95),
      bar('2028-06-07', 96, 112, 95, 110),
      bar('2028-06-08', 110, 124, 108, 120),
      bar('2028-06-09', 118, 121, 104, 106),
      bar('2028-06-10', 106, 111, 94, 96),
      bar('2028-06-11', 98, 108, 96, 106),
      bar('2028-06-12', 106, 112, 102, 108),
      bar('2028-06-13', 104, 108, 98, 100),
      bar('2028-06-14', 100, 104, 96, 98),
      bar('2028-06-15', 98, 101, 93, 95),
      bar('2028-06-16', 94, 98, 89, 91),
    ]);

    const inverseHeadShoulders = run('chart_inverse_head_shoulders', [
      bar('2028-07-01', 122, 124, 118, 120),
      bar('2028-07-02', 120, 122, 114, 116),
      bar('2028-07-03', 116, 118, 106, 109),
      bar('2028-07-04', 109, 111, 100, 104),
      bar('2028-07-05', 105, 118, 104, 116),
      bar('2028-07-06', 116, 121, 112, 119),
      bar('2028-07-07', 118, 120, 96, 100),
      bar('2028-07-08', 100, 102, 82, 86),
      bar('2028-07-09', 88, 103, 86, 101),
      bar('2028-07-10', 101, 113, 98, 111),
      bar('2028-07-11', 110, 112, 104, 106),
      bar('2028-07-12', 106, 108, 101, 103),
      bar('2028-07-13', 103, 108, 98, 104),
      bar('2028-07-14', 106, 116, 104, 114),
      bar('2028-07-15', 114, 119, 112, 117),
      bar('2028-07-16', 118, 124, 116, 122),
      bar('2028-07-17', 123, 128, 121, 126),
    ]);

    expect(headShoulders?.scannerName).toBe('Head & Shoulders');
    expect(headShoulders?.direction).toBe('bearish');
    expect(headShoulders?.chartPattern?.geometry?.family).toBe('head-and-shoulders');
    expect(headShoulders?.chartPattern?.geometry?.pivotMarkers?.map((marker) => marker.label)).toEqual([
      'LS',
      'N1',
      'H',
      'N2',
      'RS',
    ]);
    expect(headShoulders?.chartPattern?.geometry?.trendLines?.[0]).toMatchObject({
      role: 'neckline',
      start: { date: '2028-06-06', price: 92 },
      end: { date: '2028-06-10', price: 94 },
      extendRight: true,
    });
    expect(inverseHeadShoulders?.scannerName).toBe('Inv. Head & Shoulders');
    expect(inverseHeadShoulders?.direction).toBe('bullish');
    expect(inverseHeadShoulders?.chartPattern?.geometry?.family).toBe('head-and-shoulders');
    expect(inverseHeadShoulders?.chartPattern?.geometry?.pivotMarkers?.map((marker) => marker.label)).toEqual([
      'LS',
      'N1',
      'H',
      'N2',
      'RS',
    ]);
    expect(inverseHeadShoulders?.chartPattern?.geometry?.trendLines?.[0]).toMatchObject({
      role: 'neckline',
      start: { date: '2028-07-06', price: 121 },
      end: { date: '2028-07-10', price: 113 },
      extendRight: true,
    });
  });

  it('matches cup and handle and inverted cup and handle', () => {
    const cupHandle = run('chart_cup_handle', [
      bar('2028-08-01', 98, 102, 97, 100),
      bar('2028-08-02', 100, 101, 92, 94),
      bar('2028-08-03', 94, 96, 86, 88),
      bar('2028-08-04', 88, 90, 78, 82),
      bar('2028-08-05', 82, 86, 74, 78),
      bar('2028-08-06', 78, 84, 73, 80),
      bar('2028-08-07', 80, 88, 76, 86),
      bar('2028-08-08', 86, 94, 84, 92),
      bar('2028-08-09', 92, 98, 90, 96),
      bar('2028-08-10', 96, 101, 94, 99),
      bar('2028-08-11', 99, 102, 96, 100),
      bar('2028-08-12', 100, 102, 97, 100),
      bar('2028-08-13', 99, 102, 96, 100),
      bar('2028-08-14', 99, 101, 94, 96),
      bar('2028-08-15', 96, 99, 92, 94),
      bar('2028-08-16', 94, 100, 93, 98),
      bar('2028-08-17', 98, 101, 96, 99),
      bar('2028-08-18', 102, 108, 101, 106),
    ]);

    const invertedCupHandle = run('chart_inverted_cup_handle', [
      bar('2028-09-01', 102, 104, 98, 100),
      bar('2028-09-02', 100, 108, 99, 106),
      bar('2028-09-03', 106, 116, 104, 112),
      bar('2028-09-04', 112, 124, 110, 120),
      bar('2028-09-05', 120, 128, 116, 124),
      bar('2028-09-06', 124, 129, 118, 122),
      bar('2028-09-07', 122, 126, 112, 116),
      bar('2028-09-08', 116, 118, 104, 108),
      bar('2028-09-09', 108, 112, 104, 104),
      bar('2028-09-10', 104, 108, 100, 101),
      bar('2028-09-11', 101, 105, 98, 100),
      bar('2028-09-12', 100, 104, 98, 100),
      bar('2028-09-13', 100, 104, 98, 100),
      bar('2028-09-14', 101, 108, 100, 104),
      bar('2028-09-15', 104, 110, 102, 106),
      bar('2028-09-16', 106, 108, 100, 102),
      bar('2028-09-17', 102, 104, 98, 101),
      bar('2028-09-18', 98, 100, 92, 94),
    ]);

    expect(cupHandle?.scannerName).toBe('Cup and Handle');
    expect(cupHandle?.direction).toBe('bullish');
    expect(cupHandle?.chartPattern?.geometry?.family).toBe('cup-handle');
    expect(cupHandle?.chartPattern?.geometry?.trendLines).toHaveLength(3);
    expect(cupHandle?.chartPattern?.geometry?.pivotMarkers?.[0].label).toBe('Cup Low');
    expect(invertedCupHandle?.scannerName).toBe('Inverted Cup & Handle');
    expect(invertedCupHandle?.direction).toBe('bearish');
    expect(invertedCupHandle?.chartPattern?.geometry?.family).toBe('cup-handle');
    expect(invertedCupHandle?.chartPattern?.geometry?.pivotMarkers?.[0].label).toBe('Cup High');
  });

  it('matches rounding bottom and rounding top', () => {
    const roundingBottom = run('chart_rounding_bottom', [
      bar('2028-10-01', 100, 104, 98, 102),
      bar('2028-10-02', 101, 103, 97, 100),
      bar('2028-10-03', 100, 102, 96, 99),
      bar('2028-10-04', 99, 101, 95, 98),
      bar('2028-10-05', 98, 100, 94, 97),
      bar('2028-10-06', 97, 100, 94, 98),
      bar('2028-10-07', 96, 98, 84, 88),
      bar('2028-10-08', 88, 92, 78, 82),
      bar('2028-10-09', 82, 88, 76, 80),
      bar('2028-10-10', 80, 88, 76, 84),
      bar('2028-10-11', 84, 94, 82, 90),
      bar('2028-10-12', 90, 98, 88, 96),
      bar('2028-10-13', 96, 102, 94, 99),
      bar('2028-10-14', 98, 104, 96, 101),
      bar('2028-10-15', 101, 105, 99, 102),
      bar('2028-10-16', 102, 106, 100, 103),
      bar('2028-10-17', 103, 107, 101, 104),
      bar('2028-10-18', 106, 112, 105, 110),
    ]);

    const roundingTop = run('chart_rounding_top', [
      bar('2028-11-01', 100, 104, 98, 102),
      bar('2028-11-02', 101, 105, 99, 103),
      bar('2028-11-03', 102, 106, 100, 104),
      bar('2028-11-04', 103, 107, 101, 105),
      bar('2028-11-05', 102, 106, 100, 103),
      bar('2028-11-06', 101, 105, 99, 102),
      bar('2028-11-07', 104, 116, 102, 112),
      bar('2028-11-08', 112, 124, 110, 120),
      bar('2028-11-09', 120, 128, 116, 124),
      bar('2028-11-10', 124, 128, 116, 120),
      bar('2028-11-11', 120, 122, 108, 112),
      bar('2028-11-12', 112, 114, 104, 108),
      bar('2028-11-13', 108, 110, 102, 105),
      bar('2028-11-14', 105, 108, 100, 103),
      bar('2028-11-15', 103, 106, 99, 102),
      bar('2028-11-16', 102, 105, 98, 101),
      bar('2028-11-17', 101, 104, 97, 100),
      bar('2028-11-18', 96, 99, 90, 94),
    ]);

    expect(roundingBottom?.scannerName).toBe('Rounding Bottom');
    expect(roundingBottom?.direction).toBe('bullish');
    expect(roundingBottom?.chartPattern?.geometry?.family).toBe('rounding');
    expect(roundingBottom?.chartPattern?.geometry?.trendLines).toHaveLength(3);
    expect(roundingTop?.scannerName).toBe('Rounding Top (Arch)');
    expect(roundingTop?.direction).toBe('bearish');
    expect(roundingTop?.chartPattern?.geometry?.family).toBe('rounding');
    expect(roundingTop?.chartPattern?.geometry?.pivotMarkers?.[0].label).toBe('Arch High');
  });

  it('matches Adam and Eve bottom and Adam and Eve top', () => {
    const adamEveBottom = run('chart_adam_eve_bottom', [
      bar('2028-12-01', 100, 104, 98, 102),
      bar('2028-12-02', 102, 105, 96, 98),
      bar('2028-12-03', 98, 100, 92, 94),
      bar('2028-12-04', 92, 96, 80, 84),
      bar('2028-12-05', 84, 98, 90, 96),
      bar('2028-12-06', 96, 106, 94, 104),
      bar('2028-12-07', 104, 108, 96, 100),
      bar('2028-12-08', 100, 104, 92, 96),
      bar('2028-12-09', 96, 100, 88, 90),
      bar('2028-12-10', 90, 96, 86, 88),
      bar('2028-12-11', 88, 94, 82, 86),
      bar('2028-12-12', 86, 98, 86, 96),
      bar('2028-12-13', 96, 102, 90, 100),
      bar('2028-12-14', 100, 106, 96, 104),
      bar('2028-12-15', 104, 110, 100, 108),
      bar('2028-12-16', 110, 114, 108, 112),
    ]);

    const adamEveTop = run('chart_adam_eve_top', [
      bar('2029-01-01', 100, 104, 96, 102),
      bar('2029-01-02', 102, 110, 100, 108),
      bar('2029-01-03', 108, 118, 106, 116),
      bar('2029-01-04', 116, 130, 114, 126),
      bar('2029-01-05', 126, 118, 108, 112),
      bar('2029-01-06', 112, 116, 100, 104),
      bar('2029-01-07', 104, 112, 98, 108),
      bar('2029-01-08', 108, 118, 104, 114),
      bar('2029-01-09', 114, 122, 106, 118),
      bar('2029-01-10', 118, 124, 108, 120),
      bar('2029-01-11', 120, 128, 110, 124),
      bar('2029-01-12', 124, 122, 106, 112),
      bar('2029-01-13', 112, 116, 100, 104),
      bar('2029-01-14', 104, 108, 96, 100),
      bar('2029-01-15', 100, 104, 94, 98),
      bar('2029-01-16', 96, 100, 88, 92),
    ]);

    expect(adamEveBottom?.scannerName).toBe('Adam & Eve Bottom');
    expect(adamEveBottom?.direction).toBe('bullish');
    expect(adamEveBottom?.chartPattern?.geometry?.family).toBe('adam-eve');
    expect(adamEveBottom?.chartPattern?.geometry?.pivotMarkers?.map((marker) => marker.label)).toEqual(['Adam', 'Eve']);
    expect(adamEveBottom?.chartPattern?.geometry?.trendLines?.[0].role).toBe('neckline');
    expect(adamEveTop?.scannerName).toBe('Adam & Eve Top');
    expect(adamEveTop?.direction).toBe('bearish');
    expect(adamEveTop?.chartPattern?.geometry?.family).toBe('adam-eve');
    expect(adamEveTop?.chartPattern?.geometry?.trendLines?.[0].role).toBe('support');
  });

  it('matches scallop and handle and complex H&S', () => {
    const scallopHandle = run('chart_scallop_handle', [
      bar('2029-02-01', 98, 102, 96, 100),
      bar('2029-02-02', 100, 101, 92, 94),
      bar('2029-02-03', 94, 96, 86, 88),
      bar('2029-02-04', 88, 92, 82, 86),
      bar('2029-02-05', 86, 90, 82, 88),
      bar('2029-02-06', 88, 96, 86, 94),
      bar('2029-02-07', 94, 102, 92, 100),
      bar('2029-02-08', 100, 106, 98, 104),
      bar('2029-02-09', 104, 110, 102, 108),
      bar('2029-02-10', 108, 114, 106, 112),
      bar('2029-02-11', 112, 116, 108, 114),
      bar('2029-02-12', 114, 118, 110, 116),
      bar('2029-02-13', 116, 118, 110, 112),
      bar('2029-02-14', 112, 116, 106, 108),
      bar('2029-02-15', 108, 114, 104, 110),
      bar('2029-02-16', 110, 116, 108, 114),
      bar('2029-02-17', 114, 117, 109, 113),
      bar('2029-02-18', 118, 122, 116, 120),
    ]);

    const complexHeadShoulders = run('chart_complex_head_shoulders', [
      bar('2029-02-24', 82, 88, 80, 86),
      bar('2029-02-25', 86, 92, 84, 90),
      bar('2029-02-26', 88, 94, 86, 92),
      bar('2029-02-27', 92, 100, 90, 96),
      bar('2029-02-28', 96, 108, 94, 104),
      bar('2029-03-01', 104, 112, 100, 106),
      bar('2029-03-02', 106, 106, 96, 100),
      bar('2029-03-03', 100, 104, 94, 98),
      bar('2029-03-04', 98, 115, 96, 110),
      bar('2029-03-05', 110, 112, 96, 100),
      bar('2029-03-06', 100, 106, 94, 100),
      bar('2029-03-07', 100, 130, 98, 124),
      bar('2029-03-08', 104, 112, 98, 104),
      bar('2029-03-09', 104, 108, 94, 102),
      bar('2029-03-10', 102, 116, 100, 112),
      bar('2029-03-11', 104, 108, 96, 100),
      bar('2029-03-12', 100, 106, 94, 102),
      bar('2029-03-13', 102, 113, 98, 110),
      bar('2029-03-14', 110, 112, 95, 100),
      bar('2029-03-15', 100, 104, 94, 96),
      bar('2029-03-16', 96, 102, 90, 92),
      bar('2029-03-17', 92, 100, 88, 90),
    ]);

    expect(scallopHandle?.scannerName).toBe('Scallop & Handle');
    expect(scallopHandle?.direction).toBe('bullish');
    expect(scallopHandle?.chartPattern?.geometry?.family).toBe('scallop-handle');
    expect(scallopHandle?.chartPattern?.geometry?.pivotMarkers?.[0].label).toBe('Scallop Low');
    expect(scallopHandle?.chartPattern?.geometry?.trendLines).toHaveLength(4);
    expect(complexHeadShoulders?.scannerName).toBe('Complex H&S');
    expect(complexHeadShoulders?.direction).toBe('bearish');
    expect(complexHeadShoulders?.chartPattern?.geometry?.family).toBe('complex-head-and-shoulders');
    expect(complexHeadShoulders?.chartPattern?.geometry?.pivotMarkers).toHaveLength(5);
    expect(complexHeadShoulders?.chartPattern?.geometry?.pivotMarkers?.some((marker) => marker.label === 'Head')).toBe(true);
    expect(complexHeadShoulders?.chartPattern?.geometry?.trendLines?.[0].role).toBe('neckline');
  });

  it('encloses outer pivot extremes in reversal-base zones and rejects shallow or flat false positives', () => {
    const tripleTop = run('chart_triple_top', [
      bar('2026-09-01', 70, 74, 68, 72),
      bar('2026-09-02', 74, 82, 73, 80),
      bar('2026-09-03', 80, 92, 78, 90),
      bar('2026-09-04', 90, 104, 88, 101),
      bar('2026-09-05', 101, 112, 99, 108),
      bar('2026-09-06', 107, 109, 96, 98),
      bar('2026-09-07', 98, 102, 91, 93),
      bar('2026-09-08', 94, 104, 93, 102),
      bar('2026-09-09', 102, 111, 100, 108),
      bar('2026-09-10', 108, 110, 96, 99),
      bar('2026-09-11', 99, 103, 90, 92),
      bar('2026-09-12', 93, 104, 92, 102),
      bar('2026-09-13', 102, 113, 100, 109),
      bar('2026-09-14', 108, 110, 95, 98),
      bar('2026-09-15', 98, 102, 94, 99),
      bar('2026-09-16', 99, 101, 93, 97),
      bar('2026-09-17', 96, 99, 87, 88),
    ]);
    const zone = tripleTop?.chartPattern?.geometry?.zones?.[0];
    const maxPivot = Math.max(...(tripleTop?.chartPattern?.geometry?.pivotMarkers?.map((m) => m.price) ?? []));
    expect(zone?.high).toBeGreaterThanOrEqual(maxPivot);

    const shallowPullbackTripleTop = run('chart_triple_top', [
      bar('2026-09-02', 74, 82, 73, 80),
      bar('2026-09-03', 80, 92, 78, 90),
      bar('2026-09-04', 90, 104, 88, 101),
      bar('2026-09-05', 101, 112, 99, 108),
      bar('2026-09-06', 107, 109, 96, 98),
      bar('2026-09-07', 98, 102, 91, 93),
      bar('2026-09-08', 94, 104, 93, 102),
      bar('2026-09-09', 102, 111, 100, 108),
      bar('2026-09-10', 108, 110, 109.5, 110),
      bar('2026-09-11', 109.5, 110, 109.2, 109.8),
      bar('2026-09-12', 109.8, 110.5, 109.4, 110.2),
      bar('2026-09-13', 102, 112.5, 100, 109),
      bar('2026-09-14', 108, 110, 95, 98),
      bar('2026-09-15', 98, 102, 94, 99),
      bar('2026-09-16', 99, 101, 93, 97),
      bar('2026-09-17', 96, 99, 87, 88),
    ]);
    expect(shallowPullbackTripleTop).toBeNull();

    const flatPeaks = run('chart_three_falling_peaks', [
      bar('2028-03-01', 80, 86, 78, 84),
      bar('2028-03-02', 84, 96, 82, 94),
      bar('2028-03-03', 94, 100.5, 92, 99),
      bar('2028-03-04', 99, 99.5, 95, 96),
      bar('2028-03-05', 96, 97, 94, 95),
      bar('2028-03-06', 95, 100.2, 94, 99),
      bar('2028-03-07', 99, 99.4, 95, 96),
      bar('2028-03-08', 96, 97, 94, 95),
      bar('2028-03-09', 95, 100.0, 93, 98),
      bar('2028-03-10', 98, 99, 95, 96),
      bar('2028-03-11', 96, 97, 90, 92),
      bar('2028-03-12', 92, 96, 88, 90),
      bar('2028-03-13', 89, 91, 82, 84),
      bar('2028-03-14', 84, 86, 78, 80),
    ]);
    expect(flatPeaks).toBeNull();

    const risingWedge = run('chart_rising_wedge_top', [
      ...risingWedgeBars('2029-05'),
      bar('2029-05-18', 106, 108, 102, 104),
    ]);
    expect(risingWedge?.chartPattern?.geometry?.trendLines?.every((line) => line.extendRight === false)).toBe(true);

    const slicedMidPeakWedge = run('chart_rising_wedge_top', [
      ...risingWedgeBars('2029-05').map((item, idx) =>
        idx === 4 ? { ...item, high: item.high + 25 } : item,
      ),
      bar('2029-05-18', 106, 108, 102, 104),
    ]);
    expect(slicedMidPeakWedge).toBeNull();
  });
});

function run(scannerId: string, bars: EodBar[]) {
  const definition = definitions[scannerId];
  if (!definition) {
    throw new Error(`Missing definition ${scannerId}`);
  }
  const context: ScannerContext = {
    symbol: 'ABC',
    exchange: 'NSE',
    bars,
  };
  return runChartPatternScanner(context, definition);
}

function rangeBars(count: number): EodBar[] {
  return Array.from({ length: count }, (_value, index) => {
    const day = String(index + 1).padStart(2, '0');
    const drift = index % 2;
    return bar(`2026-01-${day}`, 100 + drift, 105 + drift, 96, 101 + drift, 100000);
  });
}

function upTrendBars(count: number, month: string): EodBar[] {
  return Array.from({ length: count }, (_value, index) => {
    const price = 100 + index;
    const day = String(index + 1).padStart(2, '0');
    return bar(`${month}-${day}`, price, price + 4, price - 2, price + 3, 100000);
  });
}

function bullPole(month: string): EodBar[] {
  return [
    bar(`${month}-01`, 100, 103, 99, 101),
    bar(`${month}-02`, 102, 106, 101, 105),
    bar(`${month}-03`, 106, 110, 105, 109),
    bar(`${month}-04`, 110, 114, 109, 113),
    bar(`${month}-05`, 114, 118, 113, 117),
    bar(`${month}-06`, 118, 122, 117, 121),
    bar(`${month}-07`, 121, 124, 120, 123),
  ];
}

function bearPole(month: string): EodBar[] {
  return [
    bar(`${month}-01`, 110, 112, 107, 109),
    bar(`${month}-02`, 108, 109, 103, 104),
    bar(`${month}-03`, 103, 104, 99, 100),
    bar(`${month}-04`, 99, 100, 95, 96),
    bar(`${month}-05`, 95, 96, 91, 92),
    bar(`${month}-06`, 91, 92, 88, 89),
    bar(`${month}-07`, 89, 90, 86, 87),
  ];
}

function bumpRunBottomBars(month: string): EodBar[] {
  const closes = [
    120, 116, 112, 108, 104, 100, 96,
    88, 80, 72, 64, 56, 48, 40,
    44, 50, 56, 62, 68,
  ];
  return closes.map((close, index) => {
    const day = String(index + 1).padStart(2, '0');
    return bar(`${month}-${day}`, close + 2, close + 4, close - 4, close);
  });
}

function bumpRunTopBars(month: string): EodBar[] {
  const closes = [
    80, 84, 88, 92, 96, 100, 104,
    112, 120, 128, 136, 144, 152, 160,
    156, 150, 144, 138, 132,
  ];
  return closes.map((close, index) => {
    const day = String(index + 1).padStart(2, '0');
    return bar(`${month}-${day}`, close - 2, close + 4, close - 4, close);
  });
}

function fallingWedgeBars(month: string): EodBar[] {
  return Array.from({ length: 17 }, (_value, index) => {
    const day = String(index + 1).padStart(2, '0');
    const high = 120 - index * 1.25;
    const low = 96 - index * 0.5;
    return bar(`${month}-${day}`, high - 6, high, low, low + 5);
  });
}

function risingWedgeBars(month: string): EodBar[] {
  return Array.from({ length: 17 }, (_value, index) => {
    const day = String(index + 1).padStart(2, '0');
    const high = 100 + index * 1.25;
    const low = 76 + index * 2.6;
    return bar(`${month}-${day}`, low + 1, high, low, high - 1);
  });
}

function diamondBars(month: string): EodBar[] {
  const ranges = [
    [102, 108, 92, 100],
    [104, 110, 91, 102],
    [106, 112, 90, 104],
    [105, 111, 91, 103],
    [104, 109, 92, 102],
    [103, 108, 94, 102],
    [105, 116, 88, 110],
    [110, 122, 82, 116],
    [116, 130, 76, 122],
    [122, 128, 80, 118],
    [118, 124, 84, 114],
    [114, 118, 88, 110],
    [110, 120, 94, 116],
    [116, 118, 96, 112],
    [112, 116, 98, 108],
    [108, 114, 100, 106],
    [106, 112, 102, 106],
    [106, 110, 104, 107],
  ];
  return ranges.map(([open, high, low, close], index) =>
    bar(`${month}-${String(index + 1).padStart(2, '0')}`, open, high, low, close),
  );
}

function broadeningBars(month: string): EodBar[] {
  return Array.from({ length: 17 }, (_value, index) => {
    const day = String(index + 1).padStart(2, '0');
    const high = 105 + index;
    const low = 95 - index;
    const close = (high + low) / 2;
    return bar(`${month}-${day}`, close - 1, high, low, close);
  });
}

function bar(
  date: string,
  open: number,
  high: number,
  low: number,
  close: number,
  volume = 100000,
): EodBar {
  return {
    symbol: 'ABC',
    date,
    open,
    high,
    low,
    close,
    volume,
  };
}
