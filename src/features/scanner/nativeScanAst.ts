/**
 * NS-01 — Scanner-only expression compiler and AST evaluator.
 *
 * TypeScript stays the formula compiler; Rust only validates and executes the AST.
 * This module therefore does three things:
 *   1. Compiles scanner-only formula text into `NativeExprV1` (strict JSON), including
 *      the `Close[0]` bracket shorthand described in the native-scanner design.
 *   2. Provides a reference evaluator that reproduces the *existing* formula engine
 *      semantics exactly so parity can be proven against it in tests.
 *   3. Derives the minimum lookback a rule needs, for bounded reads and diagnostics.
 *
 * The existing custom-formula editor/parser is untouched: `ref(series, barsBack)` keeps
 * its current behaviour, and ATR is available only through this scanner-side compiler
 * (the editor never had it) so it cannot change chart-indicator results.
 */

import type { OHLCBar } from '@/engine/types';
import { evaluateCustomFormulaDefinition } from '@/modules/formulaEngine/customFormulaEngine';
import {
  NATIVE_SCAN_LIMITS,
  NATIVE_SUPPORTED_PATTERN_IDS,
  type NativeBinaryOperator,
  type NativeExprV1,
  type NativeIndicatorName,
  type NativeOhlcvField,
  type NativeSupportedPatternId,
} from './nativeScanContract';

export interface NativeRuleCompileResult {
  ok: boolean;
  expression?: NativeExprV1;
  errors: string[];
}

export type NativeSeriesValue = number | null;
export type NativeEvalValue =
  | { kind: 'number'; values: NativeSeriesValue[] }
  | { kind: 'boolean'; values: Array<boolean | null> };

const FIELD_NAMES: readonly NativeOhlcvField[] = ['open', 'high', 'low', 'close', 'volume'];

const INDICATOR_FUNCTIONS: readonly NativeIndicatorName[] = ['sma', 'ema', 'rsi', 'volumeSma'];

const PATTERN_MIN_BARS: Record<NativeSupportedPatternId, number> = {
  chart_common_gap: 12,
  chart_breakaway_gap: 22,
  chart_runaway_gap: 22,
  chart_exhaustion_gap: 22,
  chart_island_reversal_top: 5,
  chart_island_reversal_bottom: 5,
  chart_double_bottom: 12,
  chart_double_top: 12,
  chart_triple_bottom: 12,
  chart_triple_top: 12,
  chart_v_bottom: 15,
  chart_spike_top: 15,
  chart_horn_bottom: 12,
  chart_horn_top: 12,
  chart_bump_run_bottom: 20,
  chart_bump_run_top: 20,
  chart_blow_off_top: 16,
  chart_rectangle_range: 21,
  chart_ascending_triangle: 13,
  chart_descending_triangle: 13,
  chart_symmetrical_triangle: 12,
  chart_falling_wedge_bottom: 14,
  chart_rising_wedge_top: 14,
  chart_diamond_bottom: 19,
  chart_diamond_top: 19,
  chart_diamond_pattern: 19,
  chart_broadening_bottom: 14,
  chart_broadening_formation: 14,
  chart_rising_three_methods: 5,
  chart_falling_three_methods: 5,
  chart_mat_hold_bullish: 5,
  chart_mat_hold_bearish: 5,
  chart_bull_flag: 13,
  chart_bear_flag: 13,
  chart_bull_pennant: 13,
  chart_bear_pennant: 13,
  chart_rising_channel: 20,
  chart_falling_channel: 20,
  chart_high_tight_flag: 15,
  chart_coil_volatility_squeeze: 8,
  chart_three_rising_valleys: 14,
  chart_three_falling_peaks: 14,
  chart_measured_move_up: 15,
  chart_measured_move_down: 15,
  chart_head_shoulders: 16,
  chart_inverse_head_shoulders: 16,
  chart_complex_head_shoulders: 22,
  chart_cup_handle: 18,
  chart_inverted_cup_handle: 18,
  chart_rounding_bottom: 18,
  chart_adam_eve_bottom: 16,
  chart_adam_eve_top: 16,
  chart_scallop_handle: 18,
  chart_rounding_top: 18,
};

/** Call-form and `pattern(...)` aliases for all 54 natively supported chart patterns. */
const PATTERN_CALL_ALIASES: Record<string, NativeSupportedPatternId> = (() => {
  const aliases: Record<string, NativeSupportedPatternId> = {};
  for (const id of NATIVE_SUPPORTED_PATTERN_IDS) {
    const shortName = id.replace(/^chart_/, '');
    const compact = shortName.replace(/_/g, '');
    aliases[id] = id;
    aliases[shortName] = id;
    aliases[compact] = id;
  }
  return aliases;
})();

// ---------------------------------------------------------------------------
// Tokenizer (scanner-only; mirrors the documented formula grammar)
// ---------------------------------------------------------------------------

type TokenType =
  | 'number'
  | 'string'
  | 'identifier'
  | 'operator'
  | 'lparen'
  | 'rparen'
  | 'lbracket'
  | 'rbracket'
  | 'comma'
  | 'eof';

interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;
  let line = 1;
  let column = 1;

  const push = (type: TokenType, value: string, tokenLine: number, tokenColumn: number) => {
    tokens.push({ type, value, line: tokenLine, column: tokenColumn });
  };

  while (cursor < source.length) {
    const char = source[cursor]!;

    if (char === '\r') {
      cursor += 1;
      continue;
    }
    if (char === '\n' || char === '\t' || char === ' ') {
      if (char === '\n') {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
      cursor += 1;
      continue;
    }
    if (char === '#' || (char === '/' && source[cursor + 1] === '/')) {
      while (cursor < source.length && source[cursor] !== '\n') {
        cursor += 1;
        column += 1;
      }
      continue;
    }
    if (char === '\'' || char === '"') {
      const tokenLine = line;
      const tokenColumn = column;
      const quote = char;
      cursor += 1;
      column += 1;
      let value = '';
      while (cursor < source.length && source[cursor] !== quote) {
        value += source[cursor];
        cursor += 1;
        column += 1;
      }
      if (cursor >= source.length) {
        throw new Error(`Unterminated string (line ${tokenLine}, col ${tokenColumn}).`);
      }
      cursor += 1;
      column += 1;
      push('string', value, tokenLine, tokenColumn);
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      const tokenLine = line;
      const tokenColumn = column;
      let value = char;
      cursor += 1;
      column += 1;
      while (cursor < source.length && /[A-Za-z0-9_]/.test(source[cursor]!)) {
        value += source[cursor];
        cursor += 1;
        column += 1;
      }
      push('identifier', value, tokenLine, tokenColumn);
      continue;
    }
    if (/\d/.test(char) || (char === '.' && /\d/.test(source[cursor + 1] ?? ''))) {
      const tokenLine = line;
      const tokenColumn = column;
      let value = char;
      cursor += 1;
      column += 1;
      while (cursor < source.length && /[\d.]/.test(source[cursor]!)) {
        value += source[cursor];
        cursor += 1;
        column += 1;
      }
      if (!/^\d*\.?\d+$/.test(value)) {
        throw new Error(`Invalid number "${value}" (line ${tokenLine}, col ${tokenColumn})`);
      }
      push('number', value, tokenLine, tokenColumn);
      continue;
    }

    const tokenLine = line;
    const tokenColumn = column;
    const twoChar = source.slice(cursor, cursor + 2);
    if (twoChar === '&&' || twoChar === '||') {
      push('operator', twoChar, tokenLine, tokenColumn);
      cursor += 2;
      column += 2;
      continue;
    }
    if (twoChar === '>=' || twoChar === '<=' || twoChar === '==' || twoChar === '!' || twoChar === '!=') {
      if (twoChar === '!') {
        throw new Error(`Unexpected token "!" (line ${tokenLine}, col ${tokenColumn})`);
      }
      push('operator', twoChar, tokenLine, tokenColumn);
      cursor += 2;
      column += 2;
      continue;
    }
    if (twoChar === '<>') {
      push('operator', '!=', tokenLine, tokenColumn);
      cursor += 2;
      column += 2;
      continue;
    }
    if ('+-*/><'.includes(char)) {
      push('operator', char, tokenLine, tokenColumn);
      cursor += 1;
      column += 1;
      continue;
    }
    if (char === '=') {
      throw new Error(
        `Scanner expressions must be a single boolean condition; assignments are not supported (line ${tokenLine}, col ${tokenColumn}).`,
      );
    }
    if (char === '(') {
      push('lparen', char, tokenLine, tokenColumn);
      cursor += 1;
      column += 1;
      continue;
    }
    if (char === ')') {
      push('rparen', char, tokenLine, tokenColumn);
      cursor += 1;
      column += 1;
      continue;
    }
    if (char === '[') {
      push('lbracket', char, tokenLine, tokenColumn);
      cursor += 1;
      column += 1;
      continue;
    }
    if (char === ']') {
      push('rbracket', char, tokenLine, tokenColumn);
      cursor += 1;
      column += 1;
      continue;
    }
    if (char === ',') {
      push('comma', char, tokenLine, tokenColumn);
      cursor += 1;
      column += 1;
      continue;
    }
    throw new Error(`Unexpected token "${char}" (line ${tokenLine}, col ${tokenColumn})`);
  }

  push('eof', '', line, column);
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser producing NativeExprV1 directly
// ---------------------------------------------------------------------------

class NativeExprParser {
  private index = 0;

  constructor(private readonly tokens: Token[], private readonly allowPattern: boolean) {}

  parse(): NativeExprV1 {
    const expression = this.parseOr();
    if (!this.check('eof')) {
      const token = this.peek();
      throw new Error(`Unexpected token "${token.value}" (line ${token.line}, col ${token.column})`);
    }
    return expression;
  }

  private parseOr(): NativeExprV1 {
    let expression = this.parseAnd();
    while (this.matchOperator('||') || this.matchKeyword('or')) {
      const right = this.parseAnd();
      expression = { kind: 'binary', op: 'or', left: expression, right };
    }
    return expression;
  }

  private parseAnd(): NativeExprV1 {
    let expression = this.parseComparison();
    while (this.matchOperator('&&') || this.matchKeyword('and')) {
      const right = this.parseComparison();
      expression = { kind: 'binary', op: 'and', left: expression, right };
    }
    return expression;
  }

  private parseComparison(): NativeExprV1 {
    let expression = this.parseAdditive();
    while (this.matchOperator('>', '<', '>=', '<=', '==', '!=')) {
      const operator = this.previous().value;
      const right = this.parseAdditive();
      expression = { kind: 'binary', op: mapComparison(operator), left: expression, right };
    }
    return expression;
  }

  private parseAdditive(): NativeExprV1 {
    let expression = this.parseMultiplicative();
    while (this.matchOperator('+', '-')) {
      const operator = this.previous().value;
      const right = this.parseMultiplicative();
      expression = { kind: 'binary', op: operator === '+' ? 'add' : 'sub', left: expression, right };
    }
    return expression;
  }

  private parseMultiplicative(): NativeExprV1 {
    let expression = this.parseUnary();
    while (this.matchOperator('*', '/')) {
      const operator = this.previous().value;
      const right = this.parseUnary();
      expression = { kind: 'binary', op: operator === '*' ? 'mul' : 'div', left: expression, right };
    }
    return expression;
  }

  private parseUnary(): NativeExprV1 {
    if (this.matchOperator('+')) {
      return this.parseUnary();
    }
    if (this.matchOperator('-')) {
      const operand = this.parseUnary();
      return { kind: 'binary', op: 'sub', left: { kind: 'number', value: 0 }, right: operand };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): NativeExprV1 {
    if (this.check('string')) {
      const token = this.peek();
      throw new Error(
        `String literals are only supported as pattern ids (line ${token.line}, col ${token.column}).`,
      );
    }

    if (this.match('number')) {
      const value = Number(this.previous().value);
      if (!Number.isFinite(value)) {
        throw new Error(`Number literal is not finite: ${this.previous().value}`);
      }
      return { kind: 'number', value };
    }

    if (this.match('identifier')) {
      const token = this.previous();
      const name = token.value.toLowerCase();

      if (name === 'true' || name === 'false') {
        return { kind: 'number', value: name === 'true' ? 1 : 0 };
      }

      if (this.match('lbracket')) {
        if (this.check('operator') && this.peek().value === '-') {
          const negative = this.peek();
          throw new Error(
            `Negative/future reference ${token.value}[...] is not supported (line ${negative.line}, col ${negative.column}).`,
          );
        }
        const indexToken = this.consume('number', `Expected an integer lookback inside ${token.value}[...]`);
        const lookback = Number(indexToken.value);
        if (!Number.isInteger(lookback)) {
          throw new Error(
            `${token.value}[${indexToken.value}] must use an integer lookback (line ${indexToken.line}, col ${indexToken.column}).`,
          );
        }
        if (lookback < 0) {
          throw new Error(
            `Negative/future reference ${token.value}[${lookback}] is not supported (line ${indexToken.line}, col ${indexToken.column}).`,
          );
        }
        if (lookback > NATIVE_SCAN_LIMITS.maxLookback) {
          throw new Error(
            `${token.value}[${lookback}] exceeds the maximum lookback of ${NATIVE_SCAN_LIMITS.maxLookback} (line ${indexToken.line}, col ${indexToken.column}).`,
          );
        }
        this.consume('rbracket', `Expected "]" after ${token.value}[${lookback}]`);
        if (!FIELD_NAMES.includes(name as NativeOhlcvField)) {
          throw new Error(
            `Bracket lookback is only supported for OHLCV fields, received "${token.value}" (line ${token.line}, col ${token.column}).`,
          );
        }
        return { kind: 'field', field: name as NativeOhlcvField, lookback };
      }

      if (name === 'pattern' && !this.allowPattern) {
        throw new Error(
          `Chart-pattern calls require pattern rules and are not available in numeric expressions (line ${token.line}, col ${token.column}).`,
        );
      }

      if (name === 'pattern' && this.check('lparen')) {
        this.index += 1;
        return this.parsePatternCall();
      }

      if (this.allowPattern && PATTERN_CALL_ALIASES[name] && this.check('lparen')) {
        this.index += 1;
        this.consume('rparen', `Expected ")" after ${token.value}().`);
        return { kind: 'pattern', id: PATTERN_CALL_ALIASES[name]! };
      }

      if (this.match('lparen')) {
        return this.parseCall(name, token);
      }

      if (FIELD_NAMES.includes(name as NativeOhlcvField)) {
        return { kind: 'field', field: name as NativeOhlcvField, lookback: 0 };
      }

      if (this.allowPattern) {
        if (name === 'pattern') {
          return this.parsePatternCall();
        }
        const patternId = PATTERN_CALL_ALIASES[name];
        if (patternId) {
          return { kind: 'pattern', id: patternId };
        }
      }

      throw new Error(`Unknown identifier "${token.value}" (line ${token.line}, col ${token.column})`);
    }

    if (this.match('lparen')) {
      const expression = this.parseOr();
      this.consume('rparen', 'Expected ")" after expression.');
      return expression;
    }

    const token = this.peek();
    throw new Error(
      `Expected a number, OHLCV field, function call, or parenthesized expression (line ${token.line}, col ${token.column}).`,
    );
  }

  private parsePatternCall(): NativeExprV1 {
    if (this.check('rparen')) {
      this.index += 1;
      throw new Error('pattern(...) requires a supported pattern id.');
    }
    const idToken = this.check('string')
      ? (this.index += 1, this.previous())
      : this.consume('identifier', 'pattern(...) requires a supported pattern id.');
    const patternId = PATTERN_CALL_ALIASES[idToken.value.toLowerCase()];
    if (!patternId) {
      throw new Error(
        `Unsupported pattern "${idToken.value}"; supported ids are all ${NATIVE_SUPPORTED_PATTERN_IDS.length} built-in chart patterns (line ${idToken.line}, col ${idToken.column}).`,
      );
    }
    this.consume('rparen', 'Expected ")" after pattern id.');
    return { kind: 'pattern', id: patternId };
  }

  private parseCall(name: string, token: Token): NativeExprV1 {
    const args: NativeExprV1[] = [];
    if (!this.check('rparen')) {
      do {
        args.push(this.parseOr());
      } while (this.match('comma'));
    }
    this.consume('rparen', `Expected ")" after arguments for ${token.value}.`);

    const arityError = (expected: string) =>
      new Error(
        `${token.value} expects ${expected} (line ${token.line}, col ${token.column}).`,
      );

    switch (name) {
      case 'sma':
      case 'ema':
      case 'rsi': {
        if (args.length !== 2) throw arityError('2 arguments');
        const input = args[0]!;
        ensureSeriesArgument(name, input, token);
        const period = requirePositiveIntegerLiteral(args[1]!, name, token);
        return { kind: 'indicator', name, period, input };
      }
      case 'atr': {
        if (args.length !== 1) throw arityError('1 argument: ATR(period)');
        const period = requirePositiveIntegerLiteral(args[0]!, name, token);
        return { kind: 'indicator', name: 'atr', period };
      }
      case 'volumesma':
      case 'volume_sma': {
        if (args.length !== 1) throw arityError('1 argument: volumeSma(period)');
        const period = requirePositiveIntegerLiteral(args[0]!, name, token);
        return { kind: 'indicator', name: 'volumeSma', period };
      }
      case 'crossover':
      case 'crossunder': {
        if (args.length !== 2) throw arityError('2 arguments');
        return { kind: name === 'crossover' ? 'crossover' : 'crossunder', left: args[0]!, right: args[1]! };
      }
      case 'ref': {
        if (args.length !== 2) throw arityError('2 arguments: ref(series, barsBack)');
        const barsBack = requirePositiveIntegerLiteral(args[1]!, name, token, 0);
        const input = args[0]!;
        // `ref(field, k)` folds into the equivalent field lookback so the wire format
        // stays a closed, fully-validatable AST. Shifting a computed series is not
        // expressible in v1 and is rejected rather than silently approximated.
        if (input.kind !== 'field') {
          throw new Error(
            'ref() with a computed series is not supported by the native scanner; use ref(field, barsBack) or Close[n].',
          );
        }
        const lookback = input.lookback + barsBack;
        if (lookback > NATIVE_SCAN_LIMITS.maxLookback) {
          throw new Error(
            `ref() lookback ${lookback} exceeds the maximum of ${NATIVE_SCAN_LIMITS.maxLookback} (line ${token.line}, col ${token.column}).`,
          );
        }
        return { kind: 'field', field: input.field, lookback };
      }
      default:
        throw new Error(`Unknown function "${token.value}" (line ${token.line}, col ${token.column})`);
    }
  }

  private match(type: TokenType): boolean {
    if (!this.check(type)) return false;
    this.index += 1;
    return true;
  }

  private matchOperator(...operators: string[]): boolean {
    if (!this.check('operator')) return false;
    const token = this.peek();
    if (!operators.includes(token.value)) return false;
    this.index += 1;
    return true;
  }

  private matchKeyword(keyword: string): boolean {
    const token = this.peek();
    if (token.type !== 'identifier' || token.value.toLowerCase() !== keyword) {
      return false;
    }
    this.index += 1;
    return true;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) {
      this.index += 1;
      return this.previous();
    }
    const token = this.peek();
    throw new Error(`${message} (line ${token.line}, col ${token.column})`);
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private previous(): Token {
    return this.tokens[this.index - 1]!;
  }

  private peek(): Token {
    return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1]!;
  }
}

function mapComparison(operator: string): NativeBinaryOperator {
  switch (operator) {
    case '>':
      return 'gt';
    case '>=':
      return 'gte';
    case '<':
      return 'lt';
    case '<=':
      return 'lte';
    case '==':
      return 'eq';
    case '!=':
      return 'neq';
    default:
      throw new Error(`Unsupported comparison operator "${operator}".`);
  }
}

function ensureSeriesArgument(_name: string, input: NativeExprV1, token: Token): void {
  if (input.kind === 'number' || isPattern(input)) {
    throw new Error(
      `${token.value} requires a series input, received a non-series expression (line ${token.line}, col ${token.column}).`,
    );
  }
}

function isPattern(expression: NativeExprV1): boolean {
  if (expression.kind === 'pattern') return true;
  if (expression.kind === 'binary') return isPattern(expression.left) || isPattern(expression.right);
  if (expression.kind === 'crossover' || expression.kind === 'crossunder') {
    return isPattern(expression.left) || isPattern(expression.right);
  }
  if (expression.kind === 'indicator' && expression.input) return isPattern(expression.input);
  return false;
}

function requirePositiveIntegerLiteral(
  expression: NativeExprV1,
  name: string,
  token: Token,
  minimum = 2,
): number {
  if (expression.kind !== 'number' || !Number.isInteger(expression.value)) {
    throw new Error(
      `${token.value} requires an integer period argument (line ${token.line}, col ${token.column}).`,
    );
  }
  if (expression.value < minimum) {
    throw new Error(
      `${token.value} period must be >= ${minimum}; received ${expression.value} (line ${token.line}, col ${token.column}).`,
    );
  }
  if (expression.value > NATIVE_SCAN_LIMITS.maxIndicatorPeriod) {
    throw new Error(
      `${token.value} period must be <= ${NATIVE_SCAN_LIMITS.maxIndicatorPeriod}; received ${expression.value} (line ${token.line}, col ${token.column}).`,
    );
  }
  return expression.value;
}

/**
 * Compiles scanner-only formula text into a strict `NativeExprV1`.
 *
 * `allowPattern` enables chart-pattern calls (`pattern('chart_breakaway_gap')`,
 * `breakawayGap()`, ...). Pattern rules are evaluated by their ported Rust detector;
 * they are never approximated by the numeric evaluator.
 */
export function compileNativeScannerExpression(
  source: string,
  options: { allowPattern?: boolean } = {},
): NativeRuleCompileResult {
  const trimmed = source.replace(/\r\n/g, '\n').trim();
  if (!trimmed) {
    return { ok: false, errors: ['Scanner expression is empty.'] };
  }
  try {
    const tokens = tokenize(trimmed);
    const parser = new NativeExprParser(tokens, options.allowPattern === true);
    const expression = parser.parse();
    if (containsPattern(expression) && !options.allowPattern) {
      return {
        ok: false,
        errors: ['Chart-pattern calls require pattern rules and are not available in numeric expressions.'],
      };
    }
    return { ok: true, expression, errors: [] };
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : 'Unable to compile scanner expression.'],
    };
  }
}

