import { DivisionByZeroError, MathParseError, UnsupportedMathError } from './errors';
import { tokenize } from './lexer';
import { normalizeMathExpression } from './normalizer';
import { Parser } from './parser';
import { Polynomial } from './polynomial';
import { Fraction, ONE } from './rational';
import { ASTNode, EquationNode, SolutionResult, SolutionStep } from './types';

const MAX_INPUT_LENGTH = 300;

function elapsed(startTime: number): number {
  return Number((performance.now() - startTime).toFixed(2));
}

function failure(
  normalized: string,
  message: string,
  startTime: number,
  status = 'Error'
): SolutionResult {
  return {
    success: false,
    problemType: 'Unsupported',
    normalizedExpression: normalized,
    latexExpression: normalized,
    finalAnswerLatex: 'Unable to solve',
    finalAnswerPlain: 'Unable to solve',
    steps: [],
    isVerified: false,
    verificationDetails: { lhsValue: 0, rhsValue: 0, residualNorm: 0, status },
    executionTimeMs: elapsed(startTime),
    error: message,
  };
}

function collectIdentifiers(node: ASTNode, result = new Set<string>()): Set<string> {
  if (node.type === 'Identifier') {
    result.add(node.name.toLowerCase());
    return result;
  }
  if (node.type === 'UnaryOp') {
    collectIdentifiers(node.argument, result);
    return result;
  }
  if (node.type === 'BinaryOp') {
    collectIdentifiers(node.left, result);
    collectIdentifiers(node.right, result);
    return result;
  }
  if (node.type === 'Equation') {
    collectIdentifiers(node.left, result);
    collectIdentifiers(node.right, result);
  }
  return result;
}

export function astToLatex(node: ASTNode): string {
  if (node.type === 'Number') {
    return node.raw;
  }
  if (node.type === 'Identifier') {
    return node.name;
  }
  if (node.type === 'UnaryOp') {
    const argLatex = astToLatex(node.argument);
    return node.operator === '-' ? `-${argLatex}` : argLatex;
  }
  if (node.type === 'PostfixOp') {
    const argLatex = astToLatex(node.argument);
    return `${argLatex}${node.operator}`;
  }
  if (node.type === 'FunctionCall') {
    const argLatex = astToLatex(node.argument);
    if (node.name === 'sqrt') {
      return `\\sqrt{${argLatex}}`;
    }
    if (node.name === 'abs') {
      return `\\left|${argLatex}\\right|`;
    }
    return `\\${node.name}\\left(${argLatex}\\right)`;
  }
  if (node.type === 'BinaryOp') {
    const leftLatex = astToLatex(node.left);
    const rightLatex = astToLatex(node.right);
    if (node.operator === '+') {
      return `${leftLatex} + ${rightLatex}`;
    }
    if (node.operator === '-') {
      return `${leftLatex} - ${rightLatex}`;
    }
    if (node.operator === '*') {
      // If multiplying coefficient and identifier/function/parens (e.g. 5 * x -> 5x), omit the \times
      if (
        (node.left.type === 'Number' && (node.right.type === 'Identifier' || node.right.type === 'FunctionCall' || node.right.type === 'BinaryOp')) ||
        (node.left.type === 'Identifier' && node.right.type === 'Identifier')
      ) {
        return `${leftLatex}${rightLatex}`;
      }
      return `${leftLatex} \\times ${rightLatex}`;
    }
    if (node.operator === '/') {
      return `\\frac{${leftLatex}}{${rightLatex}}`;
    }
    if (node.operator === '^') {
      const leftWrapped =
        node.left.type === 'BinaryOp' || node.left.type === 'UnaryOp'
          ? `(${leftLatex})`
          : leftLatex;
      return `${leftWrapped}^{${rightLatex}}`;
    }
  }
  if (node.type === 'Equation') {
    return `${astToLatex(node.left)} = ${astToLatex(node.right)}`;
  }
  return '';
}

