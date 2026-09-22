import type { ChartIndicator, OHLCBar } from '@/engine/types';

type FormulaTokenType =
  | 'identifier'
  | 'number'
  | 'operator'
  | 'assign'
  | 'comma'
  | 'lparen'
  | 'rparen'
  | 'separator'
  | 'eof';

interface FormulaToken {
  type: FormulaTokenType;
  value: string;
  line: number;
  column: number;
}

interface AssignmentNode {
  name: string;
  line: number;
  expression: ExpressionNode;
}

type ExpressionNode =
  | { type: 'number'; value: number; token: FormulaToken }
  | { type: 'identifier'; name: string; token: FormulaToken }
  | { type: 'unary'; operator: '+' | '-'; operand: ExpressionNode; token: FormulaToken }
  | { type: 'binary'; operator: BinaryOperator; left: ExpressionNode; right: ExpressionNode; token: FormulaToken }
  | { type: 'call'; name: string; args: ExpressionNode[]; token: FormulaToken };

type BinaryOperator =
  | '+'
  | '-'
  | '*'
  | '/'
  | '>'
  | '<'
  | '>='
  | '<='
  | '=='
  | '!=';

type FormulaValue =
  | { kind: 'scalar-number'; value: number }
  | { kind: 'scalar-boolean'; value: boolean }
  | { kind: 'series-number'; values: Array<number | null> }
  | { kind: 'series-boolean'; values: Array<boolean | null> };

interface EvaluationContext {
  bars: OHLCBar[];
  length: number;
  fields: Map<string, FormulaValue>;
  variables: Map<string, FormulaValue>;
}

export interface CustomFormulaIndicatorInput {
  name: string;
  formula: string;
  placement: 'overlay' | 'pane';
  color: string;
}

export interface FormulaPlot {
  key: string;
  label: string;
  values: Array<number | null>;
}

export interface FormulaEvaluationResult {
  plots: FormulaPlot[];
  booleanOutputs: string[];
  errors: string[];
}

export interface FormulaValidationResult {
  ok: boolean;
  plotLabels: string[];
  booleanOutputs: string[];
  errors: string[];
}

const DEFAULT_CUSTOM_FORMULA_COLOR = '#6a9bcc';
const FORMULA_VALIDATION_BAR_COUNT = 96;

export function createCustomFormulaIndicator(
  input: CustomFormulaIndicatorInput,
): Extract<ChartIndicator, { kind: 'CUSTOM' }> {
  const normalized = normalizeCustomFormulaInput(input);

  return {
    id: crypto.randomUUID(),
    kind: 'CUSTOM',
    placement: normalized.placement,
    name: normalized.name,
    formula: normalized.formula,
    color: normalized.color,
  };
}

export function normalizeCustomFormulaInput(input: CustomFormulaIndicatorInput): CustomFormulaIndicatorInput {
  const name = input.name.trim();
  const formula = input.formula
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
  const placement = input.placement === 'pane' ? 'pane' : 'overlay';
  const color = normalizeColor(input.color);

  return {
    name: name || 'Custom Formula',
    formula,
    placement,
    color,
  };
}

export function validateCustomFormulaDefinition(formula: string): FormulaValidationResult {
  const evaluation = evaluateCustomFormulaDefinition(formula, createValidationBars());

  return {
    ok: evaluation.errors.length === 0 && evaluation.plots.length > 0,
    plotLabels: evaluation.plots.map((plot) => plot.label),
    booleanOutputs: evaluation.booleanOutputs,
    errors:
      evaluation.errors.length > 0
        ? evaluation.errors
        : evaluation.plots.length === 0
          ? ['Formula must produce at least one numeric assignment to plot.']
          : [],
  };
}