export function containsPattern(expression: NativeExprV1): boolean {
  switch (expression.kind) {
    case 'pattern':
      return true;
    case 'binary':
      return containsPattern(expression.left) || containsPattern(expression.right);
    case 'crossover':
    case 'crossunder':
      return containsPattern(expression.left) || containsPattern(expression.right);
    case 'indicator':
      return expression.input ? containsPattern(expression.input) : false;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Reference evaluator (proves Rust parity; mirrors the existing engine exactly)
// ---------------------------------------------------------------------------

function fieldSeries(bars: readonly OHLCBar[], field: NativeOhlcvField, lookback: number): NativeSeriesValue[] {
  const values = bars.map((bar) => {
    switch (field) {
      case 'open':
        return bar.open;
      case 'high':
        return bar.high;
      case 'low':
        return bar.low;
      case 'close':
        return bar.close;
      case 'volume':
        return bar.volume;
    }
  });
  // Same as the existing calculateReferenceShift: null before the first valid bar.
  return values.map((_, index) => {
    const sourceIndex = index - lookback;
    if (sourceIndex < 0 || sourceIndex >= values.length) return null;
    return values[sourceIndex]!;
  });
}

/**
 * ATR = SMA of the seed-based true range, with the first bar's true range defined as
 * `high - low`. Warm-up is therefore identical to a Wilder-style first value that
 * matches the Rust `atr` implementation (`sma(true_range, period)`).
 */
export function nativeAtrSeries(bars: readonly OHLCBar[], period: number): NativeSeriesValue[] {
  const trueRanges: NativeSeriesValue[] = bars.map((bar, index) => {
    if (index === 0) return bar.high - bar.low;
    const previous = bars[index - 1]!;
    return Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - previous.close),
      Math.abs(bar.low - previous.close),
    );
  });
  return sma(trueRanges, period);
}

