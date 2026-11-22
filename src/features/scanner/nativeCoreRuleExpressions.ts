/**
 * Native-ready predicates for the ten built-in core OHLCV scanners and canonical
 * AST signatures for the five Daily Market scanners.
 *
 * Core OHLCV predicates match the decisions in coreOhlcvScanners.ts on valid completed EOD bars.
 * Daily Market rules carry canonical AST signatures validated in Rust, where dedicated
 * evaluators preserve exact dailyMarketScanners.ts semantics (dynamic 252-bar window,
 * strict positive close / nonnegative volume checks, and rounding/formatting).
 * Used only for explicit opt-in latest-bar native routing. Rust independently
 * validates the exact AST for each rule ID and generates legacy result metadata.
 * Full-history core/daily-market runs and unsupported selections must retain TypeScript fallback;
 * runtime numeric/reason parity still requires Windows acceptance.
 */
import type { NativeExprV1, NativeOhlcvField } from './nativeScanContract';

const field = (name: NativeOhlcvField, lookback = 0): NativeExprV1 =>
  ({ kind: 'field', field: name, lookback });
const number = (value: number): NativeExprV1 => ({ kind: 'number', value });
const binary = (
  op: Extract<NativeExprV1, { kind: 'binary' }>['op'],
  left: NativeExprV1,
  right: NativeExprV1,
): NativeExprV1 => ({ kind: 'binary', op, left, right });
const range = (lookback = 0): NativeExprV1 =>
  binary('sub', field('high', lookback), field('low', lookback));
const conjunction = (left: NativeExprV1, right: NativeExprV1): NativeExprV1 =>
  binary('and', left, right);

const NATIVE_CORE_PREDICATES: Readonly<Record<string, () => NativeExprV1>> = {
  prev_day_high_break: () => binary('gt', field('close'), field('high', 1)),
  prev_day_low_break: () => binary('lt', field('close'), field('low', 1)),
  inside_bar: () => conjunction(
    binary('lt', field('high'), field('high', 1)),
    binary('gt', field('low'), field('low', 1)),
  ),
  outside_bar: () => conjunction(
    binary('gt', field('high'), field('high', 1)),
    binary('lt', field('low'), field('low', 1)),
  ),
  close_near_high: () => conjunction(
    binary('gt', range(), number(0)),
    binary('gte', field('close'), binary('sub', field('high'), binary('mul', range(), number(0.1)))),
  ),
  close_near_low: () => conjunction(
    binary('gt', range(), number(0)),
    binary('lte', field('close'), binary('add', field('low'), binary('mul', range(), number(0.1)))),
  ),
  gap_up: () => binary('gt', field('open'), field('high', 1)),
  gap_down: () => binary('lt', field('open'), field('low', 1)),
  nr7: () => {
    let expression = binary('lt', range(), range(1));
    for (let daysBack = 2; daysBack <= 6; daysBack += 1) {
      expression = conjunction(expression, binary('lt', range(), range(daysBack)));
    }
    return expression;
  },
  wide_range_candle: () => binary(
    'gt',
    range(),
    binary('mul', number(1.5), {
      kind: 'indicator',
      name: 'sma',
      period: 14,
      // The accepted TypeScript scanner excludes today's bar from its average.
      input: range(1),
    }),
  ),
};

/** Built-in numeric rule IDs; native routing is limited to explicit bounded/latest runs. */
export const NATIVE_CORE_CANDIDATE_IDS = Object.freeze(Object.keys(NATIVE_CORE_PREDICATES));

const NATIVE_DAILY_MARKET_PREDICATES: Readonly<Record<string, () => NativeExprV1>> = {
  top_gainers: () =>
    conjunction(
      conjunction(
        binary('gt', field('close'), number(0)),
        binary('gt', field('close', 1), number(0)),
      ),
      conjunction(
        binary('gte', field('volume'), number(0)),
        binary(
          'gt',
          binary(
            'mul',
            binary('div', binary('sub', field('close'), field('close', 1)), field('close', 1)),
            number(100),
          ),
          number(0),
        ),
      ),
    ),
  top_losers: () =>
    conjunction(
      conjunction(
        binary('gt', field('close'), number(0)),
        binary('gt', field('close', 1), number(0)),
      ),
      conjunction(
        binary('gte', field('volume'), number(0)),
        binary(
          'lt',
          binary(
            'mul',
            binary('div', binary('sub', field('close'), field('close', 1)), field('close', 1)),
            number(100),
          ),
          number(0),
        ),
      ),
    ),
  volume_surge: () =>
    conjunction(
      conjunction(
        binary('gt', field('close'), number(0)),
        binary('gt', field('close', 1), number(0)),
      ),
      conjunction(
        binary(
          'gt',
          { kind: 'indicator', name: 'sma', period: 20, input: field('volume', 1) },
          number(0),
        ),
        binary(
          'gte',
          binary(
            'div',
            field('volume'),
            { kind: 'indicator', name: 'sma', period: 20, input: field('volume', 1) },
          ),
          number(1.5),
        ),
      ),
    ),
  high_52w: () =>
    conjunction(
      binary('gte', field('high'), field('high', 19)),
      binary('gte', field('close'), number(1)),
    ),
  low_52w: () =>
    conjunction(
      binary('lte', field('low'), field('low', 19)),
      binary('gte', field('close'), number(1)),
    ),
};

/** Daily Market rule IDs supported by opt-in latest-bar native routing. */
export const NATIVE_DAILY_MARKET_CANDIDATE_IDS = Object.freeze(
  Object.keys(NATIVE_DAILY_MARKET_PREDICATES),
);

export function compileNativeCoreCandidate(scannerId: string): NativeExprV1 | null {
  const factory = Object.prototype.hasOwnProperty.call(NATIVE_CORE_PREDICATES, scannerId)
    ? NATIVE_CORE_PREDICATES[scannerId]
    : undefined;
  return factory ? factory() : null;
}

export function compileNativeDailyMarketCandidate(scannerId: string): NativeExprV1 | null {
  const factory = Object.prototype.hasOwnProperty.call(NATIVE_DAILY_MARKET_PREDICATES, scannerId)
    ? NATIVE_DAILY_MARKET_PREDICATES[scannerId]
    : undefined;
  return factory ? factory() : null;
}

export function compileNativeBuiltInCandidate(scannerId: string): NativeExprV1 | null {
  return compileNativeCoreCandidate(scannerId) ?? compileNativeDailyMarketCandidate(scannerId);
}
