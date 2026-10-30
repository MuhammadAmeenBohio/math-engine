'use client';

import React, { useState, useRef } from "react";
import { solveMathProblem } from "@/lib/engine/solver";
import { SolutionResult } from "@/lib/engine/types";
import { CompleteSolutionNarrative } from "@/components/solve/complete-solution-narrative";
import { MathRenderer } from "@/components/ui/MathRenderer";
import { saveHistory, setHistoryFavorite } from "@/lib/history";

const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

async function prepareUploadImage(dataUrl: string, rotation: number, invert: boolean): Promise<string> {
  const image = new Image();
  image.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not read image."));
  });

  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const radians = (rotation * Math.PI) / 180;
  const rotatedWidth = Math.round(Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians)));
  const rotatedHeight = Math.round(Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians)));
  const canvas = document.createElement("canvas");
  canvas.width = rotatedWidth;
  canvas.height = rotatedHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the image.");

  ctx.translate(rotatedWidth / 2, rotatedHeight / 2);
  ctx.rotate(radians);
  ctx.drawImage(image, -width / 2, -height / 2, width, height);

  if (invert) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < imageData.data.length; index += 4) {
      imageData.data[index] = 255 - imageData.data[index];
      imageData.data[index + 1] = 255 - imageData.data[index + 1];
      imageData.data[index + 2] = 255 - imageData.data[index + 2];
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}

const DEMO_WORKSHEET_IMAGE = "https://lh3.googleusercontent.com/aida-public/AB6AXuDRyP8JziTWzfAn9NRXPrubGscijbTCcbNlcIwlk2YeX7w7x4qOwK88VxAiXWmmAGogb8a1M38Yor_O4eaNpegGtU8NcCpLZdrjxeNDQBjrvz17QHnsLjIZqpbrjTfnJ1UzbG-G8DiJWNoM0SbtcblsnO1mlt_CKLFX5zcDi-UAju4moEGlSTzYfOFKbTmzGMJ6UQyOvcwMB4Yf5ZPjpBcnVYuD1iClrZjSVvKNsH9tQOCLZCqHxCCBcg";

