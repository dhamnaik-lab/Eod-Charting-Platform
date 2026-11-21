/**
 * Native-ready predicates for the ten built-in core OHLCV scanners.
 *
 * These match the decisions in coreOhlcvScanners.ts on valid completed EOD bars.
 * Do not enable native UI routing from this table alone: the legacy result
 * metadata (reasons, direction, values, source) is part of the public contract.
 * The migration gate must first prove that metadata and history are identical.
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

/** Candidate-only until native result metadata and historical parity are verified. */
export const NATIVE_CORE_CANDIDATE_IDS = Object.freeze(Object.keys(NATIVE_CORE_PREDICATES));

export function compileNativeCoreCandidate(scannerId: string): NativeExprV1 | null {
  const factory = Object.prototype.hasOwnProperty.call(NATIVE_CORE_PREDICATES, scannerId)
    ? NATIVE_CORE_PREDICATES[scannerId]
    : undefined;
  return factory ? factory() : null;
}
