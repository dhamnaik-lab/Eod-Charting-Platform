import { SMA } from 'technicalindicators';
import { buildLineSeries, padSeries, type IndicatorBuilder } from '../base';
import { getCompactIndicatorDisplayLabel } from '../catalog';
import type { ChartIndicator, OHLCBar } from '@/engine/types';

export function calculateSSLChannel(
  bars: OHLCBar[],
  period = 10,
): {
  sslUp: Array<number | null>;
  sslDown: Array<number | null>;
} {
  const n = bars.length;
  const sslUp: Array<number | null> = new Array(n).fill(null);
  const sslDown: Array<number | null> = new Array(n).fill(null);
  if (n < period) return { sslUp, sslDown };

  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const closes = bars.map((b) => b.close);

  const smaHighRaw = SMA.calculate({ values: highs, period });
  const smaLowRaw = SMA.calculate({ values: lows, period });

  const smaHighPadded = padSeries(smaHighRaw, n);
  const smaLowPadded = padSeries(smaLowRaw, n);

  let hlv = 1;

  for (let i = period - 1; i < n; i++) {
    const smaH = smaHighPadded[i] ?? highs[i];
    const smaL = smaLowPadded[i] ?? lows[i];
    const c = closes[i];

    if (c > smaH) hlv = 1;
    else if (c < smaL) hlv = -1;

    sslUp[i] = hlv < 0 ? smaL : smaH;
    sslDown[i] = hlv < 0 ? smaH : smaL;
  }

  return { sslUp, sslDown };
}

export const buildSSL_CHANNEL: IndicatorBuilder<Extract<ChartIndicator, { kind: 'SSL_CHANNEL' }>> = (
  bars,
  indicator,
) => {
  const title = getCompactIndicatorDisplayLabel(indicator);
  const period = indicator.period ?? 10;

  const { sslUp, sslDown } = calculateSSLChannel(bars, period);

  return {
    indicator,
    title,
    lines: [
      buildLineSeries('ssl_up', 'SSL Up', sslUp, bars.length, indicator.upColor ?? '#26A69A', 2),
      buildLineSeries('ssl_down', 'SSL Down', sslDown, bars.length, indicator.downColor ?? '#EF5350', 2),
    ],
  };
};