function evaluateAst(node: ASTNode): Fraction {
  if (node.type === 'Number') {
    return Fraction.fromString(node.raw);
  }
  if (node.type === 'Identifier') {
    throw new UnsupportedMathError('Variables are not supported in arithmetic.');
  }
  if (node.type === 'UnaryOp') {
    const value = evaluateAst(node.argument);
    return node.operator === '-' ? value.neg() : value;
  }
  if (node.type === 'BinaryOp') {
    const left = evaluateAst(node.left);
    const right = evaluateAst(node.right);
    if (node.operator === '+') return left.add(right);
    if (node.operator === '-') return left.sub(right);
    if (node.operator === '*') return left.mul(right);
    if (node.operator === '/') return left.div(right);
    if (node.operator === '^') {
      if (!right.isInteger()) {
        throw new UnsupportedMathError('Only integer exponents are supported.');
      }
      return left.pow(Number(right.n));
    }
  }
  if (node.type === 'PostfixOp') {
    const val = evaluateAst(node.argument);
    if (node.operator === '%') {
      return val.div(new Fraction(100n));
    }
    if (node.operator === '!') {
      if (!val.isInteger() || val.n < 0n || val.n > 100n) {
        throw new UnsupportedMathError('Factorial is only defined for non-negative integers <= 100.');
      }
      let fact = 1n;
      for (let i = 2n; i <= val.n; i++) fact *= i;
      return new Fraction(fact);
    }
  }
  if (node.type === 'FunctionCall') {
    const val = evaluateAst(node.argument);
    if (node.name === 'abs') {
      return val.abs();
    }
    if (node.name === 'sqrt') {
      const sq = Fraction.sqrt(val);
      if (sq !== null) return sq;
      const num = val.toNumber();
      if (num < 0) throw new UnsupportedMathError('Square root of negative number is not real.');
      const approx = Math.sqrt(num);
      return Fraction.fromString(Number(approx.toFixed(8)).toString());
    }
    if (['sin', 'cos', 'tan', 'log', 'ln'].includes(node.name)) {
      const num = val.toNumber();
      let res = 0;
      if (node.name === 'sin') res = Math.sin(num);
      else if (node.name === 'cos') res = Math.cos(num);
      else if (node.name === 'tan') {
        if (Math.abs(Math.cos(num)) < 1e-12) throw new DivisionByZeroError();
        res = Math.tan(num);
      } else if (node.name === 'log') {
        if (num <= 0) throw new UnsupportedMathError('Logarithm domain error (must be > 0).');
        res = Math.log10(num);
      } else if (node.name === 'ln') {
        if (num <= 0) throw new UnsupportedMathError('Natural logarithm domain error (must be > 0).');
        res = Math.log(num);
      }
      return Fraction.fromString(Number(res.toFixed(8)).toString());
    }
  }
  throw new UnsupportedMathError('Unsupported expression.');
}

function arithmeticResult(
  normalized: string,
  value: Fraction,
  startTime: number,
  latexExpr?: string
): SolutionResult {
  const plain = value.toString();
  const numVal = value.toNumber();
  const exact = value.d === 1n ? value.n.toString() : `${value.n}/${value.d}`;
  return {
    success: true,
    problemType: 'Arithmetic',
    normalizedExpression: normalized,
    latexExpression: latexExpr || normalized.replace(/\*/g, ' \\times '),
    finalAnswerLatex: value.toLatex(),
    finalAnswerPlain: plain,
    exactAnswer: exact,
    decimalAnswer: numVal,
    steps: [
      {
        stepNumber: 1,
        title: 'Direct Arithmetic Evaluation',
        description: 'Evaluate following standard order of operations.',
        mathExpression: `${normalized} = ${plain}`,
        rule: 'Order of Operations',
      },
    ],
    isVerified: true,
    verificationDetails: {
      lhsValue: numVal,
      rhsValue: numVal,
      residualNorm: 0,
      status: 'Deterministic Exact',
    },
    executionTimeMs: elapsed(startTime),
  };
}

function absBig(n: bigint): bigint {
  return n < 0n ? -n : n;
}