export function evaluateCustomFormulaDefinition(
  formula: string,
  bars: OHLCBar[],
): FormulaEvaluationResult {
  const normalizedFormula = formula.replace(/\r\n/g, '\n').trim();
  if (!normalizedFormula) {
    return {
      plots: [],
      booleanOutputs: [],
      errors: ['Formula is empty. Add one or more assignments such as MA50 = SMA(close, 50).'],
    };
  }

  try {
    const program = parseProgram(normalizedFormula);
    const context = createEvaluationContext(bars);
    const assignments: Array<{ name: string; value: FormulaValue }> = [];

    program.forEach((statement) => {
      const value = evaluateExpression(statement.expression, context);
      context.variables.set(statement.name.toLowerCase(), value);
      assignments.push({ name: statement.name, value });
    });

    return {
      plots: assignments.flatMap(({ name, value }, index) => {
        if (value.kind !== 'scalar-number' && value.kind !== 'series-number') {
          return [];
        }

        return [{
          key: `plot-${index}-${name.toLowerCase()}`,
          label: name,
          values: normalizeNumericSeries(value, context.length),
        }];
      }),
      booleanOutputs: assignments
        .filter(({ value }) => value.kind === 'scalar-boolean' || value.kind === 'series-boolean')
        .map(({ name }) => name),
      errors: [],
    };
  } catch (error) {
    return {
      plots: [],
      booleanOutputs: [],
      errors: [error instanceof Error ? error.message : 'Unable to evaluate formula.'],
    };
  }
}

function createValidationBars(): OHLCBar[] {
  const bars: OHLCBar[] = [];
  let close = 100;

  for (let index = 0; index < FORMULA_VALIDATION_BAR_COUNT; index += 1) {
    const drift = index < 48 ? 0.8 : -0.35;
    const oscillation = Math.sin(index / 4) * 1.4;
    const nextClose = close + drift + oscillation;
    const open = close - Math.cos(index / 5) * 0.9;
    const high = Math.max(open, nextClose) + 1.8;
    const low = Math.min(open, nextClose) - 1.6;
    const volume = 100_000 + index * 1_250;

    bars.push({
      date: `2026-01-${String((index % 28) + 1).padStart(2, '0')}`,
      timestamp: index,
      open: roundFormulaNumber(open),
      high: roundFormulaNumber(high),
      low: roundFormulaNumber(low),
      close: roundFormulaNumber(nextClose),
      volume,
    });

    close = nextClose;
  }

  return bars;
}

function createEvaluationContext(bars: OHLCBar[]): EvaluationContext {
  const fields = new Map<string, FormulaValue>();
  const closes = bars.map((bar) => bar.close);
  const opens = bars.map((bar) => bar.open);
  const highs = bars.map((bar) => bar.high);
  const lows = bars.map((bar) => bar.low);
  const volumes = bars.map((bar) => bar.volume);

  fields.set('open', { kind: 'series-number', values: opens });
  fields.set('high', { kind: 'series-number', values: highs });
  fields.set('low', { kind: 'series-number', values: lows });
  fields.set('close', { kind: 'series-number', values: closes });
  fields.set('volume', { kind: 'series-number', values: volumes });

  return {
    bars,
    length: bars.length,
    fields,
    variables: new Map<string, FormulaValue>(),
  };
}

function parseProgram(source: string): AssignmentNode[] {
  const tokens = tokenizeFormula(source);
  const parser = new FormulaParser(tokens);
  return parser.parseProgram();
}

class FormulaParser {
  private index = 0;

  constructor(private readonly tokens: FormulaToken[]) {}

  parseProgram(): AssignmentNode[] {
    const statements: AssignmentNode[] = [];

    this.skipSeparators();
    while (!this.check('eof')) {
      const nameToken = this.consume('identifier', 'Expected a variable name at the start of each formula line.');
      this.consume('assign', `Expected "=" after ${nameToken.value}.`);
      const expression = this.parseExpression();
      statements.push({
        name: nameToken.value,
        line: nameToken.line,
        expression,
      });

      if (!this.check('separator') && !this.check('eof')) {
        const token = this.peek();
        throw this.createError(token, 'Separate assignments with a new line or semicolon.');
      }
      this.skipSeparators();
    }

    if (!statements.length) {
      throw new Error('Formula is empty. Add one or more assignments such as MA50 = SMA(close, 50).');
    }

    return statements;
  }

  private parseExpression(): ExpressionNode {
    return this.parseComparison();
  }

  private parseComparison(): ExpressionNode {
    let expression = this.parseAdditive();

    while (this.matchOperator('>', '<', '>=', '<=', '==', '!=')) {
      const operator = this.previous();
      const right = this.parseAdditive();
      expression = {
        type: 'binary',
        operator: operator.value as BinaryOperator,
        left: expression,
        right,
        token: operator,
      };
    }

    return expression;
  }