export default function UploadSolvePage() {
  const [uploadRotation, setUploadRotation] = useState(0);
  const [isUploadInverted, setIsUploadInverted] = useState(false);
  const [isAnalyzingUpload, setIsAnalyzingUpload] = useState(false);
  const [uploadFeedbackText, setUploadFeedbackText] = useState<string | null>(null);
  const [isUploadStarred, setIsUploadStarred] = useState(false);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState("sample_quadratic_worksheet.png");
  const [fileSize, setFileSize] = useState("1.42 MB");
  const [imageDimensions, setImageDimensions] = useState("1200×800 px");
  const [isDragActive, setIsDragActive] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isEditingExpression, setIsEditingExpression] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [expression, setExpression] = useState<string>("x^2 - 5x + 6 = 0");
  const [editBuffer, setEditBuffer] = useState<string>("x^2 - 5x + 6 = 0");
  const [recognizedText, setRecognizedText] = useState<string>("x^2 - 5x + 6 = 0");
  const [latexExpr, setLatexExpr] = useState<string>("x^2 - 5x + 6 = 0");
  const [activeEngine, setActiveEngine] = useState<string>("Gemini 2.5 Flash Vision");
  const [confidence, setConfidence] = useState<number | null>(99.8);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [solution, setSolution] = useState<SolutionResult | null>(() => {
    const s = solveMathProblem("x^2 - 5x + 6 = 0");
    return { ...s, executionTimeMs: 0.5 };
  });

  // Restore latest user solution on refresh if available
  React.useEffect(() => {
    import("@/lib/history").then(({ getLatestHistoryItem }) => {
      getLatestHistoryItem("upload").then((latest) => {
        if (!latest) return;
        setExpression(latest.expression);
        setEditBuffer(latest.expression);
        setRecognizedText(latest.recognizedText || latest.expression);
        setLatexExpr(latest.latex);
        setFileName("Restored from Notebook");
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
        setIsUploadStarred(latest.favorite);
      }).catch(() => {});
    });
  }, []);

  const handleSelectedFile = (file: File) => {
    setAnalysisError(null);
    setHistoryNotice(null);

    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
      setAnalysisError("Unsupported file type. Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setAnalysisError("That image is larger than 10 MB. Choose a smaller file.");
      return;
    }

    // Clear previous analysis, solution, engine, confidence and flags
    setExpression("");
    setEditBuffer("");
    setRecognizedText("");
    setLatexExpr("");
    setActiveEngine("");
    setConfidence(null);
    setSolution(null);
    setHistoryId(null);
    setIsUploadStarred(false);
    setIsConfirming(false);
    setIsEditingExpression(false);

    setFileName(file.name);
    setFileSize((file.size / (1024 * 1024)).toFixed(2) + " MB");
    setUploadRotation(0);
    setIsUploadInverted(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result !== "string") return;
      setCustomImage(result);
      const image = new Image();
      image.onload = () => setImageDimensions(`${image.naturalWidth}×${image.naturalHeight} px`);
      image.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setCustomImage(null);
    setFileName("No image selected");
    setFileSize("—");
    setImageDimensions("—");
    setUploadRotation(0);
    setIsUploadInverted(false);
    setAnalysisError(null);
    setExpression("");
    setEditBuffer("");
    setRecognizedText("");
    setLatexExpr("");
    setActiveEngine("");
    setConfidence(null);
    setSolution(null);
    setHistoryId(null);
    setIsUploadStarred(false);
    setIsConfirming(false);
    setIsEditingExpression(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleSelectedFile(file);
    e.target.value = "";
  };

  const handleAnalyzeUpload = async () => {
    setIsAnalyzingUpload(true);
    setUploadFeedbackText("Running OCR (Tesseract + Gemini)...");
    setAnalysisError(null);
    setHistoryNotice(null);

    try {
      if (!customImage) {
        setAnalysisError("Choose a JPG, PNG, or WebP image before running OCR.");
        setIsAnalyzingUpload(false);
        setUploadFeedbackText(null);
        return;
      }

      let payloadImage: string;
      try {
        payloadImage = await prepareUploadImage(customImage, uploadRotation, isUploadInverted);
      } catch {
        setAnalysisError("The selected image could not be prepared. Try another file.");
        setIsAnalyzingUpload(false);
        setUploadFeedbackText(null);
        return;
      }

      let tesseractCandidate = "";
      let worker: import("tesseract.js").Worker | null = null;
      try {
        setUploadFeedbackText("Phase 1: Local optical scan (Tesseract)...");
        const { createWorker } = await import("tesseract.js");
        worker = await createWorker("eng");
        await worker.setParameters({
          tessedit_char_whitelist: "0123456789+-*/=^()xyzXYZabAB ",
          tessedit_pageseg_mode: "6" as unknown as import("tesseract.js").PSM,
        });
        const tRes = await worker.recognize(payloadImage);
        if (tRes.data?.text) {
          tesseractCandidate = tRes.data.text.trim();
        }
      } catch (tErr) {
        console.warn("Tesseract upload scan skipped:", tErr);
      } finally {
        if (worker) {
          try {
            await worker.terminate();
          } catch {
            // ignore cleanup failure
          }
        }
      }

      setUploadFeedbackText("Phase 2: Reconciling with Gemini Vision...");
      let geminiError = false;
      try {
        const res = await fetch("/api/ocr/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: payloadImage,
            mimeType: "image/jpeg",
            ocrHint: tesseractCandidate || undefined,
          }),
        });

        if (!res.ok) {
          geminiError = true;
        } else {
          const data = await res.json();
          if (data.expression && data.expression.trim()) {
            const recognized = data.expression.trim();
            setExpression(recognized);
            setEditBuffer(recognized);
            setRecognizedText(recognized);
            setLatexExpr(data.latex || recognized);
            const providerName = data.provider === 'groq-vision' ? 'Groq Vision (Qwen)' : 'Gemini 2.5 Flash Vision';
            setActiveEngine(tesseractCandidate ? `Ensemble: Tesseract + ${data.provider === 'groq-vision' ? 'Groq' : 'Gemini'}` : providerName);
            setConfidence(Number(data.confidence) || 95);
            setSolution(null);
            setIsConfirming(true); // Mandatory Confirm step (FR-RC-07)
            setIsEditingExpression(false);
            setHistoryId(null);
            setIsUploadStarred(false);
            setUploadFeedbackText("Formula recognized. Please review and confirm to solve.");
            return;
          }
          geminiError = true;
        }
      } catch {
        geminiError = true;
      }

      if (tesseractCandidate) {
        setExpression(tesseractCandidate);
        setEditBuffer(tesseractCandidate);
        setRecognizedText(tesseractCandidate);
        setLatexExpr(tesseractCandidate);
        setConfidence(75);
        setActiveEngine("Local Tesseract fallback");
        setSolution(null);
        setIsConfirming(true); // Mandatory Confirm step (FR-RC-07)
        setIsEditingExpression(false);
        setHistoryId(null);
        setIsUploadStarred(false);
        setUploadFeedbackText("Local recognition complete. Please review and confirm to solve.");
        setAnalysisError(
          geminiError
            ? "Gemini OCR was unavailable. The local Tesseract result is shown."
            : "Gemini did not return a usable expression. The local Tesseract result is shown."
        );
        return;
      }

      setAnalysisError("No mathematical expression was recognized. Try a clearer image or edit manually.");
      setUploadFeedbackText("Recognition failed. You can enter the expression manually.");
      setIsEditingExpression(true);
      setIsConfirming(true);
    } catch (err: unknown) {
      console.warn("Upload OCR error:", err);
      const msg = err instanceof Error ? err.message : "Recognition error";
      setAnalysisError(msg);
      setUploadFeedbackText("Recognition failed. Edit the expression manually or try another image.");
      setIsEditingExpression(true);
      setIsConfirming(true);
    } finally {
      setTimeout(() => {
        setIsAnalyzingUpload(false);
        setUploadFeedbackText(null);
      }, 1400);
    }
  };

  const handleConfirmEdit = async () => {
    const sol = solveMathProblem(editBuffer);
    if (!sol.success) {
      setAnalysisError(sol.error || 'The expression could not be solved. Check the syntax.');
      return;
    }

    setExpression(sol.normalizedExpression);
    setEditBuffer(sol.normalizedExpression);
    setLatexExpr(sol.latexExpression);
    setSolution(sol);
    setIsEditingExpression(false);
    setIsConfirming(false);
    setAnalysisError(null);
    setUploadFeedbackText(`Solved: ${sol.finalAnswerPlain}`);

    try {
      const record = await saveHistory({
        inputType: "upload",
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
      setIsUploadStarred(record.favorite);
      setHistoryNotice("Saved to Notebook.");
    } catch {
      setHistoryNotice("Solved, but local history is unavailable in this browser.");
    }
  };

  const handleToggleFavorite = async () => {
    if (!historyId) {
      if (!solution || !solution.success) return;
      try {
        const record = await saveHistory({
          inputType: "upload",
          expression: solution.normalizedExpression,
          recognizedText,
          latex: solution.latexExpression,
          problemType: solution.problemType,
          finalAnswerPlain: solution.finalAnswerPlain,
          finalAnswerLatex: solution.finalAnswerLatex,
          steps: solution.steps,
          isVerified: solution.isVerified,
          favorite: true,
        });
        setHistoryId(record.id);
        setIsUploadStarred(true);
        setHistoryNotice("Saved to Notebook.");
      } catch {
        setHistoryNotice("Could not update local history.");
      }
      return;
    }
    const next = !isUploadStarred;
    setIsUploadStarred(next);
    try {
      await setHistoryFavorite(historyId, next);
    } catch {
      setHistoryNotice("Could not update local history.");
    }
  };

  return (
          <div className="flex flex-col w-full">
            <div className="w-full px-margin py-space-lg max-w-[1520px] mx-auto flex flex-col gap-space-lg">
              {/* Header Section */}
              <section className="flex flex-col md:flex-row md:items-end justify-between gap-space-md border-b border-hairline pb-space-sm">
                <div className="flex flex-col gap-1.5 max-w-3xl">
                  <h1 className="font-headline-xl text-headline-xl text-ink tracking-tight font-semibold">
                    Upload Photo &amp; Solve
                  </h1>
                  <p className="font-body-lg text-body-lg text-ink-muted leading-relaxed">
                    Upload or drag photos of worksheets, scanned textbook pages, screenshots, or PNG/JPEG images for instant mathematical solving.
                  </p>
                </div>
              </section>

              {/* Main Two-Column Split Layout */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
                {/* LEFT COLUMN: Inspector & Dropzone */}
                <section className="xl:col-span-6 flex flex-col gap-space-md">
                  {/* Main Image Card Container */}
                  <div className="bg-surface rounded-2xl shadow-card p-space-md flex flex-col gap-space-md border border-hairline">
                    {/* Image Viewport with Bounding Box & Canvas Emulation */}
                    <div className="relative w-full rounded-xl overflow-hidden bg-surface-container-low h-[340px] sm:h-[400px] flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className="max-w-full max-h-full object-contain transition-transform duration-200"
                        style={{
                          transform: `rotate(${uploadRotation}deg)`,
                          filter: isUploadInverted ? 'invert(1)' : 'none',
                        }}
                        alt="Uploaded math image"
                        src={customImage || DEMO_WORKSHEET_IMAGE}
                      />
                      {/* Focus Corners */}
                      <div className="absolute top-6 left-6 w-5 h-5 border-t-2 border-l-2 border-amber pointer-events-none"></div>
                      <div className="absolute top-6 right-6 w-5 h-5 border-t-2 border-r-2 border-amber pointer-events-none"></div>
                      <div className="absolute bottom-6 left-6 w-5 h-5 border-b-2 border-l-2 border-amber pointer-events-none"></div>
                      <div className="absolute bottom-6 right-6 w-5 h-5 border-b-2 border-r-2 border-amber pointer-events-none"></div>
                    </div>

                    {/* Image Adjustment Tools: Rotate 90 & Invert */}
                    {customImage && (
                      <div className="flex items-center justify-between gap-2 px-2 py-1 bg-surface-container-low rounded-xl border border-hairline font-code-sm text-xs">
                        <span className="text-ink-muted font-medium">Image Tools:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setUploadRotation((prev) => (prev + 90) % 360)}
                            className="px-2.5 py-1 rounded-lg bg-surface border border-hairline hover:bg-surface-container text-ink flex items-center gap-1 cursor-pointer transition-colors"
                            title="Rotate 90 degrees"
                          >
                            <span className="material-symbols-outlined text-[15px]">rotate_right</span>
                            <span>Rotate 90° ({uploadRotation}°)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsUploadInverted((prev) => !prev)}
                            className={`px-2.5 py-1 rounded-lg border border-hairline flex items-center gap-1 cursor-pointer transition-colors ${
                              isUploadInverted ? 'bg-amber text-ink font-semibold' : 'bg-surface hover:bg-surface-container text-ink'
                            }`}
                            title="Invert image colors"
                          >
                            <span className="material-symbols-outlined text-[15px]">invert_colors</span>
                            <span>{isUploadInverted ? 'Inverted' : 'Invert'}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* File Metadata Ribbon */}
                    <div className="flex items-center justify-between gap-space-xs p-space-sm rounded-xl bg-surface-container-low font-code-sm text-code-sm text-ink border border-hairline">
                      <div className="flex items-center gap-2 min-w-0 truncate">
                        <span className="material-symbols-outlined text-outline text-[18px] shrink-0">draft</span>
                        <span className="font-medium truncate">{fileName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-ink-muted shrink-0 pl-2">
                        <span>{fileSize}</span>
                        <span>•</span>
                        <span>{imageDimensions}</span>
                        {customImage && (
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            title="Remove image"
                            aria-label="Remove image"
                            className="ml-1 w-6 h-6 rounded-md hover:bg-surface-container-high text-ink hover:text-error flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[17px]">close</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Drag and Drop Active Receptor Area (only when no image selected) */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    {!customImage && (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setIsDragActive(true);
                        }}
                        onDragLeave={() => setIsDragActive(false)}
                        onDrop={(event) => {
                          event.preventDefault();
                          setIsDragActive(false);
                          const file = event.dataTransfer.files?.[0];
                          if (file) handleSelectedFile(file);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            fileInputRef.current?.click();
                          }
                        }}
                        className={`rounded-xl p-space-md flex flex-col items-center justify-center text-center gap-2 transition-colors cursor-pointer group border border-dashed ${
                          isDragActive
                            ? "bg-amber/10 border-amber"
                            : "bg-surface-container-low hover:bg-surface border-hairline"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center shadow-xs text-primary group-hover:scale-105 transition-transform border border-hairline">
                          <span className="material-symbols-outlined text-[20px]">cloud_upload</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-body-sm text-body-sm font-medium text-ink">
                            Drag an image here, or <span className="text-primary underline cursor-pointer">browse filesystem</span>
                          </span>
                          <span className="font-code-sm text-code-sm text-ink-muted">
                            JPG, PNG, or WebP • maximum 10 MB
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Primary Action Dock */}
                  <div className="flex flex-col sm:flex-row items-center gap-space-sm">
                    <button
                      onClick={handleAnalyzeUpload}
                      disabled={isAnalyzingUpload}
                      className="w-full h-12 rounded-xl bg-amber hover:brightness-105 active:scale-[0.99] transition-all text-ink font-semibold font-body-sm text-body-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:cursor-wait disabled:opacity-70"
                      type="button"
                    >
                      {isAnalyzingUpload ? (
                        <>
                          <span className="material-symbols-outlined text-[20px] animate-spin">refresh</span>
                          <span>{uploadFeedbackText || 'Reading image...'}</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[20px]">document_scanner</span>
                          <span>Analyze Image &amp; Solve</span>
                        </>
                      )}
                    </button>
                  </div>
                </section>

                {/* RIGHT COLUMN: Extracted Math, Solution & Verification */}
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

                  {analysisError && (
                    <div role="alert" className="rounded-xl border border-error/30 bg-error-container/30 px-3.5 py-2.5 font-body-sm text-sm text-error flex items-start gap-2">
                      <span className="material-symbols-outlined text-error text-[18px] shrink-0 mt-0.5">error</span>
                      <p>{analysisError}</p>
                    </div>
                  )}

                  {!expression && !solution ? (
                    <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-hairline bg-surface p-space-xl text-center shadow-card">
                      <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center border border-hairline text-amber">
                        <span className="material-symbols-outlined text-[26px]">document_scanner</span>
                      </div>
                      <h2 className="font-headline-sm text-headline-sm font-semibold text-ink">
                        Upload an Image to Recognize &amp; Solve
                      </h2>
                      <p className="max-w-md font-body-sm text-body-sm text-ink-muted">
                        Select a math worksheet, textbook screenshot, or photo. Math Engine will read symbols and allow you to verify before solving.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Extracted Formula Card */}
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
                              <div className="flex items-center justify-between gap-2 pt-2 border-t border-hairline/60">
                                <span className="font-body-sm text-xs text-ink-muted">Does this formula match your image?</span>
                                <div className="flex items-center gap-2">
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
                            idPrefix="upload-narrative"
                          />

                    {/* Utility Action Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-space-xs w-full">
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={handleToggleFavorite}
                          disabled={!historyId}
                          className={`w-10 h-10 rounded-xl bg-surface hover:bg-surface-container shadow-xs text-ink flex items-center justify-center transition-colors border border-hairline shrink-0 ${
                            historyId ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'
                          } ${isUploadStarred ? 'text-amber' : ''}`}
                          id="star-btn"
                          title={historyId ? 'Favorite in Notebook' : 'Confirm a result to save it'}
                          type="button"
                          aria-pressed={isUploadStarred}
                        >
                          <span
                            className="material-symbols-outlined text-[18px]"
                            style={{ fontVariationSettings: isUploadStarred ? "'FILL' 1" : "'FILL' 0" }}
                          >
                            {isUploadStarred ? 'star' : 'star_border'}
                          </span>
                        </button>

                        <button
                          onClick={handleAnalyzeUpload}
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