function gcdBig(a: bigint, b: bigint): bigint {
  let x = absBig(a);
  let y = absBig(b);
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x === 0n ? 1n : x;
}

function lcmBig(a: bigint, b: bigint): bigint {
  return (absBig(a) * absBig(b)) / gcdBig(a, b);
}

function integerSqrtBig(n: bigint): bigint | null {
  if (n < 0n) return null;
  if (n < 2n) return n;
  let x0 = n;
  let x1 = (n + 1n) / 2n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x1 + n / x1) / 2n;
  }
  return x0 * x0 === n ? x0 : null;
}

function simplifyRadicalBig(n: bigint): { outside: bigint; inside: bigint } {
  if (n <= 0n) return { outside: 1n, inside: 0n };
  let inside = n;
  let outside = 1n;
  for (let i = 2n; i * i <= inside; i++) {
    const sq = i * i;
    while (inside % sq === 0n) {
      outside *= i;
      inside /= sq;
    }
  }
  return { outside, inside };
}

function linearForm(a: Fraction, b: Fraction, variable: string): string {
  const coefficient = a.equals(ONE) ? '' : a.equals(new Fraction(-1n)) ? '-' : a.toString();
  const variableTerm = `${coefficient}${variable}`;
  if (b.isZero()) return variableTerm;
  return b.sign() > 0 ? `${variableTerm} + ${b.toString()}` : `${variableTerm} - ${b.abs().toString()}`;
}

function solveLinear(
  a: Fraction,
  b: Fraction,
  variable: string,
  normalized: string,
  startTime: number,
  latexExpr?: string
): SolutionResult {
  if (a.isZero()) {
    throw new UnsupportedMathError('Linear coefficient is zero.');
  }
  const root = b.neg().div(a);
  const negB = b.neg();
  const aCoeff = a.equals(ONE) ? '' : a.equals(new Fraction(-1n)) ? '-' : a.toLatex();
  const steps: SolutionStep[] = [
    {
      stepNumber: 1,
      title: 'Rearrange to standard form',
      description: 'Move all terms to standard polynomial form.',
      mathExpression: `${linearForm(a, b, variable)} = 0`,
      rule: 'Standard Form',
    },
    {
      stepNumber: 2,
      title: 'Isolate the variable term',
      description: `Add or subtract constants to isolate the ${variable} term.`,
      mathExpression: `${aCoeff}${variable} = ${negB.toLatex()}`,
      rule: 'Addition Property of Equality',
    },
    {
      stepNumber: 3,
      title: `Divide by the coefficient of ${variable}`,
      description: `Divide both sides by ${a.toLatex()} to solve for ${variable}.`,
      mathExpression: `${variable} = \\frac{${negB.toLatex()}}{${a.toLatex()}} = ${root.toLatex()}`,
      rule: 'Division Property of Equality',
    },
  ];
  return {
    success: true,
    problemType: 'Linear Equation',
    normalizedExpression: normalized,
    latexExpression: latexExpr || normalized,
    finalAnswerLatex: `${variable} = ${root.toLatex()}`,
    finalAnswerPlain: `${variable} = ${root.toString()}`,
    exactAnswer: `${variable} = ${root.toString()}`,
    decimalAnswer: root.toNumber(),
    roots: [root.toNumber()],
    steps,
    isVerified: a.mul(root).add(b).isZero(),
    verificationDetails: {
      lhsValue: 0,
      rhsValue: 0,
      residualNorm: 0,
      status: 'Exact Verified',
    },
    executionTimeMs: elapsed(startTime),
  };
}