  private parseAdditive(): ExpressionNode {
    let expression = this.parseMultiplicative();

    while (this.matchOperator('+', '-')) {
      const operator = this.previous();
      const right = this.parseMultiplicative();
      expression = {
        type: 'binary',
        operator: operator.value as BinaryOperator,
        left: expression,
        right,
        token: operator,
      };
    }

    return expression;
  }

  private parseMultiplicative(): ExpressionNode {
    let expression = this.parseUnary();

    while (this.matchOperator('*', '/')) {
      const operator = this.previous();
      const right = this.parseUnary();
      expression = {
        type: 'binary',
        operator: operator.value as BinaryOperator,
        left: expression,
        right,
        token: operator,
      };
    }

    return expression;
  }

  private parseUnary(): ExpressionNode {
    if (this.matchOperator('+', '-')) {
      const operator = this.previous();
      return {
        type: 'unary',
        operator: operator.value as '+' | '-',
        operand: this.parseUnary(),
        token: operator,
      };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): ExpressionNode {
    if (this.match('number')) {
      const token = this.previous();
      return {
        type: 'number',
        value: Number(token.value),
        token,
      };
    }

    if (this.match('identifier')) {
      const token = this.previous();
      if (this.match('lparen')) {
        const args: ExpressionNode[] = [];
        if (!this.check('rparen')) {
          do {
            args.push(this.parseExpression());
          } while (this.match('comma'));
        }
        this.consume('rparen', `Expected ")" after arguments for ${token.value}.`);
        return {
          type: 'call',
          name: token.value,
          args,
          token,
        };
      }

      return {
        type: 'identifier',
        name: token.value,
        token,
      };
    }

    if (this.match('lparen')) {
      const expression = this.parseExpression();
      this.consume('rparen', 'Expected ")" after expression.');
      return expression;
    }

    throw this.createError(this.peek(), 'Expected a number, variable, function call, or parenthesized expression.');
  }

  private match(type: FormulaTokenType): boolean {
    if (!this.check(type)) {
      return false;
    }
    this.index += 1;
    return true;
  }

  private matchOperator(...operators: string[]): boolean {
    if (!this.check('operator')) {
      return false;
    }

    const token = this.peek();
    if (!operators.includes(token.value)) {
      return false;
    }

    this.index += 1;
    return true;
  }

  private consume(type: FormulaTokenType, message: string): FormulaToken {
    if (this.check(type)) {
      this.index += 1;
      return this.previous();
    }

    throw this.createError(this.peek(), message);
  }

  private skipSeparators(): void {
    while (this.check('separator')) {
      this.index += 1;
    }
  }

  private check(type: FormulaTokenType): boolean {
    return this.peek().type === type;
  }

  private previous(): FormulaToken {
    return this.tokens[this.index - 1];
  }

  private peek(): FormulaToken {
    return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1];
  }

  private createError(token: FormulaToken, message: string): Error {
    return new Error(`${message} (line ${token.line}, col ${token.column})`);
  }
}