export function nativeVolumeSmaSeries(bars: readonly OHLCBar[], period: number): NativeSeriesValue[] {
  return sma(bars.map((bar) => bar.volume), period);
}

function sma(values: NativeSeriesValue[], period: number): NativeSeriesValue[] {
  const result = new Array<NativeSeriesValue>(values.length).fill(null);
  for (let index = period - 1; index < values.length; index += 1) {
    let sum = 0;
    let valid = true;
    for (let offset = index - period + 1; offset <= index; offset += 1) {
      const value = values[offset]!;
      if (value === null) {
        valid = false;
        break;
      }
      sum += value;
    }
    result[index] = valid ? sum / period : null;
  }
  return result;
}

function ema(values: NativeSeriesValue[], period: number): NativeSeriesValue[] {
  const result = new Array<NativeSeriesValue>(values.length).fill(null);
  const multiplier = 2 / (period + 1);
  let seedCount = 0;
  let seedSum = 0;
  let current: number | null = null;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (value === null) {
      seedCount = 0;
      seedSum = 0;
      current = null;
      continue;
    }
    if (current === null) {
      seedSum += value;
      seedCount += 1;
      if (seedCount === period) {
        current = seedSum / period;
        result[index] = current;
      }
      continue;
    }
    current = (value - current) * multiplier + current;
    result[index] = current;
  }
  return result;
}

