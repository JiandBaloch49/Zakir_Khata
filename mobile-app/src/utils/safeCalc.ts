/**
 * safeCalc — a self-contained arithmetic evaluator for the expense calculator.
 *
 * WHY THIS EXISTS: the calculator previously used eval(). Hermes disables eval in
 * RELEASE builds, so the shipped APK could never evaluate an amount — and the
 * amount field is editable={false}, making the calculator the only way to enter
 * one. No eval, no Function constructor, no dynamic code execution of any kind.
 *
 * Grammar (matches exactly what the keypad can produce, nothing more):
 *   expression := term (('+' | '-') term)*
 *   term       := factor (('*' | '/') factor)*
 *   factor     := ('-' | '+')? factor | number
 *   number     := digits ('.' digits?)? | '.' digits
 *
 * Precedence is standard JS precedence (× ÷ bind tighter than + −), matching the
 * old eval behaviour so the user never sees a different answer than before.
 *
 * `M` (from the non-functional M+ / M- keys) is rejected as invalid input, which
 * reproduces the old behaviour — eval threw ReferenceError on it.
 */

export type CalcResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

/**
 * Strips binary floating-point artefacts (0.1 + 0.2 -> 0.30000000000000004)
 * without truncating legitimate precision. toFixed is used rather than
 * multiply-round-divide because the latter overflows Number.MAX_SAFE_INTEGER
 * for large amounts.
 */
const stripFloatNoise = (n: number): number => parseFloat(n.toFixed(10));

export function evaluateExpression(input: string): CalcResult {
  const src = (input ?? '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/\s+/g, '');

  if (src.length === 0) return { ok: false, error: 'Empty expression' };

  // Reject anything outside the grammar up front — letters (incl. "M" from the
  // M+/M- keys), parentheses, "Error", "undefined", etc.
  if (!/^[0-9.+\-*/]+$/.test(src)) {
    return { ok: false, error: 'Invalid characters in expression' };
  }

  let pos = 0;
  let failure: string | null = null;

  const fail = (message: string): number => {
    if (failure === null) failure = message;
    return 0;
  };

  const peek = (): string | undefined => src[pos];
  const isDigit = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '9';

  const parseNumber = (): number => {
    const start = pos;
    while (isDigit(peek())) pos++;
    if (peek() === '.') {
      pos++;
      while (isDigit(peek())) pos++;
    }
    const text = src.slice(start, pos);
    if (text === '' || text === '.') return fail('Incomplete number');
    const value = parseFloat(text);
    if (!isFinite(value)) return fail('Invalid number');
    return value;
  };

  const parseFactor = (): number => {
    if (failure !== null) return 0;
    const c = peek();
    if (c === '-') { pos++; return -parseFactor(); }
    if (c === '+') { pos++; return parseFactor(); }
    if (c === undefined) return fail('Expression ends with an operator');
    if (isDigit(c) || c === '.') return parseNumber();
    return fail('Unexpected symbol');
  };

  const parseTerm = (): number => {
    let acc = parseFactor();
    while (failure === null && (peek() === '*' || peek() === '/')) {
      const op = peek();
      pos++;
      const rhs = parseFactor();
      if (failure !== null) return 0;
      if (op === '/') {
        // Never let Infinity reach the caller — it would pass a naive > 0 check.
        if (rhs === 0) return fail('Cannot divide by zero');
        acc = acc / rhs;
      } else {
        acc = acc * rhs;
      }
    }
    return acc;
  };

  const parseExpression = (): number => {
    let acc = parseTerm();
    while (failure === null && (peek() === '+' || peek() === '-')) {
      const op = peek();
      pos++;
      const rhs = parseTerm();
      if (failure !== null) return 0;
      acc = op === '+' ? acc + rhs : acc - rhs;
    }
    return acc;
  };

  const value = parseExpression();

  if (failure !== null) return { ok: false, error: failure };
  if (pos !== src.length) return { ok: false, error: 'Unexpected symbol' };
  if (!isFinite(value)) return { ok: false, error: 'Result is not a valid number' };

  return { ok: true, value: stripFloatNoise(value) };
}