function tokenizeFormula(source: string): FormulaToken[] {
  const tokens: FormulaToken[] = [];
  let cursor = 0;
  let line = 1;
  let column = 1;

  const pushToken = (type: FormulaTokenType, value: string, tokenLine = line, tokenColumn = column) => {
    tokens.push({ type, value, line: tokenLine, column: tokenColumn });
  };

  while (cursor < source.length) {
    const char = source[cursor];

    if (char === '\r') {
      cursor += 1;
      continue;
    }

    if (char === '\n') {
      pushToken('separator', '\n', line, column);
      cursor += 1;
      line += 1;
      column = 1;
      continue;
    }

    if (char === ';') {
      pushToken('separator', ';', line, column);
      cursor += 1;
      column += 1;
      continue;
    }

    if (char === '#') {
      while (cursor < source.length && source[cursor] !== '\n') {
        cursor += 1;
        column += 1;
      }
      continue;
    }

    if (char === '/' && source[cursor + 1] === '/') {
      while (cursor < source.length && source[cursor] !== '\n') {
        cursor += 1;
        column += 1;
      }
      continue;
    }

    if (char === ' ' || char === '\t') {
      cursor += 1;
      column += 1;
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const tokenLine = line;
      const tokenColumn = column;
      let value = char;
      cursor += 1;
      column += 1;
      while (cursor < source.length && /[A-Za-z0-9_]/.test(source[cursor])) {
        value += source[cursor];
        cursor += 1;
        column += 1;
      }
      pushToken('identifier', value, tokenLine, tokenColumn);
      continue;
    }

    if (/\d/.test(char) || (char === '.' && /\d/.test(source[cursor + 1] ?? ''))) {
      const tokenLine = line;
      const tokenColumn = column;
      let value = char;
      cursor += 1;
      column += 1;
      while (cursor < source.length && /[\d.]/.test(source[cursor])) {
        value += source[cursor];
        cursor += 1;
        column += 1;
      }
      if (!/^\d*\.?\d+$/.test(value)) {
        throw new Error(`Invalid number "${value}" (line ${tokenLine}, col ${tokenColumn})`);
      }
      pushToken('number', value, tokenLine, tokenColumn);
      continue;
    }

    const tokenLine = line;
    const tokenColumn = column;
    const twoCharOperator = source.slice(cursor, cursor + 2);
    if (['>=', '<=', '==', '!='].includes(twoCharOperator)) {
      pushToken('operator', twoCharOperator, tokenLine, tokenColumn);
      cursor += 2;
      column += 2;
      continue;
    }

    if (char === '=') {
      pushToken('assign', '=', tokenLine, tokenColumn);
      cursor += 1;
      column += 1;
      continue;
    }

    if (['+', '-', '*', '/', '>', '<'].includes(char)) {
      pushToken('operator', char, tokenLine, tokenColumn);
      cursor += 1;
      column += 1;
      continue;
    }

    if (char === ',') {
      pushToken('comma', ',', tokenLine, tokenColumn);
      cursor += 1;
      column += 1;
      continue;
    }

    if (char === '(') {
      pushToken('lparen', '(', tokenLine, tokenColumn);
      cursor += 1;
      column += 1;
      continue;
    }

    if (char === ')') {
      pushToken('rparen', ')', tokenLine, tokenColumn);
      cursor += 1;
      column += 1;
      continue;
    }

    throw new Error(`Unexpected token "${char}" (line ${tokenLine}, col ${tokenColumn})`);
  }

  tokens.push({
    type: 'eof',
    value: '',
    line,
    column,
  });

  return tokens;
}

function evaluateExpression(expression: ExpressionNode, context: EvaluationContext): FormulaValue {
  switch (expression.type) {
    case 'number':
      return { kind: 'scalar-number', value: expression.value };
    case 'identifier':
      return resolveIdentifier(expression.name, context, expression.token);
    case 'unary':
      return evaluateUnary(expression, context);
    case 'binary':
      return evaluateBinary(expression, context);
    case 'call':
      return evaluateFunction(expression, context);
    default:
      throw new Error('Unsupported formula expression.');
  }
}

function resolveIdentifier(name: string, context: EvaluationContext, token: FormulaToken): FormulaValue {
  const normalizedName = name.toLowerCase();
  return (
    context.variables.get(normalizedName) ??
    context.fields.get(normalizedName) ??
    (() => {
      throw new Error(`Unknown identifier "${name}" (line ${token.line}, col ${token.column})`);
    })()
  );
}

function evaluateUnary(expression: Extract<ExpressionNode, { type: 'unary' }>, context: EvaluationContext): FormulaValue {
  const operand = evaluateExpression(expression.operand, context);
  if (operand.kind === 'scalar-number') {
    return {
      kind: 'scalar-number',
      value: expression.operator === '-' ? -operand.value : operand.value,
    };
  }

  if (operand.kind === 'series-number') {
    return {
      kind: 'series-number',
      values:
        expression.operator === '+'
          ? [...operand.values]
          : operand.values.map((value) => (value === null ? null : -value)),
    };
  }

  throw new Error(`Unary ${expression.operator} only supports numeric values (line ${expression.token.line}, col ${expression.token.column})`);
}