function rsi(values: NativeSeriesValue[], period: number): NativeSeriesValue[] {
  const result = new Array<NativeSeriesValue>(values.length).fill(null);
  if (values.length <= period) return result;
  let gains: number[] = [];
  let losses: number[] = [];
  let avgGain: number | null = null;
  let avgLoss: number | null = null;
  for (let index = 1; index < values.length; index += 1) {
    const current = values[index]!;
    const previous = values[index - 1]!;
    if (current === null || previous === null) {
      gains = [];
      losses = [];
      avgGain = null;
      avgLoss = null;
      continue;
    }
    const change = current - previous;
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    if (avgGain === null || avgLoss === null) {
      gains.push(gain);
      losses.push(loss);
      if (gains.length === period) {
        avgGain = gains.reduce((sum, value) => sum + value, 0) / period;
        avgLoss = losses.reduce((sum, value) => sum + value, 0) / period;
        result[index] = computeRsi(avgGain, avgLoss);
      }
      continue;
    }
    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    result[index] = computeRsi(avgGain, avgLoss);
  }
  return result;
}

function computeRsi(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100;
  const relativeStrength = avgGain / avgLoss;
  return 100 - 100 / (1 + relativeStrength);
}

/** Numeric view of an evaluation result (booleans become 1/0 with nulls preserved). */
function numericValues(value: NativeEvalValue): NativeSeriesValue[] {
  return toNumeric(value);
}

