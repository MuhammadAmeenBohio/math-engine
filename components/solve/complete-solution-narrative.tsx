import React, { useState, useMemo } from 'react';
import {
  ChevronsUpDown,
  Share2,
  Copy,
  Check,
  Download,
} from 'lucide-react';
import type { SolutionResult } from '@/lib/engine/types';
import { generateCompleteNarrative } from '@/lib/engine/narrative';
import { MathRenderer } from '@/components/ui/MathRenderer';

interface CompleteSolutionNarrativeProps {
  solution: SolutionResult;
  originalProblem?: string;
  className?: string;
  idPrefix?: string;
}

export function CompleteSolutionNarrative({
  solution,
  originalProblem,
  className = '',
  idPrefix = 'narrative',
}: CompleteSolutionNarrativeProps) {
  const [activeTab, setActiveTab] = useState<'article' | 'raw'>('article');
  const [copiedText, setCopiedText] = useState(false);
  const [stepsCollapsed, setStepsCollapsed] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const narrative = useMemo(
    () => generateCompleteNarrative(solution, originalProblem),
    [solution, originalProblem]
  );

  const [copyError, setCopyError] = useState<string | null>(null);

  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Proceed to textarea fallback
    }

    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch {
      return false;
    }
  };

  const handleCopyText = async () => {
    setCopyError(null);
    const ok = await copyToClipboard(narrative.fullPlainText);
    if (ok) {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } else {
      setCopyError('Could not copy to clipboard. Please copy manually.');
      setTimeout(() => setCopyError(null), 3000);
    }
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([narrative.fullPlainText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `solution-${(narrative.originalProblem || 'math').replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleShareLink = async () => {
    setCopyError(null);
    const expr = encodeURIComponent(solution.normalizedExpression || originalProblem || '');
    const url = `${window.location.origin}/solve/type?expr=${expr}`;
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopyError('Could not copy share link.');
      setTimeout(() => setCopyError(null), 3000);
    }
  };

  if (!solution.success) {
    return null;
  }

  return (
    <section
      id={`${idPrefix}-container`}
      className={`rounded-2xl border border-hairline bg-surface p-4 sm:p-6 shadow-card flex flex-col gap-4 transition-all ${className}`}
      aria-label="Complete Written Solution"
    >
      {/* Component Header Ribbon: Dedicated Title Row */}
      <div className="flex flex-col gap-3 border-b border-hairline pb-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-headline-sm text-base sm:text-lg font-semibold text-ink leading-tight">
                Complete Solution
              </h3>
            
            </div>
            <p className="font-body-sm text-xs text-ink-muted mt-0.5">
              Exact mathematical derivation and final answer in one place
            </p>
          </div>
        </div>

        {/* Action Controls & Format Switcher: Fully responsive on all screen sizes */}
        <div className="flex flex-wrap items-center gap-2 pt-1 w-full">
          {/* View Tab Buttons */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-surface-container-low border border-hairline shrink-0">
            <button
              type="button"
              id={`${idPrefix}-tab-article`}
              onClick={() => setActiveTab('article')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-md font-code-sm text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'article'
                  ? 'bg-surface text-ink shadow-xs font-semibold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Textbook
            </button>
            <button
              type="button"
              id={`${idPrefix}-tab-raw`}
              onClick={() => setActiveTab('raw')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-md font-code-sm text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'raw'
                  ? 'bg-surface text-ink shadow-xs font-semibold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Plain Text
            </button>
          </div>

          <div className="hidden md:block h-5 w-px bg-hairline"></div>

          {/* Toggle Steps Collapse */}
          <button
            type="button"
            onClick={() => setStepsCollapsed(!stepsCollapsed)}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-hairline bg-surface hover:bg-surface-container text-ink font-body-sm text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title={stepsCollapsed ? 'Expand all steps' : 'Collapse all steps'}
          >
            <ChevronsUpDown className="w-3.5 h-3.5 text-ink-muted shrink-0" />
            <span>{stepsCollapsed ? 'Expand Steps' : 'Collapse Steps'}</span>
          </button>

          {/* Share Solution Link */}
          <button
            type="button"
            onClick={handleShareLink}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-amber/40 bg-amber/10 hover:bg-amber/20 text-[#0B3D2E] font-body-sm text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Copy shareable solution link"
          >
            {copiedLink ? (
              <Check className="w-3.5 h-3.5 text-secondary shrink-0" />
            ) : (
              <Share2 className="w-3.5 h-3.5 text-amber shrink-0" />
            )}
            <span>{copiedLink ? 'Link Copied!' : 'Share Link'}</span>
          </button>

          {/* Copy Full Text Button */}
          <button
            type="button"
            id={`${idPrefix}-btn-copy-text`}
            onClick={handleCopyText}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg bg-amber text-ink font-body-sm text-xs font-semibold shadow-xs hover:brightness-105 active:scale-95 transition-all cursor-pointer whitespace-nowrap shrink-0"
            title="Copy entire answer to clipboard"
          >
            {copiedText ? (
              <Check className="w-3.5 h-3.5 text-ink shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-ink shrink-0" />
            )}
            <span>{copiedText ? 'Copied!' : 'Copy Full Text'}</span>
          </button>

          {/* Export / Download Button */}
          <button
            type="button"
            id={`${idPrefix}-btn-download`}
            onClick={handleDownloadTxt}
            className="w-8 h-8 rounded-lg border border-hairline bg-surface hover:bg-surface-container text-ink flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Download solution as .txt"
            aria-label="Download as text file"
          >
            <Download className="w-4 h-4 text-ink" />
          </button>
        </div>

        {copyError && (
          <p role="alert" className="text-xs text-error font-medium px-1">
            {copyError}
          </p>
        )}
      </div>

      {/* TAB 1: TEXTBOOK FORMATTED READING VIEW */}
      {activeTab === 'article' && (
        <div className="flex flex-col gap-space-md animate-in fade-in duration-200">
          {/* Problem Statement Callout */}
          <div className="rounded-xl p-space-md bg-surface-container-low border border-hairline flex flex-col gap-1.5 max-w-full overflow-hidden">
            <div className="flex items-center justify-between text-caption font-code-sm text-ink-muted">
              <span className="font-semibold text-primary uppercase tracking-wider">Problem</span>
              <span>{narrative.problemType}</span>
            </div>
            <div className="font-serif text-xl sm:text-2xl text-ink font-normal tracking-wide py-1 text-center w-full max-w-full overflow-x-auto">
              <MathRenderer math={solution.latexExpression || narrative.originalProblem} block className="text-xl sm:text-2xl text-ink" />
            </div>
          </div>

          {/* Flow of Pure Mathematical Step Equations */}
          {!stepsCollapsed && (
            <div className="flex flex-col gap-space-sm max-w-full">
              {narrative.sections.map((section, idx) => (
                <div
                  key={idx}
                  className="p-space-md rounded-xl bg-surface border border-hairline hover:border-amber/40 transition-colors flex flex-col gap-2 shadow-xs max-w-full overflow-hidden"
                >
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="font-code-sm text-caption font-bold text-ink-muted uppercase tracking-wider flex items-center">
                      Step {idx + 1}
                    </span>
                    {section.rule && (
                      <span className="font-code-sm text-[11px] text-ink-muted px-2 py-0.5 rounded bg-surface-container border border-hairline">
                        {section.rule}
                      </span>
                    )}
                  </div>

                  {section.mathExpression && (
                    <div className="p-3 rounded-lg bg-surface-container-low border border-hairline overflow-x-auto max-w-full flex items-center justify-center text-center">
                      <MathRenderer math={section.mathExpression} block className="text-base sm:text-xl text-ink font-medium" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Definitive Final Answer Box */}
          <div className="rounded-xl border-2 border-amber bg-gradient-to-r from-surface via-surface to-amber/5 p-space-md flex flex-col gap-2 shadow-xs max-w-full overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="font-code-sm text-caption font-bold tracking-widest text-primary uppercase flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber"></span>
                Final Answer
              </span>
            </div>
            <div className="font-serif text-2xl sm:text-3xl font-medium text-ink tracking-tight select-all py-1 text-center max-w-full overflow-x-auto">
              <MathRenderer math={solution.finalAnswerLatex || solution.finalAnswerPlain} block className="text-xl sm:text-2xl lg:text-3xl text-ink" />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RAW TEXT IN ONE GO */}
      {activeTab === 'raw' && (
        <div className="flex flex-col gap-space-xs animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-1 text-caption text-ink-muted font-code-sm">
            <span>Plain Math (Problem &amp; Answer Only)</span>
            <span>{narrative.fullPlainText.length} characters</span>
          </div>
          <div className="relative group">
            <textarea
              readOnly
              value={narrative.fullPlainText}
              rows={4}
              aria-label="Raw plain text of math problem and answer"
              className="w-full p-space-md rounded-xl bg-surface-container-low border border-hairline font-code-input text-[14px] text-ink leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-amber select-all"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3 py-1 rounded-md bg-surface border border-hairline hover:bg-surface-container text-ink font-code-sm text-caption flex items-center gap-1 cursor-pointer"
            >
              {copiedText ? (
                <Check className="w-3.5 h-3.5 text-secondary" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-ink" />
              )}
              <span>{copiedText ? 'Copied!' : 'Copy to Clipboard'}</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