function evaluateBinary(expression: Extract<ExpressionNode, { type: 'binary' }>, context: EvaluationContext): FormulaValue {
  const left = evaluateExpression(expression.left, context);
  const right = evaluateExpression(expression.right, context);

  switch (expression.operator) {
    case '+':
    case '-':
    case '*':
    case '/':
      return applyNumericBinaryOperator(left, right, expression.operator, expression.token, context);
    case '>':
    case '<':
    case '>=':
    case '<=':
    case '==':
    case '!=':
      return applyComparisonOperator(left, right, expression.operator, expression.token, context);
    default:
      throw new Error(`Unsupported operator "${expression.operator}" (line ${expression.token.line}, col ${expression.token.column})`);
  }
}

function evaluateFunction(expression: Extract<ExpressionNode, { type: 'call' }>, context: EvaluationContext): FormulaValue {
  const functionName = expression.name.toLowerCase();
  const args = expression.args.map((arg) => evaluateExpression(arg, context));

  switch (functionName) {
    case 'sma':
      ensureArgumentCount(expression, args, 2);
      return {
        kind: 'series-number',
        values: calculateSimpleMovingAverage(
          normalizeNumericSeries(args[0], context.length),
          requirePositiveInteger(args[1], expression.name, 2, expression.token, context.length),
        ),
      };
    case 'ema':
      ensureArgumentCount(expression, args, 2);
      return {
        kind: 'series-number',
        values: calculateExponentialMovingAverage(
          normalizeNumericSeries(args[0], context.length),
          requirePositiveInteger(args[1], expression.name, 2, expression.token, context.length),
        ),
      };
    case 'rsi':
      ensureArgumentCount(expression, args, 2);
      return {
        kind: 'series-number',
        values: calculateRelativeStrengthIndex(
          normalizeNumericSeries(args[0], context.length),
          requirePositiveInteger(args[1], expression.name, 2, expression.token, context.length),
        ),
      };
    case 'highest':
      ensureArgumentCount(expression, args, 2);
      return {
        kind: 'series-number',
        values: calculateRollingExtreme(
          normalizeNumericSeries(args[0], context.length),
          requirePositiveInteger(args[1], expression.name, 2, expression.token, context.length),
          'max',
        ),
      };
    case 'lowest':
      ensureArgumentCount(expression, args, 2);
      return {
        kind: 'series-number',
        values: calculateRollingExtreme(
          normalizeNumericSeries(args[0], context.length),
          requirePositiveInteger(args[1], expression.name, 2, expression.token, context.length),
          'min',
        ),
      };
    case 'ref': {
      if (args.length < 2 || args.length > 3) {
        throw createArgumentCountError(expression, 'ref expects 2 arguments: ref(series, barsBack).');
      }
      return {
        kind: 'series-number',
        values: calculateReferenceShift(
          normalizeNumericSeries(args[0], context.length),
          requireInteger(args[1], expression.name, 2, expression.token),
        ),
      };
    }
    case 'change': {
      if (args.length < 1 || args.length > 2) {
        throw createArgumentCountError(expression, 'change expects 1 or 2 arguments: change(series, [barsBack]).');
      }
      return {
        kind: 'series-number',
        values: calculateChange(
          normalizeNumericSeries(args[0], context.length),
          args.length === 2 ? requireInteger(args[1], expression.name, 2, expression.token) : 1,
        ),
      };
    }
    case 'crossover':
      ensureArgumentCount(expression, args, 2);
      return {
        kind: 'series-boolean',
        values: calculateCross(args[0], args[1], context.length, 'over'),
      };
    case 'crossunder':
      ensureArgumentCount(expression, args, 2);
      return {
        kind: 'series-boolean',
        values: calculateCross(args[0], args[1], context.length, 'under'),
      };
    case 'abs':
      ensureArgumentCount(expression, args, 1);
      return applyAbs(args[0], context.length, expression.token);
    case 'min':
      if (args.length < 2) {
        throw createArgumentCountError(expression, 'min expects at least 2 arguments.');
      }
      return applyExtrema(args, context.length, 'min', expression.token);
    case 'max':
      if (args.length < 2) {
        throw createArgumentCountError(expression, 'max expects at least 2 arguments.');
      }
      return applyExtrema(args, context.length, 'max', expression.token);
    default:
      throw new Error(`Unknown function "${expression.name}" (line ${expression.token.line}, col ${expression.token.column})`);
  }
}