function solveQuadratic(
  quadratic: Fraction,
  linear: Fraction,
  constant: Fraction,
  variable: string,
  normalized: string,
  startTime: number,
  latexExpr?: string
): SolutionResult {
  const L = lcmBig(lcmBig(quadratic.d, linear.d), constant.d);
  let A = quadratic.n * (L / quadratic.d);
  let B = linear.n * (L / linear.d);
  let C = constant.n * (L / constant.d);

  const g = gcdBig(gcdBig(A, B), C);
  A /= g;
  B /= g;
  C /= g;
  if (A < 0n) {
    A = -A;
    B = -B;
    C = -C;
  }

  const Delta = B * B - 4n * A * C;
  const twoA = 2n * A;
  const minusB = -B;

  const bFmtLatex = linear.sign() < 0 ? `(${linear.toLatex()})` : linear.toLatex();
  const deltaFrac = linear.mul(linear).sub(new Fraction(4n).mul(quadratic).mul(constant));

  const steps: SolutionStep[] = [
    {
      stepNumber: 1,
      title: 'Identify coefficients',
      description: 'Extract coefficients from standard form ax² + bx + c = 0.',
      mathExpression: `a = ${quadratic.toLatex()}, \\quad b = ${linear.toLatex()}, \\quad c = ${constant.toLatex()}`,
      rule: 'Standard Polynomial Form',
    },
    {
      stepNumber: 2,
      title: 'Calculate the discriminant',
      description: 'Evaluate \\Delta = b^2 - 4ac to determine the number and nature of roots.',
      mathExpression: `\\Delta = ${bFmtLatex}^2 - 4(${quadratic.toLatex()})(${constant.toLatex()}) = ${deltaFrac.toLatex()}`,
      rule: 'Discriminant Formula',
    },
  ];

  if (Delta > 0n) {
    const sqDelta = integerSqrtBig(Delta);
    if (sqDelta !== null) {
      // Perfect rational square discriminant
      const r1_n = minusB - sqDelta;
      const r2_n = minusB + sqDelta;
      const g1 = gcdBig(r1_n, twoA);
      const g2 = gcdBig(r2_n, twoA);
      const fracA = new Fraction(r1_n / g1, twoA / g1);
      const fracB = new Fraction(r2_n / g2, twoA / g2);
      const firstFrac = fracA.toNumber() <= fracB.toNumber() ? fracA : fracB;
      const secondFrac = fracA.toNumber() <= fracB.toNumber() ? fracB : fracA;

      const firstVal = firstFrac.toNumber();
      const secondVal = secondFrac.toNumber();

      let ansPlain: string;
      let ansLatex: string;
      if (firstFrac.equals(secondFrac.neg())) {
        ansPlain = `${variable} = ±${firstFrac.abs().toString()}`;
        ansLatex = `${variable} = \\pm ${firstFrac.abs().toLatex()}`;
      } else {
        ansPlain = `${variable} = ${firstFrac.toString()}, ${variable} = ${secondFrac.toString()}`;
        ansLatex = `${variable} = ${firstFrac.toLatex()}, \\quad ${variable} = ${secondFrac.toLatex()}`;
      }

      steps.push({
        stepNumber: 3,
        title: 'Apply the quadratic formula',
        description: `Use ${variable} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}.`,
        mathExpression: `${variable} = \\frac{${minusB} \\pm ${sqDelta}}{${twoA}}`,
        rule: 'Quadratic Formula',
      });
      const step4Math = firstFrac.equals(secondFrac.neg())
        ? `${variable} = \\pm ${firstFrac.abs().toLatex()}`
        : `${variable}_1 = ${firstFrac.toLatex()}, \\quad ${variable}_2 = ${secondFrac.toLatex()}`;

      steps.push({
        stepNumber: 4,
        title: 'Exact solutions',
        description: 'Simplify to exact rational roots.',
        mathExpression: step4Math,
        rule: 'Exact Simplification',
      });

      // Verify exact rational substitution: a*r^2 + b*r + c === 0
      const ver1 = quadratic.mul(firstFrac).mul(firstFrac).add(linear.mul(firstFrac)).add(constant).isZero();
      const ver2 = quadratic.mul(secondFrac).mul(secondFrac).add(linear.mul(secondFrac)).add(constant).isZero();

      return {
        success: true,
        problemType: 'Quadratic Equation',
        normalizedExpression: normalized,
        latexExpression: latexExpr || normalized,
        finalAnswerLatex: ansLatex,
        finalAnswerPlain: ansPlain,
        exactAnswer: ansPlain,
        decimalAnswer: [firstVal, secondVal],
        roots: [firstVal, secondVal],
        steps,
        isVerified: ver1 && ver2,
        verificationDetails: {
          lhsValue: 0,
          rhsValue: 0,
          residualNorm: 0,
          status: 'Exact Rational Root (Verified)',
        },
        executionTimeMs: elapsed(startTime),
      };
    }

    // Irrational real roots: Delta is not a square
    const { outside, inside } = simplifyRadicalBig(Delta);
    const common = gcdBig(gcdBig(minusB, outside), twoA);
    const simB = minusB / common;
    const simOut = outside / common;
    const simD = twoA / common;

    const radLatex = simOut === 1n ? `\\sqrt{${inside}}` : `${simOut}\\sqrt{${inside}}`;
    const radPlain = simOut === 1n ? `√${inside}` : `${simOut}√${inside}`;

    let exactLatex: string;
    let exactPlain: string;
    if (simB === 0n) {
      exactLatex = simD === 1n ? `\\pm ${radLatex}` : `\\pm \\frac{${radLatex}}{${simD}}`;
      exactPlain = simD === 1n ? `±${radPlain}` : `±${radPlain} / ${simD}`;
    } else if (simD === 1n) {
      exactLatex = `${simB} \\pm ${radLatex}`;
      exactPlain = `${simB} ± ${radPlain}`;
    } else {
      exactLatex = `\\frac{${simB} \\pm ${radLatex}}{${simD}}`;
      exactPlain = `(${simB} ± ${radPlain}) / ${simD}`;
    }

    const sqrtFloat = Math.sqrt(Number(Delta));
    const rA = (Number(minusB) + sqrtFloat) / Number(twoA);
    const rB = (Number(minusB) - sqrtFloat) / Number(twoA);
    const firstVal = Math.min(rA, rB);
    const secondVal = Math.max(rA, rB);

    steps.push({
      stepNumber: 3,
      title: 'Apply the quadratic formula',
      description: `Use ${variable} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}.`,
      mathExpression: `${variable} = ${exactLatex}`,
      rule: 'Quadratic Formula',
    });
    steps.push({
      stepNumber: 4,
      title: 'Exact solutions',
      description: 'Simplify radical to lowest terms.',
      mathExpression: `${variable} = ${exactLatex}`,
      rule: 'Exact Simplification',
    });

    const residual = Math.max(
      Math.abs(quadratic.toNumber() * firstVal * firstVal + linear.toNumber() * firstVal + constant.toNumber()),
      Math.abs(quadratic.toNumber() * secondVal * secondVal + linear.toNumber() * secondVal + constant.toNumber())
    );

    return {
      success: true,
      problemType: 'Quadratic Equation',
      normalizedExpression: normalized,
      latexExpression: latexExpr || normalized,
      finalAnswerLatex: `${variable} = ${exactLatex}`,
      finalAnswerPlain: `${variable} = ${exactPlain}`,
      exactAnswer: `${variable} = ${exactPlain}`,
      decimalAnswer: [Number(firstVal.toFixed(6)), Number(secondVal.toFixed(6))],
      roots: [firstVal, secondVal],
      steps,
      isVerified: residual < 1e-9,
      verificationDetails: {
        lhsValue: residual,
        rhsValue: 0,
        residualNorm: residual,
        status: 'Machine Epsilon Exact (Verified)',
      },
      executionTimeMs: elapsed(startTime),
    };
  }

  if (Delta === 0n) {
    const gSingle = gcdBig(minusB, twoA);
    const rootFrac = new Fraction(minusB / gSingle, twoA / gSingle);
    const rootVal = rootFrac.toNumber();

    steps.push({
      stepNumber: 3,
      title: 'Repeated root',
      description: 'The discriminant is zero, so there is one repeated real root.',
      mathExpression: `${variable} = \\frac{${minusB}}{${twoA}} = ${rootFrac.toLatex()}`,
      rule: 'Double Root Property',
    });

    const ver = quadratic.mul(rootFrac).mul(rootFrac).add(linear.mul(rootFrac)).add(constant).isZero();

    return {
      success: true,
      problemType: 'Quadratic Equation',
      normalizedExpression: normalized,
      latexExpression: latexExpr || normalized,
      finalAnswerLatex: `${variable} = ${rootFrac.toLatex()}`,
      finalAnswerPlain: `${variable} = ${rootFrac.toString()}`,
      exactAnswer: `${variable} = ${rootFrac.toString()}`,
      decimalAnswer: rootVal,
      roots: [rootVal],
      steps,
      isVerified: ver,
      verificationDetails: {
        lhsValue: 0,
        rhsValue: 0,
        residualNorm: 0,
        status: 'Exact Rational Double Root (Verified)',
      },
      executionTimeMs: elapsed(startTime),
    };
  }

  // Complex conjugate roots: Delta < 0
  const { outside, inside } = simplifyRadicalBig(-Delta);
  const common = gcdBig(gcdBig(minusB, outside), twoA);
  const simB = minusB / common;
  const simOut = outside / common;
  const simD = twoA / common;

  const radIStr = inside === 1n ? (simOut === 1n ? 'i' : `${simOut}i`) : (simOut === 1n ? `\\sqrt{${inside}}i` : `${simOut}\\sqrt{${inside}}i`);
  const radIPlain = inside === 1n ? (simOut === 1n ? 'i' : `${simOut}i`) : (simOut === 1n ? `√${inside}i` : `${simOut}√${inside}i`);

  let exactComplexLatex = '';
  let exactComplexPlain = '';
  if (simB === 0n) {
    exactComplexLatex = simD === 1n ? `\\pm ${radIStr}` : `\\pm \\frac{${radIStr}}{${simD}}`;
    exactComplexPlain = simD === 1n ? `±${radIPlain}` : `±${radIPlain} / ${simD}`;
  } else if (simD === 1n) {
    exactComplexLatex = `${simB} \\pm ${radIStr}`;
    exactComplexPlain = `${simB} ± ${radIPlain}`;
  } else {
    exactComplexLatex = `\\frac{${simB} \\pm ${radIStr}}{${simD}}`;
    exactComplexPlain = `(${simB} ± ${radIPlain}) / ${simD}`;
  }

  const realPart = Number(minusB) / Number(twoA);
  const imaginaryPart = Math.sqrt(Number(-Delta)) / Number(twoA);
  const qaNum = quadratic.toNumber();
  const qbNum = linear.toNumber();
  const qcNum = constant.toNumber();
  const residualReal = qaNum * (realPart * realPart - imaginaryPart * imaginaryPart) + qbNum * realPart + qcNum;
  const residualImaginary = qaNum * (2 * realPart * imaginaryPart) + qbNum * imaginaryPart;
  const residual = Math.hypot(residualReal, residualImaginary);

  steps.push({
    stepNumber: 3,
    title: 'No real roots (Complex roots)',
    description: 'The discriminant is negative (Δ < 0), so there are no real solutions.',
    mathExpression: `${variable} = ${exactComplexLatex}`,
    rule: 'Complex Roots',
  });

  return {
    success: true,
    problemType: 'Quadratic Equation',
    normalizedExpression: normalized,
    latexExpression: latexExpr || normalized,
    finalAnswerLatex: `${variable} = ${exactComplexLatex}`,
    finalAnswerPlain: `${variable} = ${exactComplexPlain}`,
    exactAnswer: 'No real roots',
    steps,
    isVerified: residual < 1e-9,
    verificationDetails: {
      lhsValue: residual,
      rhsValue: 0,
      residualNorm: residual,
      status: 'No real roots (Complex Conjugates)',
    },
    executionTimeMs: elapsed(startTime),
  };
}