function toNumeric(value: NativeEvalValue): NativeSeriesValue[] {
  if (value.kind === 'number') return value.values;
  return value.values.map((entry) => (entry === null ? null : entry ? 1 : 0));
}

function toBooleanSeries(value: NativeEvalValue): Array<boolean | null> {
  if (value.kind === 'boolean') return value.values;
  return value.values.map((entry) => (entry === null ? null : entry !== 0));
}

/**
 * Evaluates a numeric/boolean AST over complete bars using the existing engine rules.
 *
 * Division by zero yields `null` per bar (matching the series behaviour of the
 * existing formula engine) and never results in `Infinity`.
 */
export function evaluateNativeExpression(
  expression: NativeExprV1,
  bars: readonly OHLCBar[],
): NativeEvalValue {
  const length = bars.length;

  const evaluate = (node: NativeExprV1): NativeEvalValue => {
    switch (node.kind) {
      case 'number':
        return { kind: 'number', values: new Array<NativeSeriesValue>(length).fill(node.value) };
      case 'field':
        return { kind: 'number', values: fieldSeries(bars, node.field, node.lookback) };
      case 'indicator': {
        switch (node.name) {
          case 'sma':
            return { kind: 'number', values: sma(toNumeric(evaluate(node.input!)), node.period) };
          case 'ema':
            return { kind: 'number', values: ema(toNumeric(evaluate(node.input!)), node.period) };
          case 'rsi':
            return { kind: 'number', values: rsi(toNumeric(evaluate(node.input!)), node.period) };
          case 'atr':
            return { kind: 'number', values: nativeAtrSeries(bars, node.period) };
          case 'volumeSma':
            return { kind: 'number', values: nativeVolumeSmaSeries(bars, node.period) };
        }
        break;
      }
      case 'crossover':
      case 'crossunder': {
        const left = toNumeric(evaluate(node.left));
        const right = toNumeric(evaluate(node.right));
        const values: Array<boolean | null> = new Array(length).fill(null);
        for (let index = 1; index < length; index += 1) {
          const previousLeft = left[index - 1]!;
          const previousRight = right[index - 1]!;
          const currentLeft = left[index]!;
          const currentRight = right[index]!;
          if (
            previousLeft === null ||
            previousRight === null ||
            currentLeft === null ||
            currentRight === null
          ) {
            values[index] = null;
            continue;
          }
          values[index] = node.kind === 'crossover'
            ? previousLeft <= previousRight && currentLeft > currentRight
            : previousLeft >= previousRight && currentLeft < currentRight;
        }
        return { kind: 'boolean', values };
      }
      case 'pattern':
        throw new Error('Pattern rules are evaluated by their dedicated detector, not the numeric evaluator.');
      case 'binary': {
        const leftValue = evaluate(node.left);
        const rightValue = evaluate(node.right);
        const op = node.op;
        if (op === 'and' || op === 'or') {
          const left = toBooleanSeries(leftValue);
          const right = toBooleanSeries(rightValue);
          const values: Array<boolean | null> = new Array(length).fill(null);
          for (let index = 0; index < length; index += 1) {
            const a = left[index]!;
            const b = right[index]!;
            // Matches the existing engine: null propagates unless a short-circuit decides.
            if (op === 'and') {
              values[index] = a === false || b === false ? false : a === null || b === null ? null : true;
            } else {
              values[index] = a === true || b === true ? true : a === null || b === null ? null : false;
            }
          }
          return { kind: 'boolean', values };
        }
        if (op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte' || op === 'eq' || op === 'neq') {
          const left = toNumeric(leftValue);
          const right = toNumeric(rightValue);
          const values: Array<boolean | null> = new Array(length).fill(null);
          for (let index = 0; index < length; index += 1) {
            const a = left[index]!;
            const b = right[index]!;
            if (a === null || b === null) continue;
            values[index] =
              op === 'gt' ? a > b
              : op === 'gte' ? a >= b
              : op === 'lt' ? a < b
              : op === 'lte' ? a <= b
              : op === 'eq' ? a === b
              : a !== b;
          }
          return { kind: 'boolean', values };
        }
        const left = toNumeric(leftValue);
        const right = toNumeric(rightValue);
        const values: NativeSeriesValue[] = new Array(length).fill(null);
        for (let index = 0; index < length; index += 1) {
          const a = left[index]!;
          const b = right[index]!;
          if (a === null || b === null) continue;
          if (op === 'div') {
            values[index] = b === 0 ? null : a / b;
            continue;
          }
          values[index] = op === 'add' ? a + b : op === 'sub' ? a - b : a * b;
        }
        return { kind: 'number', values };
      }
    }
    throw new Error('Unsupported native expression node.');
  };

  return evaluate(expression);
}

