/** Bounded arithmetic grammar. Parsing never executes JavaScript or reads globals. */
export type ExpressionNode =
  | { kind: "number"; value: number }
  | { kind: "parameter"; key: string }
  | { kind: "unary"; sign: string; value: ExpressionNode }
  | { kind: "binary"; op: string; left: ExpressionNode; right: ExpressionNode }
  | { kind: "call"; name: string; args: ExpressionNode[] };
const arities: Record<string, number> = { ABS: 1, PCT_CHANGE: 2, AVG: 2, MIN: 2, MAX: 2, CLAMP: 3 };
export const expressionTokens = (text: string): string[] => {
  if (text.length > 2048) throw new Error("Expression exceeds 2048 characters.");
  const tokens: string[] = [];
  let rest = text.trim();
  while (rest) {
    const match = /^(?:\d+(?:\.\d*)?|\.\d+|[A-Z_][A-Z_0-9]*|[+*/%(),-])/.exec(rest);
    if (!match || tokens.length >= 512) throw new Error("Invalid or oversized expression.");
    tokens.push(match[0]); rest = rest.slice(match[0].length).trimStart();
  }
  return tokens;
};
export const parseExpression = (text: string, parameters: readonly string[]): ExpressionNode => {
  const tokens = expressionTokens(text);
  let index = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];
  const primary = (depth: number): ExpressionNode => {
    if (depth > 32) throw new Error("Expression nesting exceeds 32 levels.");
    const token = take();
    if (token === "+" || token === "-") return { kind: "unary", sign: token, value: primary(depth + 1) };
    if (token === "(") { const value = binary(0, depth + 1); if (take() !== ")") throw new Error("Expected closing parenthesis."); return value; }
    if (token && /^(?:\d|\.)/.test(token)) return { kind: "number", value: Number(token) };
    if (Object.hasOwn(arities, token)) {
      if (take() !== "(") throw new Error("Expected function arguments.");
      const args: ExpressionNode[] = [];
      if (peek() !== ")") {
        args.push(binary(0, depth + 1));
        while (peek() === ",") { take(); args.push(binary(0, depth + 1)); }
      }
      if (take() !== ")" || args.length !== arities[token]) throw new Error("Wrong function argument count.");
      return { kind: "call", name: token, args };
    }
    if (parameters.includes(token)) return { kind: "parameter", key: token };
    throw new Error("Unknown parameter or incomplete expression.");
  };
  const precedence = (op: string) => op === "+" || op === "-" ? 1 : ["*", "/", "%"].includes(op) ? 2 : -1;
  const binary = (minimum: number, depth: number): ExpressionNode => {
    let left = primary(depth);
    while (precedence(peek()) >= minimum) {
      const op = take();
      left = { kind: "binary", op, left, right: binary(precedence(op) + 1, depth + 1) };
    }
    return left;
  };
  const result = binary(0, 0);
  if (index !== tokens.length) throw new Error("Unexpected expression token.");
  return result;
};
export const evaluateArithmetic = (node: ExpressionNode, valueOf: (key: string) => number | undefined): number | undefined => {
  let result: number | undefined;
  if (node.kind === "number") result = node.value;
  if (node.kind === "parameter") result = valueOf(node.key);
  if (node.kind === "unary") {
    const value = evaluateArithmetic(node.value, valueOf);
    result = value === undefined ? undefined : node.sign === "-" ? -value : value;
  }
  if (node.kind === "binary") {
    const left = evaluateArithmetic(node.left, valueOf), right = evaluateArithmetic(node.right, valueOf);
    if (left === undefined || right === undefined) return undefined;
    switch (node.op) {
      case "+": result = left + right; break;
      case "-": result = left - right; break;
      case "*": result = left * right; break;
      case "/": result = right === 0 ? undefined : left / right; break;
      case "%": result = right === 0 ? undefined : left % right; break;
    }
  }
  if (node.kind === "call") {
    const args = node.args.map(arg => evaluateArithmetic(arg, valueOf));
    if (args.some(value => value === undefined)) return undefined;
    const [a, b, c] = args as number[];
    switch (node.name) {
      case "ABS": result = Math.abs(a); break;
      case "PCT_CHANGE": result = b === 0 ? undefined : (a / b - 1) * 100; break;
      case "AVG": result = (a + b) / 2; break;
      case "MIN": result = Math.min(a, b); break;
      case "MAX": result = Math.max(a, b); break;
      case "CLAMP": result = b > c ? undefined : Math.min(Math.max(a, b), c); break;
    }
  }
  return result !== undefined && Number.isFinite(result) ? result : undefined;
};
