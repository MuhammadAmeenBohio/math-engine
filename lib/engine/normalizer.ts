/**
 * Math Engine - Normalizer
 * FR-ME-01: Cleans variants, replaces multiplication/minus signs,
 * fixes common OCR misrecognitions, and expands implicit multiplication.
 */

export function convertLatexToStandardMath(raw: string): string {
  let s = raw;

  // Remove LaTeX delimiters and spacing modifiers: $, $$, \left, \right, \, \quad, \qquad, \text{...}
  s = s.replace(/\${1,2}/g, '');
  s = s.replace(/\\(?:left|right)/g, '');
  s = s.replace(/\\(?:,|;|!|quad|qquad|enspace)/g, ' ');
  s = s.replace(/\\text\{([^{}]+)\}/g, '$1');

  // Multiplications & divisions
  s = s.replace(/\\(?:cdot|times)/g, '*');
  s = s.replace(/\\div/g, '/');
  s = s.replace(/\\pm/g, '+-');

  // Integrals & differentials (leave bounds intact for solver parser)
  s = s.replace(/\\int(?=[_^])/g, 'integral');
  s = s.replace(/\\int\b/g, 'integral ');
  s = s.replace(/[∫\u222B](?=[_^])/g, 'integral');
  s = s.replace(/[∫\u222B]/g, 'integral ');

  // Limits
  s = s.replace(/\\lim_\{([a-zA-Z])\s*(?:\\to|->)\s*([^{}]+)\}/g, 'lim $1->$2 ');
  s = s.replace(/\\lim/g, 'lim ');

  // Derivatives
  s = s.replace(/\\frac\{d\}\{d([a-zA-Z])\}/g, 'd/d$1 ');
  s = s.replace(/\\frac\{d([a-zA-Z])\}\{d([a-zA-Z])\}/g, 'd/d$2 ');

  // Square roots and n-th roots: \sqrt{...} -> sqrt(...)
  s = s.replace(/\\sqrt\[([^{}]+)\]\{([^{}]+)\}/g, '($2)^(1/($1))');
  s = s.replace(/\\sqrt\{([^{}]+)\}/g, 'sqrt($1)');

  // Fractions: recursively replace \frac{num}{den} with (num)/(den)
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 10) {
    iterations++;
    const prev = s;
    s = s.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1)/($2)');
    changed = prev !== s;
  }

  // Inverse trigonometric functions in LaTeX: \tan^{-1}, \sin^{-1}, \cos^{-1}, \cot^{-1}, \sec^{-1}, \csc^{-1}
  s = s.replace(/\\(sin|cos|tan|cot|sec|csc)\s*(?:\^\{?\s*-1\s*\}?|\^\s*\(?\s*-1\s*\)?)/g, 'arc$1');
  s = s.replace(/\b(sin|cos|tan|cot|sec|csc)\s*(?:\^\{?\s*-1\s*\}?|\^\s*\(?\s*-1\s*\)?)/g, 'arc$1');

  // Common LaTeX functions: \sin, \cos, \tan, \log, \ln
  s = s.replace(/\\(sin|cos|tan|log|ln|arcsin|arccos|arctan)\b/g, '$1');

  // Exponents with braces: x^{2} -> x^2 or (x)^{n+1}
  s = s.replace(/\^\{([^{}]+)\}/g, '^($1)');

  // Replace any remaining curly braces with parentheses
  s = s.replace(/\{([^{}]+)\}/g, '($1)');

  // Strip any remaining backslashes before known identifier or symbol names
  s = s.replace(/\\([a-zA-Z]+)/g, '$1');
  s = s.replace(/\\/g, '');

  return s;
}

