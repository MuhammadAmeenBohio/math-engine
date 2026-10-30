"use client";

import React, { useState, useRef, useEffect } from "react";
import { solveMathProblem } from "@/lib/engine/solver";
import { SolutionResult } from "@/lib/engine/types";
import { CompleteSolutionNarrative } from "@/components/solve/complete-solution-narrative";
import { MathRenderer } from "@/components/ui/MathRenderer";
import { saveHistory, setHistoryFavorite } from "@/lib/history";

type StrokePoint = { x: number; y: number; time: number };

export default function WriteSolvePage() {
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [strokeWidth, setStrokeWidth] = useState<"fine" | "medium" | "bold">("medium");
  const [gridVisible, setGridVisible] = useState(true);
  const [isStarred, setIsStarred] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  const [solvingFeedback, setSolvingFeedback] = useState<string | null>(null);
  const [solveError, setSolveError] = useState<string | null>(null);
  const [isCleared, setIsCleared] = useState(false);
  const [strokeCount, setStrokeCount] = useState<number>(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isEditingExpression, setIsEditingExpression] = useState(false);
  const [hasSolution, setHasSolution] = useState(true);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);

  // Math & OCR State
  const [expression, setExpression] = useState<string>("x^2 - 5x + 6 = 0");
  const [editBuffer, setEditBuffer] = useState<string>("x^2 - 5x + 6 = 0");
  const [recognizedText, setRecognizedText] = useState<string>("x^2 - 5x + 6 = 0");
  const [latexExpr, setLatexExpr] = useState<string>("x^2 - 5x + 6 = 0");
  const [activeEngine, setActiveEngine] = useState<string>("Gemini 2.5 Flash Vision");
  const [confidence, setConfidence] = useState<number | null>(99.8);
  const [solution, setSolution] = useState<SolutionResult | null>(() => {
    const s = solveMathProblem("x^2 - 5x + 6 = 0");
    return { ...s, executionTimeMs: 0.5 };
  });

  // Refresh persistence: Restore user's last ink problem from history if available
  useEffect(() => {
    import("@/lib/history").then(({ getLatestHistoryItem }) => {
      getLatestHistoryItem("pad").then((latest) => {
        if (!latest) return;
        setExpression(latest.expression);
        setEditBuffer(latest.expression);
        setRecognizedText(latest.recognizedText || latest.expression);
        setLatexExpr(latest.latex);
        setSolution({
          success: true,
          problemType: latest.problemType as SolutionResult["problemType"],
          normalizedExpression: latest.expression,
          latexExpression: latest.latex,
          finalAnswerPlain: latest.finalAnswerPlain,
          finalAnswerLatex: latest.finalAnswerLatex,
          exactAnswer: latest.finalAnswerPlain,
          steps: latest.steps,
          isVerified: latest.isVerified,
          verificationDetails: { lhsValue: 0, rhsValue: 0, residualNorm: 0, status: "Restored after refresh" },
          executionTimeMs: 0,
        });
        setConfidence(100.0);
        setHistoryId(latest.id);
        setIsStarred(latest.favorite);
      }).catch(() => {});
    });
  }, []);

  // Canvas Ref for Interactive Inking
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef<boolean>(false);
  const activeStrokeRef = useRef<StrokePoint[] | null>(null);
  const strokesRef = useRef<StrokePoint[][]>([]);
  const undoStackRef = useRef<ImageData[]>([]);
  const redoStackRef = useRef<ImageData[]>([]);

  const syncHistoryButtons = () => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  };

  const pushUndoSnapshot = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    undoStackRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (undoStackRef.current.length > 40) undoStackRef.current.shift();
    redoStackRef.current = [];
    syncHistoryButtons();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width || 700));
      const height = Math.max(1, Math.round(rect.height || 470));
      if (canvas.width === width && canvas.height === height) return;

      const previous = document.createElement("canvas");
      previous.width = canvas.width;
      previous.height = canvas.height;
      const previousCtx = previous.getContext("2d");
      if (previousCtx && canvas.width > 0 && canvas.height > 0) {
        previousCtx.drawImage(canvas, 0, 0);
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx && previous.width > 0 && previous.height > 0) {
        ctx.drawImage(previous, 0, 0, width, height);
      }
      undoStackRef.current = [];
      redoStackRef.current = [];
      syncHistoryButtons();
    };

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.setPointerCapture(e.pointerId);
    pushUndoSnapshot();
    isDrawingRef.current = true;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    activeStrokeRef.current = [{ x, y, time: performance.now() }];

    ctx.beginPath();
    ctx.moveTo(x, y);

    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = strokeWidth === "fine" ? 12 : strokeWidth === "medium" ? 24 : 36;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#0F2E22";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = strokeWidth === "fine" ? 2.5 : strokeWidth === "medium" ? 4 : 6;
    }
    setIsCleared(false);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    activeStrokeRef.current?.push({ x, y, time: performance.now() });
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const finishStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const stroke = activeStrokeRef.current;
    activeStrokeRef.current = null;
    if (stroke && stroke.length > 0) {
      strokesRef.current.push(stroke);
      setStrokeCount((prev) => prev + 1);
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const snapshot = undoStackRef.current.pop();
    if (!canvas || !ctx || !snapshot) return;
    redoStackRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(snapshot, 0, 0);
    const nextCount = Math.max(0, strokeCount - 1);
    setStrokeCount(nextCount);
    setIsCleared(nextCount === 0);
    syncHistoryButtons();
  };

  const handleRedo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const snapshot = redoStackRef.current.pop();
    if (!canvas || !ctx || !snapshot) return;
    undoStackRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(snapshot, 0, 0);
    setStrokeCount((prev) => prev + 1);
    setIsCleared(false);
    syncHistoryButtons();
  };

  const handleSolveClick = async () => {
    if (strokeCount === 0) {
      setSolveError('Write an equation on the canvas first, then read the ink.');
      setSolvingFeedback(null);
      return;
    }

    setIsSolving(true);
    setSolveError(null);
    setSolvingFeedback('Transcribing ink with Gemini Vision AI...');

    let base64Image = '';
    let geminiFailure = 'Ink recognition failed. Try again.';

    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas unavailable.');

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const eCtx = exportCanvas.getContext('2d');
      if (!eCtx) throw new Error('Could not prepare the ink image.');
      eCtx.fillStyle = '#FFFFFF';
      eCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      eCtx.drawImage(canvas, 0, 0);

      base64Image = exportCanvas.toDataURL('image/jpeg', 0.9);
      const res = await fetch('/api/ocr/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Image, mimeType: 'image/jpeg' }),
      });

      if (!res.ok) {
        const payload: unknown = await res.json().catch(() => null);
        const errorPayload = (payload as { error?: unknown } | null)?.error;

        if (typeof errorPayload === 'string') {
          geminiFailure = errorPayload;
        } else if (
          errorPayload &&
          typeof errorPayload === 'object' &&
          typeof (errorPayload as { message?: unknown }).message === 'string'
        ) {
          geminiFailure = (errorPayload as { message: string }).message;
        }

        throw new Error(geminiFailure);
      }

      const data = await res.json();
      if (!data.expression || data.expression.trim().length === 0) {
        geminiFailure = 'No mathematical expression was detected in the ink.';
        throw new Error(geminiFailure);
      }

      const recognized = String(data.expression);
      setRecognizedText(recognized);
      setExpression(recognized);
      setEditBuffer(recognized);
      setLatexExpr(String(data.latex || recognized));
      setConfidence(Number(data.confidence) || 90);
      setActiveEngine(data.provider === 'groq-vision' ? 'Groq Vision (Qwen)' : 'Gemini 2.5 Flash Vision');
      setSolution(null);
      setHasSolution(false);
      setIsConfirming(true); // Mandatory confirmation step (FR-RC-07)
      setIsEditingExpression(false);
      setHistoryNotice(null);
      setHistoryId(null);
      setIsStarred(false);
      setSolvingFeedback('Ink recognized. Please review and confirm to solve.');
      setIsSolving(false);
      return;
    } catch (err) {
      geminiFailure = err instanceof Error ? err.message : geminiFailure;
    }

    try {
      setSolvingFeedback('Gemini unavailable. Trying local Tesseract OCR...');
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      let localText = '';
      try {
        await worker.setParameters({
          tessedit_char_whitelist: '0123456789+-*/=^()xyzXYZabAB ',
          tessedit_pageseg_mode: '6' as unknown as import('tesseract.js').PSM,
        });
        const result = await worker.recognize(base64Image);
        localText = result.data?.text?.trim() || '';
      } finally {
        await worker.terminate();
      }

      if (!localText) throw new Error('Local OCR returned no text.');

      const { normalizeMathExpression } = await import('@/lib/engine/normalizer');
      const normalized = normalizeMathExpression(localText);
      if (!normalized || normalized.length < 2) {
        throw new Error('Local OCR could not find a usable expression.');
      }

      setRecognizedText(localText);
      setExpression(normalized);
      setEditBuffer(normalized);
      setLatexExpr(normalized);
      setConfidence(70);
      setActiveEngine('Local Tesseract fallback');
      setSolution(null);
      setHasSolution(false);
      setIsConfirming(true); // Mandatory confirmation step (FR-RC-07)
      setIsEditingExpression(false);
      setHistoryNotice(null);
      setHistoryId(null);
      setIsStarred(false);
      setSolvingFeedback('Local recognition complete. Please review and confirm to solve.');
      setSolveError('Gemini OCR was unavailable. Local Tesseract result was used.');
    } catch {
      setSolveError(geminiFailure);
      setSolvingFeedback(null);
    } finally {
      setIsSolving(false);
      setSolvingFeedback(null);
    }
  };

  const handleConfirmEdit = async () => {
    const sol = solveMathProblem(editBuffer);
    if (!sol.success) {
      setSolveError(sol.error || 'The expression could not be solved. Check the syntax.');
      return;
    }

    setExpression(sol.normalizedExpression);
    setEditBuffer(sol.normalizedExpression);
    setLatexExpr(sol.latexExpression);
    setSolution(sol);
    setHasSolution(true);
    setIsEditingExpression(false);
    setIsConfirming(false);
    setSolveError(null);
    setSolvingFeedback(`Solved: ${sol.finalAnswerPlain}`);

    try {
      const record = await saveHistory({
        inputType: 'pad',
        expression: sol.normalizedExpression,
        recognizedText: expression,
        latex: sol.latexExpression,
        problemType: sol.problemType,
        finalAnswerPlain: sol.finalAnswerPlain,
        finalAnswerLatex: sol.finalAnswerLatex,
        steps: sol.steps,
        isVerified: sol.isVerified,
      });
      setHistoryId(record.id);
      setIsStarred(record.favorite);
      setHistoryNotice('Confirmed result saved to Notebook.');
    } catch {
      setHistoryNotice('Solved, but local history is unavailable in this browser.');
    }
  };

  const handleToggleFavorite = async () => {
    if (!historyId) return;
    const next = !isStarred;
    setIsStarred(next);
    try {
      await setHistoryFavorite(historyId, next);
      setHistoryNotice(next ? 'Saved to Favorites.' : 'Removed from Favorites.');
    } catch {
      setIsStarred(!next);
      setHistoryNotice('Could not update Favorites.');
    }
  };

  const handleClearReset = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setIsCleared(true);
    setStrokeCount(0);
    strokesRef.current = [];
    undoStackRef.current = [];
    redoStackRef.current = [];
    syncHistoryButtons();
    setHasSolution(false);
    setIsConfirming(false);
    setSolveError(null);
    setSolvingFeedback(null);
  };


  return (
          <div className="flex flex-col w-full">
            <div className="w-full px-margin py-space-lg max-w-[1520px] mx-auto flex flex-col gap-space-lg">
              {/* Editorial Title & Status Header */}
              <section className="flex flex-col md:flex-row md:items-end justify-between gap-space-md border-b border-hairline pb-space-sm">
                <div className="flex flex-col gap-1.5 max-w-3xl">
                  <h1 className="font-headline-xl text-headline-xl text-ink tracking-tight font-semibold">
                    Write Problem &amp; Solve
                  </h1>
                  <p className="font-body-lg text-body-lg text-ink-muted leading-relaxed">
                    Write or sketch mathematical expressions directly on the interactive canvas for instant recognition and step-by-step solving.
                  </p>
                </div>
              </section>

              {/* Main Two-Column Split Layout */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
                {/* LEFT COLUMN: Vector Inking Writepad */}
                <section className="xl:col-span-6 flex flex-col gap-space-md">
                  {/* Canvas Studio Outer Card */}
                  <div className="bg-surface rounded-2xl border border-hairline shadow-card overflow-hidden flex flex-col">
                    {/* Inking Top Toolbar */}
                    <div className="px-space-md py-space-sm bg-surface-container-low border-b border-hairline flex flex-wrap items-center justify-between gap-space-sm">
                      {/* Tool Selection & Stroke Weight */}
                      <div className="flex items-center gap-space-xs">
                        <div className="flex items-center bg-surface rounded-xl p-0.5 border border-hairline">
                          <button
                            onClick={() => setTool('pen')}
                            className={`px-3 py-1.5 rounded-lg font-body-sm text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                              tool === 'pen'
                                ? 'bg-ink text-surface shadow-xs'
                                : 'text-ink-muted hover:text-ink hover:bg-transparent'
                            }`}
                            id="tool-pen"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[15px]">edit</span>
                            <span>Pen</span>
                          </button>
                          <button
                            onClick={() => setTool('eraser')}
                            className={`px-3 py-1.5 rounded-lg font-body-sm text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                              tool === 'eraser'
                                ? 'bg-ink text-surface shadow-xs'
                                : 'text-ink-muted hover:text-ink hover:bg-transparent'
                            }`}
                            id="tool-eraser"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[15px]">ink_eraser</span>
                            <span>Eraser</span>
                          </button>
                        </div>

                        {/* Stroke Width Switcher */}
                        <div className="flex items-center bg-surface rounded-xl p-1 border border-hairline ml-1 gap-1">
                          <button
                            onClick={() => setStrokeWidth('fine')}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                              strokeWidth === 'fine'
                                ? 'bg-surface-container-high border border-hairline'
                                : 'hover:bg-surface-container-low'
                            }`}
                            title="Fine (1.5px)"
                            type="button"
                            aria-label="Fine stroke"
                          >
                            <span
                              className="rounded-full shrink-0 bg-[#0F2E22]"
                              style={{ width: '4px', height: '4px' }}
                            ></span>
                          </button>
                          <button
                            onClick={() => setStrokeWidth('medium')}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                              strokeWidth === 'medium'
                                ? 'bg-surface-container-high border border-hairline'
                                : 'hover:bg-surface-container-low'
                            }`}
                            title="Medium (2.5px)"
                            type="button"
                            aria-label="Medium stroke"
                          >
                            <span
                              className="rounded-full shrink-0 bg-[#0F2E22]"
                              style={{ width: '7px', height: '7px' }}
                            ></span>
                          </button>
                          <button
                            onClick={() => setStrokeWidth('bold')}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                              strokeWidth === 'bold'
                                ? 'bg-surface-container-high border border-hairline'
                                : 'hover:bg-surface-container-low'
                            }`}
                            title="Bold (4.0px)"
                            type="button"
                            aria-label="Bold stroke"
                          >
                            <span
                              className="rounded-full shrink-0 bg-[#0F2E22]"
                              style={{ width: '10px', height: '10px' }}
                            ></span>
                          </button>
                        </div>
                      </div>

                      {/* History Actions & Grid Setting */}
                      <div className="flex items-center gap-space-xs">
                        <button
                          onClick={handleUndo}
                          className={`w-8 h-8 rounded-lg border border-hairline bg-surface hover:bg-surface-container text-ink flex items-center justify-center transition-colors ${
                            canUndo ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'
                          }`}
                          id="undo-btn"
                          title="Undo stroke"
                          type="button"
                          disabled={!canUndo}
                          aria-label="Undo stroke"
                        >
                          <span className="material-symbols-outlined text-[17px]">undo</span>
                        </button>
                        <button
                          onClick={handleRedo}
                          className={`w-8 h-8 rounded-lg border border-hairline bg-surface hover:bg-surface-container text-ink flex items-center justify-center transition-colors ${
                            canRedo ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'
                          }`}
                          id="redo-btn"
                          title="Redo stroke"
                          type="button"
                          disabled={!canRedo}
                          aria-label="Redo stroke"
                        >
                          <span className="material-symbols-outlined text-[17px]">redo</span>
                        </button>
                        <div className="h-4 w-px bg-hairline mx-1"></div>
                        <button
                          onClick={() => setGridVisible(!gridVisible)}
                          className="px-2.5 py-1 rounded-lg bg-surface border border-hairline font-code-sm text-code-sm text-ink hover:bg-surface-container flex items-center gap-1.5 transition-colors cursor-pointer"
                          id="grid-toggle-btn"
                          type="button"
                        >
                          <span className={`material-symbols-outlined text-[15px] ${gridVisible ? 'text-secondary' : 'text-ink-muted'}`}>grid_4x4</span>
                          <span className="hidden sm:inline">Grid</span>
                        </button>
                      </div>
                    </div>

                    {/* Main Inking Surface Viewport */}
                    <div
                      className="relative w-full h-[340px] sm:h-[400px] bg-surface select-none overflow-hidden cursor-crosshair"
                      id="ink-canvas-container"
                    >
                      {/* Grid Pattern */}
                      {gridVisible && (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
                          <defs>
                            <pattern height="24" id="dot-pattern" patternUnits="userSpaceOnUse" width="24">
                              <circle cx="12" cy="12" fill="#0F2E22" fillOpacity="0.25" r="1.15"></circle>
                            </pattern>
                            <pattern height="120" id="major-guide" patternUnits="userSpaceOnUse" width="120">
                              <path d="M 120 0 L 0 0 0 120" fill="none" stroke="#0F2E22" strokeDasharray="2 4" strokeOpacity="0.08" strokeWidth="0.5"></path>
                            </pattern>
                          </defs>
                          <rect fill="url(#dot-pattern)" height="100%" width="100%"></rect>
                          <rect fill="url(#major-guide)" height="100%" width="100%"></rect>
                        </svg>
                      )}

                      {/* Real Interactive Inking Canvas */}
                      <canvas
                        ref={canvasRef}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={finishStroke}
                        onPointerCancel={finishStroke}
                        className="absolute inset-0 w-full h-full z-10 touch-none cursor-crosshair"
                      />

                      {/* Empty-state hint */}
                      {!isCleared && strokeCount === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="font-body-sm text-sm text-ink-muted/60">Draw an equation, e.g. x² - 5x + 6 = 0</span>
                        </div>
                      )}

                      {/* Floating Inking Status Pill */}
                      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 bg-surface/95 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-hairline shadow-xs max-w-[calc(100%-80px)]">
                        <span className="w-2 h-2 rounded-full bg-secondary shrink-0"></span>
                        <span className="font-code-sm text-code-sm text-ink font-medium truncate">
                          {isCleared
                            ? 'Canvas cleared • Draw equation'
                            : `${strokeCount} stroke${strokeCount !== 1 ? 's' : ''} • Ready`}
                        </span>
                      </div>

                      {/* Quick Clear Icon */}
                      <button
                        onClick={handleClearReset}
                        className="absolute top-4 right-4 z-20 w-8 h-8 rounded-xl bg-surface border border-hairline text-ink-muted hover:text-error hover:bg-error-container/30 flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                        id="quick-clear-canvas"
                        title="Clear Canvas"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[17px]">delete_sweep</span>
                      </button>
                    </div>
                  </div>

                  {/* Primary Action Dock */}
                  <div className="flex flex-col sm:flex-row items-center gap-space-sm sm:justify-start">
                    <button
                      onClick={handleSolveClick}
                      disabled={isSolving}
                      className="w-full sm:w-auto sm:min-w-[140px] px-6 h-12 rounded-xl bg-amber text-ink font-semibold font-body-sm text-body-sm flex items-center justify-center gap-2 shadow-xs hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-70"
                      id="solve-now-btn"
                      type="button"
                    >
                      {isSolving ? (
                        <>
                          <span className="material-symbols-outlined text-[20px] animate-spin">refresh</span>
                          <span>{solvingFeedback || 'Transcribing ink...'}</span>
                        </>
                      ) : (
                        <>
                          <span>Solve</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleClearReset}
                      className="w-full sm:w-auto sm:min-w-[140px] px-6 h-12 rounded-xl bg-surface border border-hairline hover:bg-surface-container font-body-sm text-body-sm text-ink font-medium flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                      id="clear-reset-btn"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                      <span>Refresh</span>
                    </button>
                  </div>

                  {(solveError || (solvingFeedback && !isSolving)) && (
                    <div
                      role={solveError ? 'alert' : 'status'}
                      className={`px-3.5 py-2.5 rounded-xl border font-body-sm text-sm flex items-start gap-2 ${
                        solveError
                          ? 'bg-error-container/30 border-error/30 text-error'
                          : 'bg-sage/15 border-sage/30 text-ink'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
                        {solveError ? 'error' : 'info'}
                      </span>
                      <p>{solveError || solvingFeedback}</p>
                    </div>
                  )}
                </section>

                {/* RIGHT COLUMN: Solution & Verification Pane */}
                <section className="xl:col-span-6 flex flex-col gap-space-md">
                  {/* Status chip */}
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
                      <span>{solution ? solution.problemType : activeEngine || 'Deterministic Solver'}</span>
                    </div>
                  </div>

                  {!expression && !solution ? (
                    <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-hairline bg-surface p-space-xl text-center shadow-card">
                      <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center border border-hairline text-amber">
                        <span className="material-symbols-outlined text-[26px]">draw</span>
                      </div>
                      <h2 className="font-headline-sm text-headline-sm font-semibold text-ink">
                        Draw Math to Recognize &amp; Solve
                      </h2>
                      <p className="max-w-md font-body-sm text-body-sm text-ink-muted">
                        Write numbers, equations, fractions, or calculus symbols on the canvas. Click &quot;Solve&quot; to transcribe strokes and confirm your formula.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Extracted Formula Card with identical Inline Edit */}
                      <div className="bg-surface rounded-xl shadow-card p-space-md flex flex-col gap-space-sm border border-hairline">
                    <div className="flex items-center justify-between">
                      <span className="font-caption text-caption uppercase text-ink-muted tracking-wider">Recognized Math Expression</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingExpression(!isEditingExpression);
                          if (!isEditingExpression) {
                            setEditBuffer(expression);
                          }
                        }}
                        className="text-xs text-primary font-medium hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">edit</span>
                        <span>{isEditingExpression ? 'Close' : 'Edit'}</span>
                      </button>
                    </div>

                    {isEditingExpression ? (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2">
                        <input
                          type="text"
                          value={editBuffer}
                          onChange={(e) => setEditBuffer(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void handleConfirmEdit();
                            }
                          }}
                          className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-surface border border-hairline font-mono text-sm text-ink focus:outline-none focus:ring-1 focus:ring-amber"
                          placeholder="e.g. 3x - 30 = 0"
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
                      <div className="flex flex-col gap-3">
                        <div className="py-space-md px-space-lg rounded-xl bg-canvas/60 flex items-center justify-center text-center border border-hairline overflow-x-auto">
                          <MathRenderer math={latexExpr || expression} block className="text-2xl text-ink md:text-3xl" />
                        </div>
                        {isConfirming && (
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-hairline/60">
                            <span className="font-body-sm text-xs text-ink-muted">Does this formula match your written sketch?</span>
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              <button
                                type="button"
                                onClick={handleConfirmEdit}
                                className="px-3.5 py-1.5 rounded-lg bg-amber text-ink font-semibold font-body-sm text-xs shadow-xs hover:brightness-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[16px]">check</span>
                                <span>Confirm &amp; Solve</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {solution && !isConfirming && (
                    <div className="contents">
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
                      idPrefix="write-narrative"
                    />

                    {/* Utility Action Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-space-xs w-full">
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={handleToggleFavorite}
                          disabled={!historyId}
                          className={`w-10 h-10 rounded-xl bg-surface hover:bg-surface-container shadow-xs text-ink flex items-center justify-center transition-colors border border-hairline shrink-0 ${
                            historyId ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'
                          } ${isStarred ? 'text-amber' : ''}`}
                          id="star-btn"
                          title={historyId ? 'Favorite in Notebook' : 'Solve to save to Notebook'}
                          type="button"
                          aria-pressed={isStarred}
                        >
                          <span
                            className="material-symbols-outlined text-[18px]"
                            style={{ fontVariationSettings: isStarred ? "'FILL' 1" : "'FILL' 0" }}
                          >
                            {isStarred ? 'star' : 'star_border'}
                          </span>
                        </button>

                        <button
                          onClick={handleSolveClick}
                          className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-amber text-ink font-body-sm text-xs sm:text-body-sm font-semibold flex items-center justify-center gap-1.5 hover:brightness-105 active:scale-95 transition-all shadow-xs cursor-pointer whitespace-nowrap"
                          id="solve-another-btn"
                          type="button"
                        >
                          <span>Re-run</span>
                          <span className="material-symbols-outlined text-[16px]">refresh</span>
                        </button>
                      </div>
                    </div>

                    {historyNotice && (
                      <p role="status" className="font-code-sm text-[11px] text-ink-muted">
                        {historyNotice}
                      </p>
                    )}
                  </div>
                  )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