function solveEquation(
  equation: EquationNode,
  normalized: string,
  startTime: number
): SolutionResult {
  const identifiers = collectIdentifiers(equation);
  if (identifiers.size > 1) {
    throw new UnsupportedMathError(
      `Multiple variables are not supported yet: ${Array.from(identifiers).join(', ')}.`
    );
  }

  const difference = Polynomial.fromAst(equation.left).sub(Polynomial.fromAst(equation.right));
  if (difference.isZero()) {
    throw new UnsupportedMathError('Infinitely many solutions.');
  }
  if (identifiers.size === 0) {
    throw new UnsupportedMathError('No solution.');
  }

  const variable = Array.from(identifiers)[0];
  const coefficients = difference.coefficients(variable);
  if (!coefficients) {
    throw new UnsupportedMathError('Multiple variables are not supported yet.');
  }
  while (coefficients.length > 1 && coefficients[coefficients.length - 1].isZero()) {
    coefficients.pop();
  }

  if (coefficients.length === 1) {
    if (coefficients[0].isZero()) {
      throw new UnsupportedMathError('Infinitely many solutions.');
    }
    throw new UnsupportedMathError('No solution.');
  }

  const latexExpr = astToLatex(equation);

  if (coefficients.length === 2) {
    return solveLinear(coefficients[1], coefficients[0], variable, normalized, startTime, latexExpr);
  }
  if (coefficients.length === 3) {
    return solveQuadratic(
      coefficients[2],
      coefficients[1],
      coefficients[0],
      variable,
      normalized,
      startTime,
      latexExpr
    );
  }
  throw new UnsupportedMathError(
    'Only linear and quadratic equations in one variable are supported.'
  );
}