export function normalizeMathExpression(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  let s = raw.trim();

  // 1. Remove newlines and trim surrounding whitespace
  s = s.replace(/[\r\n]+/g, ' ').trim();

  // 1.5 Convert LaTeX commands to standard math expressions if LaTeX backslashes or braces are present
  if (s.includes('\\') || (s.includes('{') && s.includes('}'))) {
    s = convertLatexToStandardMath(s);
  }

  // 1.8 Normalize inverse trigonometric functions written in text (e.g. tan^-1(x), sin^(-1)(x))
  s = s.replace(/\b(sin|cos|tan|cot|sec|csc)\s*(?:\^\{?\s*-1\s*\}?|\^\s*\(?\s*-1\s*\)?)/g, 'arc$1');

  // 2. Remove question marks commonly written at end of textbook/worksheet problems (e.g. "2+2=?" -> "2+2")
  s = s.replace(/=\s*\?/g, '');
  s = s.replace(/\?\s*=/g, '');
  s = s.replace(/\?/g, '');

  // 3. Remove stray leading or trailing OCR punctuation.
  s = s.replace(/^[_~:]+/g, '');
  s = s.replace(/[_~:]+$/g, '');

  // 3. OCR Operator Misrecognitions
  // Only replace 't' with '+' when strictly between two digits (e.g. 3 t 15 -> 3 + 15)
  // or when explicitly using the cross symbols (✝, †), preserving algebraic variable 't' (e.g. 5*t, v*t, t^2)
  s = s.replace(/(\d)\s*[tT]\s*(\d)/g, '$1+$2');
  s = s.replace(/([0-9a-zA-Z)])\s*[✝†]\s*([0-9a-zA-Z(])/g, '$1+$2');
  // Only replace colon between expressions as division / ratio (e.g. 2:3 -> 2/3)
  s = s.replace(/([0-9a-zA-Z)])\s*:\s*([0-9a-zA-Z(])/g, '$1/$2');

  // Underscore or tilde mistaken for minus (protect subscripts like \int_0, ∫_0, x_1, integral_0)
  s = s.replace(/(?<![a-zA-Z0-9\\∫\u222B]|integral|int)[_~](?!\d|\{)/g, '-');

  // Common typo for equals sign: double minus '--' or '=='
  s = s.replace(/==/g, '=');

  // 3. Typographic unicode variants
  s = s.replace(/×/g, '*');
  s = s.replace(/÷/g, '/');
  s = s.replace(/[−–—]/g, '-');
  s = s.replace(/[·•]/g, '*');
  s = s.replace(/[√\u221A]\s*(\([^)]+\))/g, 'sqrt$1');
  s = s.replace(/[√\u221A]\s*(\d+(\.\d+)?)/g, 'sqrt($1)');
  s = s.replace(/[√\u221A]/g, 'sqrt');
  s = s.replace(/[∫\u222B]/g, 'integral ');

  // 4. Common OCR alphanumeric confusion
  // Letter O/o next to digits (not followed by letters, e.g. not 'one' or 'out') -> 0
  s = s.replace(/(\d)[Oo](?![a-zA-Z])/g, '$10');
  s = s.replace(/(?<![a-zA-Z])[Oo](\d)/g, '0$1');
  s = s.replace(/=\s*[Oo](?![a-zA-Z])/g, '=0');

  // Letter l/I next to digits -> 1 (only when isolated, NOT when followed by letters like 'log', 'ln')
  s = s.replace(/(\d)[lI](?![a-zA-Z])/g, '$11');
  s = s.replace(/(?<![a-zA-Z])[lI](\d)/g, '1$1');

  // Pipe | mistaken for 1 only if odd number of pipes and adjacent to digit
  const pipeCount = (s.match(/\|/g) || []).length;
  if (pipeCount % 2 !== 0) {
    s = s.replace(/(\d)\|/g, '$11');
    s = s.replace(/\|(\d)/g, '1$1');
  }

  // Letter S/s: Never replace if followed by letters (e.g. 'sin', 'sqrt', 'sec')
  // Also in algebra, digits followed by 's' (e.g. 2s) is implicit multiplication (2*s), not 25.
  // Only replace standalone 'S'/'s' between an operator and a digit (e.g., '+ s 4' -> '+ 5 4')
  s = s.replace(/([+\-*/=])[Ss](\d)/g, '$15$2');

  // Letter Z/z mistaken for 2 next to operators or preceding variables (e.g. '+ z 3' -> '+ 2 3')
  s = s.replace(/([+\-*/=])[Zz](\d)/g, '$12$2');

  // B mistaken for 8 next to digits
  s = s.replace(/(\d)B/g, '$18');
  s = s.replace(/B(\d)/g, '8$1');

  // 5. Superscript numbers (², ³, ⁴, etc.)
  const superscriptMap: Record<string, string> = {
    '⁰': '^0',
    '¹': '^1',
    '²': '^2',
    '³': '^3',
    '⁴': '^4',
    '⁵': '^5',
    '⁶': '^6',
    '⁷': '^7',
    '⁸': '^8',
    '⁹': '^9',
  };
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (match) => superscriptMap[match] || match);

  // 6. If OCR produced "x2" instead of "x^2", normalize to "x^2".
  s = s.replace(/(^|[^a-zA-Z])([a-zA-Z])2(?=[+\-*/=)]|$)/g, '$1$2^2');

  // 7. Lowercase algebraic variables (X -> x, Y -> y, Z -> z) preserving function names and calculus keywords
  s = s.replace(/\b(SQRT|ABS|SIN|COS|TAN|LOG|LN|INTEGRAL|INTEGRATE|INT|DEFINT|DERIVATIVE|DIFF|FROM|TO)\b/gi, (fn) => fn.toLowerCase());
  s = s.replace(/([0-9+\-*/=()^,]|^)([XYZ])([0-9+\-*/=()^,]|$)/g, (_, p1, p2, p3) => `${p1}${p2.toLowerCase()}${p3}`);

  // 7.5 Insert explicit multiplication between variables/numbers and trigonometric/logarithmic functions before spaces are stripped
  // e.g. "x cos(x)" -> "x*cos(x)", "2x cos(x^2)" -> "2x*cos(x^2)"
  s = s.replace(/([0-9a-zA-Z)])\s+(sin|cos|tan|cot|sec|csc|log|ln|sqrt|exp|arcsin|arccos|arctan)\b/gi, (match, p1, p2) => `${p1}*${p2}`);

  // 8. Remove all internal whitespace around terms except comma/semicolon separation
  s = s.replace(/[ \t]+/g, '');

  // 9. Expand implicit multiplication:
  // e.g., 5sqrt(x) -> 5*sqrt(x), but not for function names like 'sqrt'
  s = s.replace(/(\d)(sqrt|abs|sin|cos|tan|log|ln)/gi, '$1*$2');
  s = s.replace(/(\d)([a-zA-Z(])/g, (match, d, char) => {
    return `${d}*${char}`;
  });

  // e.g., (x+1)(x-2) -> (x+1)*(x-2)
  s = s.replace(/(\))([a-zA-Z0-9(])/g, '$1*$2');

  // e.g., x(x+1) -> x*(x+1) when x is not a known function or calculus name
  s = s.replace(/\b([a-zA-Z]+)(\()/g, (match, p1, p2) => {
    const lower = p1.toLowerCase();
    if (['sqrt', 'abs', 'sin', 'cos', 'tan', 'log', 'ln', 'int', 'integral', 'integrate', 'defint', 'diff', 'derivative', 'lim', 'limit', 'det', 'inv'].includes(lower)) return match;
    if (/^d\/d[a-zA-Z]$/i.test(p1)) return match;
    return `${p1}*${p2}`;
  });

  // e.g., |x| to abs(x)
  s = s.replace(/\|([^|]+)\|/g, 'abs($1)');

  return s;
}
