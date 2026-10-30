'use client';

import React, { useMemo, useRef } from 'react';
import { solveMathProblem } from '@/lib/engine/solver';
import type { SolutionResult } from '@/lib/engine/types';
import { MathKeyboard } from './math-keyboard';

interface ExpressionEditorProps {
  value: string;
  onChange: (value: string) => void;
  onConfirm: (result: SolutionResult) => void;
  confirmLabel?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  inputId?: string;
}

export function ExpressionEditor({
  value,
  onChange,
  onConfirm,
  confirmLabel = 'Confirm & Solve',
  disabled = false,
  autoFocus = false,
  inputId = 'expression-input',
}: ExpressionEditorProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const parsed = useMemo(() => (value.trim() ? solveMathProblem(value) : null), [value]);
  const canSolve = !!parsed?.success;
  const statusText = !value.trim()
    ? 'Enter an expression to validate it.'
    : parsed?.success
      ? `${parsed.problemType} • Valid expression`
      : parsed?.error || 'Invalid expression';

  const insertAtCursor = (text: string) => {
    const input = inputRef.current;
    if (!input) {
      onChange(`${value}${text}`);
      return;
    }
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${text}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      input.focus();
      const cursor = start + text.length;
      input.setSelectionRange(cursor, cursor);
    });
  };

  const backspaceAtCursor = () => {
    const input = inputRef.current;
    if (!input) {
      onChange(value.slice(0, -1));
      return;
    }
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    if (start === end && start === 0) return;
    const next = `${value.slice(0, start === end ? start - 1 : start)}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      input.focus();
      const cursor = start === end ? Math.max(0, start - 1) : start;
      input.setSelectionRange(cursor, cursor);
    });
  };

  const hasLowConfidenceHints = /[?_~]/i.test(value);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          // Notify user of clipboard paste event
          const event = new CustomEvent('math-engine:clipboard-image', { detail: { file } });
          window.dispatchEvent(event);
        }
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <textarea
          id={inputId}
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onPaste={handlePaste}
          autoFocus={autoFocus}
          rows={2}
          spellCheck={false}
          disabled={disabled}
          className="w-full resize-none rounded-lg border border-hairline bg-surface px-3 py-2 font-code-input text-sm text-ink focus:outline-none focus:ring-2 focus:ring-amber disabled:opacity-60"
          placeholder="Example: x^2 - 5x + 6 = 0 (Supports typing or pasting images via Ctrl+V)"
          aria-label="Expression to solve"
        />
        {hasLowConfidenceHints && (
          <div className="mt-1 flex items-center gap-1.5 rounded-md bg-amber/15 px-2.5 py-1 text-xs text-[#0B3D2E] border border-amber/30">
            <span className="font-semibold">Note:</span> Ambiguous symbols detected. Verify highlighted characters before solving.
          </div>
        )}
      </div>
      <MathKeyboard onInsert={insertAtCursor} onBackspace={backspaceAtCursor} />
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pt-1">
        <p
          className={`font-code-sm text-xs sm:text-[11px] ${canSolve ? 'text-secondary' : 'text-error'}`}
          role="status"
          aria-live="polite"
        >
          {canSolve ? '✓ ' : '! '}
          {statusText}
        </p>
        <button
          type="button"
          onClick={() => {
            if (parsed?.success) onConfirm(parsed);
          }}
          disabled={!canSolve || disabled}
          className="w-full sm:w-auto flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl sm:rounded-full bg-amber px-5 font-body-sm text-sm font-semibold text-ink shadow-xs transition-all hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">bolt</span>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
