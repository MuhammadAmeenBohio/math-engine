import { SolutionResult } from './types';

export interface NarrativeSection {
  title: string;
  rule?: string;
  content: string;
  mathExpression?: string;
}

export interface CompleteNarrative {
  title: string;
  problemType: string;
  originalProblem: string;
  strategyOverview: string;
  sections: NarrativeSection[];
  finalAnswer: string;
  verificationStatement: string;
  fullPlainText: string;
  fullMarkdownText: string;
}

function cleanMath(expr: string): string {
  let cleaned = expr;
  // Repeat fraction unwrapping in case of nested constructs or simple brackets
  for (let k = 0; k < 5; k++) {
    if (!cleaned.includes('\\frac')) break;
    cleaned = cleaned.replace(/\\frac\{((?:[^{}]|\{[^{}]*\})*)\}\{((?:[^{}]|\{[^{}]*\})*)\}/g, '($1) / ($2)');
  }
  cleaned = cleaned.replace(/\\frac/g, '');
  return cleaned
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\sqrt/g, '√')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\pm/g, '±')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\in/g, '∈')
    .replace(/\\{/g, '{')
    .replace(/\\}/g, '}')
    .replace(/\\quad/g, ' ')
    .replace(/\\,/g, ' ')
    .replace(/\\;/g, ' ')
    .replace(/\\\\/g, '')
    .replace(/\\left|\\right/g, '')
    .trim();
}

/**
 * Synthesizes a complete, continuous textbook-grade written solution in text form
 * from a deterministic CAS SolutionResult.
 */
export function generateCompleteNarrative(
  solution: SolutionResult,
  originalInput?: string
): CompleteNarrative {
  const problemExpr = originalInput?.trim() || solution.normalizedExpression || 'Mathematical Problem';
  const problemType = solution.problemType;
  const sections: NarrativeSection[] = [];

  if (!solution.success) {
    const errorMsg = solution.error || 'The expression could not be solved by the symbolic engine.';
    const plain = [
      `PROBLEM: ${problemExpr}`,
      `STATUS: Unable to solve (${solution.verificationDetails?.status || 'Error'})`,
      '',
      `EXPLANATION:`,
      errorMsg,
      '',
      `HINT: Ensure expressions use valid syntax, e.g. "2x^2 + 5x - 3 = 0", "3x + 12 = 0", or "2 * (3 + 4)".`,
    ].join('\n');

    return {
      title: 'Solution Unavailable',
      problemType: 'Unsupported',
      originalProblem: problemExpr,
      strategyOverview: 'The expression could not be evaluated.',
      sections: [{ title: 'Error Encountered', content: errorMsg }],
      finalAnswer: 'No solution found',
      verificationStatement: 'Unverified due to syntax or engine limitation.',
      fullPlainText: plain,
      fullMarkdownText: `### Problem: ${problemExpr}\n\n**Error:** ${errorMsg}`,
    };
  }

  // 1. Build Problem Strategy Overview
  let strategyOverview = '';
  switch (problemType) {
    case 'Quadratic Equation':
      strategyOverview =
        'We solve this quadratic equation algebraically by expressing it in standard form ax² + bx + c = 0, determining the discriminant Δ = b² - 4ac, and applying the quadratic formula with exact arithmetic.';
      break;
    case 'Linear Equation':
      strategyOverview =
        'We solve this first-degree polynomial equation by grouping all variable terms on one side, isolating the unknown via inverse arithmetic operations, and evaluating the exact rational root.';
      break;
    case 'Arithmetic':
      strategyOverview =
        'We evaluate this numerical expression strictly following the standard order of operations (PEMDAS/BODMAS), simplifying grouped sub-expressions and executing exact rational arithmetic.';
      break;
    default:
      strategyOverview =
        'We solve the mathematical problem using deterministic symbolic computation and verify the result.';
  }

  // 2. Build Narrative Sections from CAS steps
  if (solution.steps && solution.steps.length > 0) {
    for (const step of solution.steps) {
      sections.push({
        title: `Step ${step.stepNumber}: ${step.title}`,
        rule: step.rule,
        content: step.description,
        mathExpression: step.mathExpression,
      });
    }
  } else {
    sections.push({
      title: 'Direct Evaluation',
      rule: 'Deterministic CAS',
      content: 'The expression was simplified directly to its canonical representation without intermediate transforms.',
      mathExpression: `${problemExpr} = ${solution.finalAnswerPlain}`,
    });
  }

  // 3. Verification statement
  const verificationStatement = solution.isVerified
    ? `The solution has been algebraically verified by direct substitution (LHS = ${solution.verificationDetails?.lhsValue ?? 0}, RHS = ${solution.verificationDetails?.rhsValue ?? 0}, residual norm = ${solution.verificationDetails?.residualNorm ?? 0}). It is mathematically rigorous and exact.`
    : `The solution was derived deterministically (status: ${solution.verificationDetails?.status || 'Derived'}).`;

  // 4. Construct complete mathematical solution (pure math lines, zero English words)
  const mathLines: string[] = [];
  const initialMath = cleanMath(problemExpr);
  mathLines.push(initialMath);

  if (solution.steps && solution.steps.length > 0) {
    for (const step of solution.steps) {
      if (step.mathExpression) {
        const cleaned = cleanMath(step.mathExpression);
        if (cleaned !== initialMath && !mathLines.includes(cleaned)) {
          mathLines.push(cleaned);
        }
      }
    }
  }

  const finalClean = cleanMath(solution.finalAnswerPlain);
  if (!mathLines.includes(finalClean) && !mathLines.some((l) => l.endsWith(`= ${finalClean}`))) {
    mathLines.push(finalClean);
  }

  const fullPlainText = mathLines.join('\n');

  // 5. Construct complete Markdown in pure LaTeX equations (no English)
  const mdLines: string[] = [];
  mdLines.push(`$$${problemExpr}$$`);

  if (solution.steps && solution.steps.length > 0) {
    for (const step of solution.steps) {
      if (step.mathExpression && step.mathExpression !== problemExpr) {
        mdLines.push(`$$\\Downarrow$$`);
        mdLines.push(`$$${step.mathExpression}$$`);
      }
    }
  }

  const finalLatex = solution.finalAnswerLatex || solution.finalAnswerPlain;
  if (!mdLines.includes(`$$${finalLatex}$$`)) {
    mdLines.push(`$$\\Downarrow$$`);
    mdLines.push(`$$\\mathbf{${finalLatex}}$$`);
  }

  const fullMarkdownText = mdLines.join('\n\n');

  return {
    title: `Complete Written Solution for ${problemExpr}`,
    problemType,
    originalProblem: problemExpr,
    strategyOverview,
    sections,
    finalAnswer: solution.finalAnswerPlain,
    verificationStatement,
    fullPlainText,
    fullMarkdownText,
  };
}