function ensureArgumentCount(
  expression: Extract<ExpressionNode, { type: 'call' }>,
  args: FormulaValue[],
  expected: number,
): void {
  if (args.length !== expected) {
    throw createArgumentCountError(
      expression,
      `${expression.name} expects ${expected} argument${expected === 1 ? '' : 's'}, received ${args.length}.`,
    );
  }
}

function createArgumentCountError(
  expression: Extract<ExpressionNode, { type: 'call' }>,
  message: string,
): Error {
  return new Error(`${message} (line ${expression.token.line}, col ${expression.token.column})`);
}

function applyNumericBinaryOperator(
  left: FormulaValue,
  right: FormulaValue,
  operator: '+' | '-' | '*' | '/',
  token: FormulaToken,
  context: EvaluationContext,
): FormulaValue {
  if (left.kind === 'scalar-number' && right.kind === 'scalar-number') {
    if (operator === '/' && right.value === 0) {
      throw new Error(`Division by zero (line ${token.line}, col ${token.column})`);
    }

    return {
      kind: 'scalar-number',
      value: runNumericOperator(left.value, right.value, operator, token),
    };
  }

  const leftSeries = normalizeNumericSeries(left, context.length, token);
  const rightSeries = normalizeNumericSeries(right, context.length, token);
  return {
    kind: 'series-number',
    values: leftSeries.map((leftValue, index) => {
      const rightValue = rightSeries[index];
      if (leftValue === null || rightValue === null) {
        return null;
      }
      if (operator === '/' && rightValue === 0) {
        return null;
      }
      return runNumericOperator(leftValue, rightValue, operator, token);
    }),
  };
}

function runNumericOperator(
  left: number,
  right: number,
  operator: '+' | '-' | '*' | '/',
  token: FormulaToken,
): number {
  switch (operator) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '*':
      return left * right;
    case '/':
      return left / right;
    default:
      throw new Error(`Unsupported operator "${operator}" (line ${token.line}, col ${token.column})`);
  }
}

function applyComparisonOperator(
  left: FormulaValue,
  right: FormulaValue,
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=',
  token: FormulaToken,
  context: EvaluationContext,
): FormulaValue {
  if (left.kind === 'scalar-number' && right.kind === 'scalar-number') {
    return {
      kind: 'scalar-boolean',
      value: compareValues(left.value, right.value, operator, token),
    };
  }

  if (left.kind === 'scalar-boolean' && right.kind === 'scalar-boolean') {
    return {
      kind: 'scalar-boolean',
      value: compareBooleanValues(left.value, right.value, operator, token),
    };
  }

  if (isNumericValue(left) && isNumericValue(right)) {
    const leftSeries = normalizeNumericSeries(left, context.length, token);
    const rightSeries = normalizeNumericSeries(right, context.length, token);
    return {
      kind: 'series-boolean',
      values: leftSeries.map((leftValue, index) => {
        const rightValue = rightSeries[index];
        if (leftValue === null || rightValue === null) {
          return null;
        }
        return compareValues(leftValue, rightValue, operator, token);
      }),
    };
  }

  if (isBooleanValue(left) && isBooleanValue(right)) {
    const leftSeries = normalizeBooleanSeries(left, context.length, token);
    const rightSeries = normalizeBooleanSeries(right, context.length, token);
    return {
      kind: 'series-boolean',
      values: leftSeries.map((leftValue, index) => {
        const rightValue = rightSeries[index];
        if (leftValue === null || rightValue === null) {
          return null;
        }
        return compareBooleanValues(leftValue, rightValue, operator, token);
      }),
    };
  }

  throw new Error(`Cannot compare numeric and boolean values together (line ${token.line}, col ${token.column})`);
}

function compareValues(
  left: number,
  right: number,
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=',
  token: FormulaToken,
): boolean {
  switch (operator) {
    case '>':
      return left > right;
    case '<':
      return left < right;
    case '>=':
      return left >= right;
    case '<=':
      return left <= right;
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    default:
      throw new Error(`Unsupported comparison operator "${operator}" (line ${token.line}, col ${token.column})`);
  }
}