/**
 * True when the rule matches on the final (most recent) completed bar.
 * A null result is "no match", never an implicit pass.
 */
export function evaluateNativeRuleLatest(
  expression: NativeExprV1,
  bars: readonly OHLCBar[],
): { matched: boolean; value: boolean | null } {
  if (bars.length === 0) return { matched: false, value: null };
  const result = evaluateNativeExpression(expression, bars);
  const index = bars.length - 1;
  if (result.kind === 'boolean') {
    const value = result.values[index] ?? null;
    return { matched: value === true, value };
  }
  const numeric = result.values[index] ?? null;
  if (numeric === null) return { matched: false, value: null };
  const value = numeric !== 0;
  return { matched: value, value };
}

/** Minimum number of bars required before a rule can produce a non-null result. */
export function minimumBarsForExpression(expression: NativeExprV1): number {
  switch (expression.kind) {
    case 'number':
      return 0;
    case 'field':
      return expression.lookback + 1;
    case 'indicator': {
      // An indicator that consumes a series needs the input's own warm-up plus the
      // indicator's own lookback: `sma/ema` first publish at index `period - 1`.
      const inputBars = expression.input ? minimumBarsForExpression(expression.input) : 0;
      switch (expression.name) {
        case 'sma':
        case 'ema':
          return inputBars + expression.period - 1;
        case 'rsi':
          return inputBars + expression.period;
        case 'atr':
        case 'volumeSma':
          return expression.period;
      }
    }
    case 'crossover':
    case 'crossunder':
      return Math.max(
        minimumBarsForExpression(expression.left),
        minimumBarsForExpression(expression.right),
      ) + 1;
    case 'binary':
      return Math.max(
        minimumBarsForExpression(expression.left),
        minimumBarsForExpression(expression.right),
      );
    case 'pattern':
      return PATTERN_MIN_BARS[expression.id] ?? 22;
  }
}

/**
 * Cross-checks a scanner expression against the existing formula engine.
 *
 * The existing engine only exposes numeric plots, so a top-level comparison is checked by
 * evaluating both operands numerically (`RULE = (left) - (right)`) and re-applying the
 * comparison to the engine's own values. Arithmetic expressions are compared directly.
 * Boolean operators (`and`/`or`) do not exist in the existing engine and are therefore
 * reported as not cross-checkable rather than quietly "verified".
 */
