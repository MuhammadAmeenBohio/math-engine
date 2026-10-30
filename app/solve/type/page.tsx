'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SolutionResult } from '@/lib/engine/types';
import { solveMathProblem } from '@/lib/engine/solver';
import { ExpressionEditor } from '@/components/solve/expression-editor';
import { CompleteSolutionNarrative } from '@/components/solve/complete-solution-narrative';
import { MathRenderer } from '@/components/ui/MathRenderer';
import { saveHistory, setHistoryFavorite } from '@/lib/history';

export default function TypeSolvePage() {
  const [expression, setExpression] = useState('x^2 - 5x + 6 = 0');
  const [confidence, setConfidence] = useState<number | null>(99.8);
  const [solution, setSolution] = useState<SolutionResult | null>(() => {
    const s = solveMathProblem('x^2 - 5x + 6 = 0');
    return { ...s, executionTimeMs: 0.5 };
  });
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [historyMessage, setHistoryMessage] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'latex' | 'plain' | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedExpression = params.get('expr');
    const historyParam = params.get('historyId');

    if (historyParam) {
      import('@/lib/history').then(({ listHistory }) => {
        listHistory().then((items) => {
          const match = items.find((i) => i.id === historyParam);
          if (match) {
            setExpression(match.expression);
            setHistoryId(match.id);
            setIsFavorite(match.favorite);
            setSolution({
              success: true,
              problemType: match.problemType as SolutionResult['problemType'],
              normalizedExpression: match.expression,
              latexExpression: match.latex,
              finalAnswerPlain: match.finalAnswerPlain,
              finalAnswerLatex: match.finalAnswerLatex,
              exactAnswer: match.finalAnswerPlain,
              steps: match.steps,
              isVerified: match.isVerified,
              verificationDetails: { lhsValue: 0, rhsValue: 0, residualNorm: 0, status: 'Restored from History' },
              executionTimeMs: 0,
            });
            setConfidence(100.0);
            setHistoryMessage('Restored precomputed solution from Notebook without recomputing.');
          }
        });
      });
      return;
    }

    if (requestedExpression) {
      // Populate and solve shared link expression asynchronously to avoid synchronous cascading renders
      const decodedExpr = requestedExpression.trim();
      const timer = setTimeout(() => {
        setExpression(decodedExpr);
        const sol = solveMathProblem(decodedExpr);
        setSolution(sol);
        setConfidence(sol.success ? 100.0 : null);
      }, 0);
      return () => clearTimeout(timer);
    }

    // Refresh persistence: Restore the user's latest typed calculation if one exists
    import('@/lib/history').then(({ getLatestHistoryItem }) => {
      getLatestHistoryItem('typed').then((latest) => {
        if (!latest) return;
        setExpression(latest.expression);
        setHistoryId(latest.id);
        setIsFavorite(latest.favorite);
        setSolution({
          success: true,
          problemType: latest.problemType as SolutionResult['problemType'],
          normalizedExpression: latest.expression,
          latexExpression: latest.latex,
          finalAnswerPlain: latest.finalAnswerPlain,
          finalAnswerLatex: latest.finalAnswerLatex,
          exactAnswer: latest.finalAnswerPlain,
          steps: latest.steps,
          isVerified: latest.isVerified,
          verificationDetails: { lhsValue: 0, rhsValue: 0, residualNorm: 0, status: 'Restored after refresh' },
          executionTimeMs: 0,
        });
        setConfidence(100.0);
      }).catch(() => {});
    });
  }, []);

  const handleSolve = async (result: SolutionResult) => {
    setSolution(result);
    setConfidence(100.0); // Exact deterministic manual typing has 100% confidence
    setHistoryMessage(null);
    setHistoryMessage(null);
    try {
      const record = await saveHistory({
        inputType: 'typed',
        expression: result.normalizedExpression,
        recognizedText: expression.trim(),
        latex: result.latexExpression,
        problemType: result.problemType,
        finalAnswerPlain: result.finalAnswerPlain,
        finalAnswerLatex: result.finalAnswerLatex,
        steps: result.steps,
        isVerified: result.isVerified,
      });
      setHistoryId(record.id);
      setIsFavorite(record.favorite);
      setHistoryMessage('Saved to Notebook.');
    } catch {
      setHistoryMessage('Solved, but local history is unavailable in this browser.');
    }
  };

  const handleFavorite = async () => {
    if (!historyId) {
      if (!solution) return;
      try {
        const record = await saveHistory({
          inputType: 'typed',
          expression: solution.normalizedExpression,
          recognizedText: expression.trim(),
          latex: solution.latexExpression,
          problemType: solution.problemType,
          finalAnswerPlain: solution.finalAnswerPlain,
          finalAnswerLatex: solution.finalAnswerLatex,
          steps: solution.steps,
          isVerified: solution.isVerified,
          favorite: true,
        });
        setHistoryId(record.id);
        setIsFavorite(true);
        setHistoryMessage('Saved to Notebook.');
      } catch {
        setHistoryMessage('Could not update local history.');
      }
      return;
    }
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      await setHistoryFavorite(historyId, next);
    } catch {
      setHistoryMessage('Could not update local history.');
    }
  };

  const copy = async (type: 'latex' | 'plain') => {
    if (!solution) return;
    const text = type === 'latex' ? solution.finalAnswerLatex : solution.finalAnswerPlain;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 1800);
    } catch {
      setHistoryMessage('Clipboard access was blocked by the browser.');
    }
  };

  const [isEditingConfirm, setIsEditingConfirm] = useState(false);
  const [editBuffer, setEditBuffer] = useState('');

  const handleConfirmEdit = () => {
    if (!editBuffer.trim()) return;
    setExpression(editBuffer.trim());
    setIsEditingConfirm(false);
    const sol = solveMathProblem(editBuffer.trim());
    if (sol.success) {
      handleSolve(sol);
    } else {
      setSolution(sol);
    }
  };

  return (
    <div className="flex w-full flex-col">
      <div className="mx-auto flex w-full max-w-[1520px] flex-col gap-space-lg px-margin py-space-lg">
        {/* Editorial Title & Status Header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-space-md border-b border-hairline pb-space-sm">
          <div className="flex flex-col gap-1.5 max-w-3xl">
            <h1 className="font-headline-xl text-headline-xl text-ink tracking-tight font-semibold">
              Type Problem &amp; Solve
            </h1>
            <p className="font-body-lg text-body-lg text-ink-muted leading-relaxed">
              Type or construct mathematical expressions with the scientific keypad for instant symbolic solving and proofs.
            </p>
          </div>
        </section>

        {/* Main Two-Column Split Layout */}
        <div className="grid grid-cols-1 items-start gap-space-lg xl:grid-cols-12">
          {/* LEFT COLUMN: Input Card & Scientific Keypad */}
          <section className="xl:col-span-6 flex flex-col gap-space-md">
            <div className="flex flex-col gap-space-sm rounded-2xl border border-hairline bg-surface p-space-md shadow-card">
              <div className="flex items-center justify-between gap-2 border-b border-hairline/60 pb-space-xs">
                <span className="font-caption text-caption uppercase tracking-wider text-ink-muted font-medium">
                  Mathematical Input
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setExpression('');
                    setSolution(null);
                    setHistoryId(null);
                    setIsFavorite(false);
                    setHistoryMessage(null);
                  }}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 font-code-sm text-code-sm text-ink-muted transition-colors hover:bg-surface-container hover:text-ink cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">restart_alt</span>
                  Clear
                </button>
              </div>

              <ExpressionEditor
                value={expression}
                onChange={(next) => {
                  setExpression(next);
                  setSolution(null);
                  setHistoryId(null);
                  setIsFavorite(false);
                  setHistoryMessage(null);
                }}
                onConfirm={handleSolve}
                confirmLabel="Solve "
                inputId="typed-expression"
              />

              <p className="font-code-sm text-[11px] leading-relaxed text-ink-muted pt-1">
                Supported: linear &amp; quadratic equations, and exact arithmetic (trigonometry, logarithms, roots).
              </p>
            </div>

            {/* Quick-Pick Examples Card */}
            <div className="rounded-2xl border border-hairline bg-surface p-space-md shadow-card">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-body-sm text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Quick Examples
                </h2>
                <span className="font-code-sm text-[11px] text-ink-muted">Click to populate</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'x^2 - 5x + 6 = 0',
                  '3x + 5 = 20',
                  '(x+2)(x+3) = 0',
                  'x^2 + 1 = 0',
                  'sin(0) + cos(0) * 10 + log(100)',
                  'sqrt(64) + 5!',
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => {
                      setExpression(sample);
                      setSolution(null);
                      setHistoryId(null);
                      setIsFavorite(false);
                      setHistoryMessage(null);
                    }}
                    className="rounded-full border border-hairline bg-canvas/80 px-2.5 py-1 font-code-sm text-[11px] text-ink transition-colors hover:border-amber hover:bg-surface-container cursor-pointer"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN: Extracted Formula, Solution & Step Derivation */}
          <section className="xl:col-span-6 flex flex-col gap-space-md">
            {/* Status chips outside card */}
            <div className="flex items-center justify-between flex-wrap gap-space-xs">
              <div className="flex items-center gap-space-xs">
                {confidence !== null && (
                  <span className="rounded-full bg-secondary-fixed px-space-sm py-0.5 font-code-sm text-[10px] font-medium text-on-secondary-fixed sm:text-code-sm">
                    Confidence: {confidence}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-secondary font-code-sm text-code-sm">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>{solution ? solution.problemType : 'Deterministic Solver'}</span>
              </div>
            </div>

            {!solution ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-hairline bg-surface p-space-xl text-center shadow-card">
                <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center border border-hairline text-amber">
                  <span className="material-symbols-outlined text-[26px]">keyboard</span>
                </div>
                <h2 className="font-headline-sm text-headline-sm font-semibold text-ink">
                  Enter or Pick an Expression to Solve
                </h2>
                <p className="max-w-md font-body-sm text-body-sm text-ink-muted">
                  Use the scientific keypad or type formulas directly into the input. Click &quot;Solve Expression&quot; to compute exact symbolic answers, complete step derivations, and verification.
                </p>
              </div>
            ) : (
              <>
                {/* Extracted Formula Card */}
                <div className="bg-surface rounded-xl shadow-card p-space-md flex flex-col gap-space-sm border border-hairline">
                  <div className="flex items-center justify-between">
                    <span className="font-caption text-caption uppercase text-ink-muted tracking-wider">
                      Recognized Math Expression
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingConfirm(!isEditingConfirm);
                        if (!isEditingConfirm) {
                          setEditBuffer(expression);
                        }
                      }}
                      className="text-xs text-primary font-medium hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                      <span>{isEditingConfirm ? 'Close' : 'Edit'}</span>
                    </button>
                  </div>

                  {isEditingConfirm ? (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2">
                      <input
                        type="text"
                        value={editBuffer}
                        onChange={(e) => setEditBuffer(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleConfirmEdit();
                          }
                        }}
                        className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-surface border border-hairline font-mono text-sm text-ink focus:outline-none focus:ring-1 focus:ring-amber"
                        placeholder="e.g. x^2 - 5x + 6 = 0"
                      />
                      <button
                        onClick={handleConfirmEdit}
                        className="whitespace-nowrap shrink-0 px-3.5 py-1.5 rounded-lg bg-amber text-ink font-semibold text-xs shadow-xs hover:brightness-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1"
                        type="button"
                      >
                        <span>Confirm &amp; Solve</span>
                      </button>
                    </div>
                  ) : (
                    <div className="py-space-md px-space-lg rounded-xl bg-canvas/60 flex items-center justify-center text-center border border-hairline overflow-x-auto">
                      <MathRenderer
                        math={solution.latexExpression || expression}
                        block
                        className="text-2xl text-ink md:text-3xl"
                      />
                    </div>
                  )}
                </div>

                {/* Final Solution Hero Card */}
                <div className="rounded-xl bg-surface p-space-lg shadow-card flex flex-col gap-space-sm relative overflow-hidden border border-hairline">
                  <span className="font-code-sm text-code-sm uppercase tracking-widest text-amber font-semibold">
                    Final Solution
                  </span>

                  <div className="flex flex-row items-baseline justify-between w-full gap-space-sm py-space-xs overflow-x-auto">
                    <MathRenderer
                      math={solution.finalAnswerLatex || solution.finalAnswerPlain}
                      className="font-headline-lg text-headline-xl text-ink"
                    />
                    {solution.roots && (
                      <span className="px-space-sm py-1 rounded bg-surface-container font-code-sm text-code-sm text-ink shrink-0">
                        Roots: {solution.roots.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Complete Written Solution in Text Form (One Go) */}
                <CompleteSolutionNarrative
                  solution={solution}
                  originalProblem={expression}
                  idPrefix="type-narrative"
                />

                {/* Utility Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-space-xs w-full">
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleFavorite}
                      disabled={!historyId}
                      className={`w-10 h-10 rounded-xl bg-surface hover:bg-surface-container shadow-xs text-ink flex items-center justify-center transition-colors border border-hairline shrink-0 ${
                        historyId ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'
                      } ${isFavorite ? 'text-amber' : ''}`}
                      id="star-btn"
                      title={historyId ? 'Favorite in Notebook' : 'Confirm a result to save it'}
                      type="button"
                      aria-pressed={isFavorite}
                    >
                      <span
                        className="material-symbols-outlined text-[18px]"
                        style={{ fontVariationSettings: isFavorite ? "'FILL' 1" : "'FILL' 0" }}
                      >
                        {isFavorite ? 'star' : 'star_border'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => copy('plain')}
                      className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-surface hover:bg-surface-container border border-hairline text-ink font-body-sm text-xs sm:text-body-sm font-medium flex items-center justify-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {copiedType === 'plain' ? 'check' : 'content_copy'}
                      </span>
                      <span>{copiedType === 'plain' ? 'Copied' : 'Copy Plain'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => copy('latex')}
                      className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-surface hover:bg-surface-container border border-hairline text-ink font-body-sm text-xs sm:text-body-sm font-medium flex items-center justify-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {copiedType === 'latex' ? 'check' : 'code'}
                      </span>
                      <span>{copiedType === 'latex' ? 'Copied' : 'Copy LaTeX'}</span>
                    </button>

                    <Link
                      href="/solve/notebook"
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-ink font-body-sm text-xs sm:text-body-sm font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <span className="material-symbols-outlined text-[16px]">menu_book</span>
                      <span>Notebook</span>
                    </Link>
                  </div>
                </div>

                {historyMessage && (
                  <p role="status" className="font-code-sm text-[11px] text-ink-muted">
                    {historyMessage}
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