function compareBooleanValues(
  left: boolean,
  right: boolean,
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=',
  token: FormulaToken,
): boolean {
  if (operator !== '==' && operator !== '!=') {
    throw new Error(`Boolean comparisons only support == and != (line ${token.line}, col ${token.column})`);
  }

  return operator === '==' ? left === right : left !== right;
}

function applyAbs(value: FormulaValue, length: number, token: FormulaToken): FormulaValue {
  if (value.kind === 'scalar-number') {
    return { kind: 'scalar-number', value: Math.abs(value.value) };
  }

  if (value.kind === 'series-number') {
    return {
      kind: 'series-number',
      values: value.values.map((item) => (item === null ? null : Math.abs(item))),
    };
  }

  throw new Error(`abs only supports numeric values (line ${token.line}, col ${token.column})`);
}

function applyExtrema(
  values: FormulaValue[],
  length: number,
  mode: 'min' | 'max',
  token: FormulaToken,
): FormulaValue {
  if (values.every((value) => value.kind === 'scalar-number')) {
    const numericValues = values.map((value) => (value as Extract<FormulaValue, { kind: 'scalar-number' }>).value);
    return {
      kind: 'scalar-number',
      value: mode === 'min' ? Math.min(...numericValues) : Math.max(...numericValues),
    };
  }

  const normalized = values.map((value) => normalizeNumericSeries(value, length, token));
  return {
    kind: 'series-number',
    values: normalized[0].map((_, index) => {
      const points = normalized.map((series) => series[index]);
      if (points.some((point) => point === null)) {
        return null;
      }
      return mode === 'min'
        ? Math.min(...(points as number[]))
        : Math.max(...(points as number[]));
    }),
  };
}

function normalizeNumericSeries(
  value: FormulaValue,
  length: number,
  token?: FormulaToken,
): Array<number | null> {
  switch (value.kind) {
    case 'scalar-number':
      return new Array(length).fill(value.value);
    case 'series-number':
      return normalizeSeriesLength(value.values, length);
    default:
      throw new Error(
        token
          ? `Expected a numeric value (line ${token.line}, col ${token.column})`
          : 'Expected a numeric value.',
      );
  }
}

function normalizeBooleanSeries(
  value: FormulaValue,
  length: number,
  token?: FormulaToken,
): Array<boolean | null> {
  switch (value.kind) {
    case 'scalar-boolean':
      return new Array(length).fill(value.value);
    case 'series-boolean':
      return normalizeSeriesLength(value.values, length);
    default:
      throw new Error(
        token
          ? `Expected a boolean value (line ${token.line}, col ${token.column})`
          : 'Expected a boolean value.',
      );
  }
}

function normalizeSeriesLength<T>(values: Array<T | null>, length: number): Array<T | null> {
  if (values.length === length) {
    return [...values];
  }

  if (values.length > length) {
    return values.slice(values.length - length);
  }

  return [...new Array(length - values.length).fill(null), ...values];
}

function requirePositiveInteger(
  value: FormulaValue,
  functionName: string,
  argIndex: number,
  token: FormulaToken,
  length: number,
): number {
  const numericValue = requireInteger(value, functionName, argIndex, token);
  if (numericValue < 1) {
    throw new Error(`${functionName} argument ${argIndex} must be >= 1 (line ${token.line}, col ${token.column})`);
  }
  return numericValue;
}

function requireInteger(
  value: FormulaValue,
  functionName: string,
  argIndex: number,
  token: FormulaToken,
): number {
  if (value.kind !== 'scalar-number') {
    throw new Error(`${functionName} argument ${argIndex} must be a scalar number (line ${token.line}, col ${token.column})`);
  }

  if (!Number.isFinite(value.value)) {
    throw new Error(`${functionName} argument ${argIndex} must be finite (line ${token.line}, col ${token.column})`);
  }

  return Math.trunc(value.value);
}