export function crossCheckNativeExpressionWithFormulaEngine(
  source: string,
  bars: readonly OHLCBar[],
): { ok: boolean; errors: string[] } {
  const compiled = compileNativeScannerExpression(source);
  if (!compiled.ok || !compiled.expression) {
    return { ok: false, errors: compiled.errors };
  }
  const expression = compiled.expression;
  if (containsPattern(expression)) {
    return { ok: false, errors: ['Pattern expressions are not cross-checked by the formula engine.'] };
  }

  const comparison = expression.kind === 'binary' && isComparisonOp(expression.op)
    ? expression
    : null;

  if (expression.kind === 'crossover' || expression.kind === 'crossunder') {
    const args = splitTopLevelCallArgs(source);
    if (!args) {
      return { ok: false, errors: ['Unable to split the cross arguments for cross-check.'] };
    }
    const engine = evaluateCustomFormulaDefinition(
      `RULE = (${args[0]}) - (${args[1]})`,
      [...bars],
    );
    if (engine.errors.length > 0) return { ok: false, errors: engine.errors };
    const difference = engine.plots[0]?.values ?? [];
    const nativeLeft = numericValues(evaluateNativeExpression(expression.left, bars));
    const nativeRight = numericValues(evaluateNativeExpression(expression.right, bars));
    if (difference.length !== nativeLeft.length) {
      return { ok: false, errors: ['Series length mismatch against the formula engine.'] };
    }
    for (let index = 1; index < difference.length; index += 1) {
      const currentEngine = difference[index] ?? null;
      const previousEngine = difference[index - 1] ?? null;
      if (
        currentEngine === null ||
        previousEngine === null ||
        nativeLeft[index] === null ||
        nativeRight[index] === null ||
        nativeLeft[index - 1] === null ||
        nativeRight[index - 1] === null
      ) {
        continue;
      }
      const engineResult = expression.kind === 'crossover'
        ? previousEngine <= 0 && currentEngine > 0
        : previousEngine >= 0 && currentEngine < 0;
      const nativeResult = expression.kind === 'crossover'
        ? nativeLeft[index - 1]! <= nativeRight[index - 1]! && nativeLeft[index]! > nativeRight[index]!
        : nativeLeft[index - 1]! >= nativeRight[index - 1]! && nativeLeft[index]! < nativeRight[index]!;
      if (engineResult !== nativeResult) {
        return {
          ok: false,
          errors: [`Bar ${index}: cross mismatch (engine=${engineResult}, native=${nativeResult}).`],
        };
      }
    }
    return { ok: true, errors: [] };
  }

  if (comparison) {
    const split = splitTopLevelComparison(source);
    if (!split) {
      return { ok: false, errors: ['Unable to split the top-level comparison for cross-check.'] };
    }
    const engine = evaluateCustomFormulaDefinition(
      `RULE = (${split.left}) - (${split.right})`,
      [...bars],
    );
    if (engine.errors.length > 0) return { ok: false, errors: engine.errors };
    const difference = engine.plots[0]?.values ?? [];
    const nativeLeft = numericValues(evaluateNativeExpression(comparison.left, bars));
    const nativeRight = numericValues(evaluateNativeExpression(comparison.right, bars));
    if (difference.length !== nativeLeft.length) {
      return { ok: false, errors: ['Series length mismatch against the formula engine.'] };
    }
    for (let index = 0; index < difference.length; index += 1) {
      const engineDifference = difference[index] ?? null;
      const left = nativeLeft[index] ?? null;
      const right = nativeRight[index] ?? null;
      if (engineDifference === null || left === null || right === null) {
        if (Number.isFinite(engineDifference) !== (left !== null && right !== null)) {
          return {
            ok: false,
            errors: [`Bar ${index}: null mismatch (engine=${String(difference[index])}, native=${String(left)}/${String(right)}).`],
          };
        }
        continue;
      }
      const engineResult = applyComparisonToDifference(engineDifference, comparison.op);
      const nativeResult = applyComparisonToDifference(left - right, comparison.op);
      if (engineResult !== nativeResult) {
        return {
          ok: false,
          errors: [
            `Bar ${index}: comparison mismatch (engine=${engineResult}, native=${nativeResult}, difference=${left - right}).`,
          ],
        };
      }
    }
    return { ok: true, errors: [] };
  }

  if (expression.kind === 'binary' && (expression.op === 'and' || expression.op === 'or')) {
    return {
      ok: false,
      errors: ['Boolean operators are scanner-only and are not cross-checkable by the formula engine.'],
    };
  }

  const engine = evaluateCustomFormulaDefinition(`RULE = ${source.trim()}`, [...bars]);
  if (engine.errors.length > 0) {
    return { ok: false, errors: engine.errors };
  }
  const expected = engine.plots[0]?.values ?? [];
  const nativeSeries = numericValues(evaluateNativeExpression(expression, bars));
  if (expected.length !== nativeSeries.length) {
    return { ok: false, errors: ['Series length mismatch against the formula engine.'] };
  }
  for (let index = 0; index < expected.length; index += 1) {
    const left = expected[index] ?? null;
    const right = nativeSeries[index] ?? null;
    if (left === null && right === null) continue;
    if (left === null || right === null) {
      return { ok: false, errors: [`Bar ${index}: null mismatch (engine=${String(left)}, native=${String(right)}).`] };
    }
    if (Math.abs(left - right) > 1e-9) {
      return { ok: false, errors: [`Bar ${index}: value mismatch (engine=${left}, native=${right}).`] };
    }
  }
  return { ok: true, errors: [] };
}

function isComparisonOp(op: NativeBinaryOperator): boolean {
  return op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte' || op === 'eq' || op === 'neq';
}

function applyComparisonToDifference(difference: number, op: NativeBinaryOperator): boolean {
  switch (op) {
    case 'gt':
      return difference > 0;
    case 'gte':
      return difference >= 0;
    case 'lt':
      return difference < 0;
    case 'lte':
      return difference <= 0;
    case 'eq':
      return difference === 0;
    case 'neq':
      return difference !== 0;
    default:
      throw new Error(`Not a comparison operator: ${op}`);
  }
}

/** Splits the arguments of a top-level `name(a, b)` call. */
function splitTopLevelCallArgs(source: string): [string, string] | null {
  const open = source.indexOf('(');
  const close = source.lastIndexOf(')');
  if (open < 0 || close <= open) return null;
  const inner = source.slice(open + 1, close);
  let depth = 0;
  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index]!;
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ',' && depth === 0) {
      return [inner.slice(0, index).trim(), inner.slice(index + 1).trim()];
    }
  }
  return null;
}

/** Splits `left <op> right` at the first depth-0 comparison operator. */
function splitTopLevelComparison(
  source: string,
): { left: string; right: string } | null {
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (depth === 0) {
      const two = source.slice(index, index + 2);
      if (two === '>=' || two === '<=' || two === '==' || two === '!=' || two === '<>') {
        return { left: source.slice(0, index), right: source.slice(index + 2) };
      }
      if (char === '>' || char === '<') {
        return { left: source.slice(0, index), right: source.slice(index + 1) };
      }
    }
  }
  return null;
}

/**
 * Serializes the compiled AST into strict JSON (no functions, no `undefined`), which is
 * what crosses the Tauri boundary and what the Rust validator re-checks.
 */
export function serializeNativeExpression(expression: NativeExprV1): string {
  return JSON.stringify(expression);
}