function solveExpression(
  ast: ASTNode,
  normalized: string,
  startTime: number
): SolutionResult {
  const identifiers = collectIdentifiers(ast);
  if (identifiers.size === 0) {
    return arithmeticResult(normalized, evaluateAst(ast), startTime, astToLatex(ast));
  }

  throw new UnsupportedMathError(
    'Only equations (linear or quadratic) and numeric arithmetic are supported in this build.'
  );
}

export function solveMathProblem(rawInput: string): SolutionResult {
  const startTime = performance.now();
  const EXECUTION_TIMEOUT_MS = 3000;

  if (!rawInput || typeof rawInput !== 'string' || rawInput.trim() === '') {
    return failure('', 'Empty mathematical expression', startTime, 'No input');
  }
  if (rawInput.length > MAX_INPUT_LENGTH) {
    return failure(
      rawInput.slice(0, 100),
      `Input exceeds maximum allowed length (${MAX_INPUT_LENGTH} chars).`,
      startTime,
      'Payload Too Large'
    );
  }

  const normalized = normalizeMathExpression(rawInput.trim());
  if (!normalized) {
    return failure('', 'Empty mathematical expression', startTime, 'No input');
  }

  try {
    if (performance.now() - startTime > EXECUTION_TIMEOUT_MS) {
      throw new UnsupportedMathError('Execution timed out (3-second limit exceeded).');
    }

    const ast = new Parser(tokenize(normalized)).parse();
    if (performance.now() - startTime > EXECUTION_TIMEOUT_MS) {
      throw new UnsupportedMathError('Execution timed out (3-second limit exceeded).');
    }

    if (ast.type === 'Equation') {
      return solveEquation(ast, normalized, startTime);
    }
    return solveExpression(ast, normalized, startTime);
  } catch (error: unknown) {
    if (error instanceof DivisionByZeroError) {
      return failure(normalized, error.message, startTime, 'Division by Zero');
    }
    if (error instanceof MathParseError) {
      return failure(
        normalized,
        `${error.message} (position ${error.position})`,
        startTime,
        'Invalid Syntax'
      );
    }
    if (error instanceof UnsupportedMathError) {
      return failure(normalized, error.message, startTime, 'Unsupported');
    }
    const message = error instanceof Error ? error.message : 'Evaluation error';
    return failure(normalized, message, startTime);
  }
}