function calculateSimpleMovingAverage(
  values: Array<number | null>,
  period: number,
): Array<number | null> {
  const result = new Array<number | null>(values.length).fill(null);
  for (let index = period - 1; index < values.length; index += 1) {
    let sum = 0;
    let valid = true;

    for (let offset = index - period + 1; offset <= index; offset += 1) {
      const value = values[offset];
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

function calculateExponentialMovingAverage(
  values: Array<number | null>,
  period: number,
): Array<number | null> {
  const result = new Array<number | null>(values.length).fill(null);
  const multiplier = 2 / (period + 1);
  let seedCount = 0;
  let seedSum = 0;
  let ema: number | null = null;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === null) {
      seedCount = 0;
      seedSum = 0;
      ema = null;
      continue;
    }

    if (ema === null) {
      seedSum += value;
      seedCount += 1;
      if (seedCount === period) {
        ema = seedSum / period;
        result[index] = ema;
      }
      continue;
    }

    ema = (value - ema) * multiplier + ema;
    result[index] = ema;
  }

  return result;
}

function calculateRelativeStrengthIndex(
  values: Array<number | null>,
  period: number,
): Array<number | null> {
  const result = new Array<number | null>(values.length).fill(null);
  if (values.length <= period) {
    return result;
  }

  let gains: number[] = [];
  let losses: number[] = [];
  let avgGain: number | null = null;
  let avgLoss: number | null = null;

  for (let index = 1; index < values.length; index += 1) {
    const current = values[index];
    const previous = values[index - 1];
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
        result[index] = computeRsiValue(avgGain, avgLoss);
      }
      continue;
    }

    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    result[index] = computeRsiValue(avgGain, avgLoss);
  }

  return result;
}

function computeRsiValue(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) {
    return 100;
  }
  const relativeStrength = avgGain / avgLoss;
  return 100 - (100 / (1 + relativeStrength));
}

function calculateRollingExtreme(
  values: Array<number | null>,
  period: number,
  mode: 'min' | 'max',
): Array<number | null> {
  const result = new Array<number | null>(values.length).fill(null);
  for (let index = period - 1; index < values.length; index += 1) {
    const window = values.slice(index - period + 1, index + 1);
    if (window.some((value) => value === null)) {
      result[index] = null;
      continue;
    }

    result[index] = mode === 'min'
      ? Math.min(...(window as number[]))
      : Math.max(...(window as number[]));
  }
  return result;
}

function calculateReferenceShift(
  values: Array<number | null>,
  barsBack: number,
): Array<number | null> {
  return values.map((_, index) => {
    const sourceIndex = index - barsBack;
    if (sourceIndex < 0 || sourceIndex >= values.length) {
      return null;
    }
    return values[sourceIndex];
  });
}

function calculateChange(
  values: Array<number | null>,
  barsBack: number,
): Array<number | null> {
  const shifted = calculateReferenceShift(values, barsBack);
  return values.map((value, index) => {
    const previous = shifted[index];
    if (value === null || previous === null) {
      return null;
    }
    return value - previous;
  });
}

function calculateCross(
  left: FormulaValue,
  right: FormulaValue,
  length: number,
  direction: 'over' | 'under',
): Array<boolean | null> {
  const leftSeries = normalizeNumericSeries(left, length);
  const rightSeries = normalizeNumericSeries(right, length);
  const result = new Array<boolean | null>(length).fill(null);

  for (let index = 1; index < length; index += 1) {
    const previousLeft = leftSeries[index - 1];
    const previousRight = rightSeries[index - 1];
    const currentLeft = leftSeries[index];
    const currentRight = rightSeries[index];

    if (
      previousLeft === null ||
      previousRight === null ||
      currentLeft === null ||
      currentRight === null
    ) {
      result[index] = null;
      continue;
    }

    result[index] = direction === 'over'
      ? previousLeft <= previousRight && currentLeft > currentRight
      : previousLeft >= previousRight && currentLeft < currentRight;
  }

  return result;
}

function isNumericValue(value: FormulaValue): value is Extract<FormulaValue, { kind: 'scalar-number' | 'series-number' }> {
  return value.kind === 'scalar-number' || value.kind === 'series-number';
}

function isBooleanValue(value: FormulaValue): value is Extract<FormulaValue, { kind: 'scalar-boolean' | 'series-boolean' }> {
  return value.kind === 'scalar-boolean' || value.kind === 'series-boolean';
}

function normalizeColor(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : DEFAULT_CUSTOM_FORMULA_COLOR;
}

function roundFormulaNumber(value: number): number {
  return Math.round(value * 100) / 100;
}
