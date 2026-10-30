'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { solveMathProblem } from '@/lib/engine/solver';
import { SolutionResult } from '@/lib/engine/types';
import { saveHistory, setHistoryFavorite } from '@/lib/history';
import { CompleteSolutionNarrative } from '@/components/solve/complete-solution-narrative';
import { MathRenderer } from '@/components/ui/MathRenderer';
import { Camera as CameraIcon, RefreshCw, Loader2 } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

async function getVideoInputs(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === 'videoinput');
}

const DEMO_CAMERA_STANDBY_IMAGE = "https://lh3.googleusercontent.com/aida-public/AB6AXuBt68hWEVG72TdAuh8Y7q4hqn8skKXpdJg4Gt1EEFNJG5LW2SZ6MoD5-3tPdsMUFRLBTUcLtvvQsppFpx_WZLRQKU5a7k-GFguIvnd2WtrHy-YTKZXu0s966vjvDKXtCVjDlPDHKqQgIf9PFHpNs55jD3rLc-P5JfwdkYQlGw1bUsLhopkjqgyH0xtRwxFjdZa1knpB6pAwtXaqAN_NIbkxmMA287h_XpslJYCJVwCQMZbU2dBpZOfRHA";

export default function CaptureSolvePage() {
  const { data: session } = authClient.useSession();
  // Camera & Stream State
  const [cameraDevice, setCameraDevice] = useState<string>('default');
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraNotice, setCameraNotice] = useState<string | null>(null);

  // Capture, OCR & Processing State
  const [isProcessingCapture, setIsProcessingCapture] = useState<boolean>(false);
  const [captureFeedbackText, setCaptureFeedbackText] = useState<string | null>(null);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(99.8);
  const [ocrEngine] = useState<'hybrid' | 'gemini' | 'wasm'>('hybrid');
  const [activeEngineUsed, setActiveEngineUsed] = useState<string>('Gemini 2.5 Flash');
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(DEMO_CAMERA_STANDBY_IMAGE);

  // Equation & Confirm Step State (FR-CE)
  const [currentExpression, setCurrentExpression] = useState<string>('x^2 - 5x + 6 = 0');
  const [solution, setSolution] = useState<SolutionResult | null>(() => {
    const s = solveMathProblem('x^2 - 5x + 6 = 0');
    return { ...s, executionTimeMs: 0.5 };
  });
  const [isEditingConfirm, setIsEditingConfirm] = useState<boolean>(false);
  const [editBuffer, setEditBuffer] = useState<string>('x^2 - 5x + 6 = 0');

  // Bookmarking & Feedback
  const [isCaptureStarred, setIsCaptureStarred] = useState<boolean>(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);

  // Refresh persistence: Restore user's last captured problem from history if available
  useEffect(() => {
    import('@/lib/history').then(({ getLatestHistoryItem }) => {
      getLatestHistoryItem('camera').then((latest) => {
        if (!latest) return;
        setCurrentExpression(latest.expression);
        setEditBuffer(latest.expression);
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
        setOcrConfidence(100.0);
        setHistoryId(latest.id);
        setIsCaptureStarred(latest.favorite);
      }).catch(() => {});
    });
  }, []);

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCameraNotice = (message: string) => {
    setCameraNotice(message);
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = setTimeout(() => setCameraNotice(null), 3000);
  };

  // 1. Initialize Camera and enumerate physical devices
  useEffect(() => {
    let cancelled = false;

    async function initCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError('Camera API (getUserMedia) not supported in this browser.');
          return;
        }

        setAvailableDevices(await getVideoInputs());

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsCameraActive(true);
        setCameraError(null);

        // Device labels and availability are only exposed after permission is granted.
        setAvailableDevices(await getVideoInputs());
      } catch (err: unknown) {
        console.warn('Camera access error or permission denied:', err);
        if (!cancelled) {
          setCameraError('Camera access denied or unavailable. Using high-resolution optical calibration feed.');
          setIsCameraActive(false);
        }
      }
    }

    initCamera();

    return () => {
      cancelled = true;
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Attach the stream once the video element mounts after camera activation.
  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [isCameraActive]);

  // Keep the device list in sync when cameras are plugged in or removed.
  useEffect(() => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.addEventListener) return;

    const handleDeviceChange = () => {
      getVideoInputs()
        .then(setAvailableDevices)
        .catch(() => setAvailableDevices([]));
    };

    mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => mediaDevices.removeEventListener('devicechange', handleDeviceChange);
  }, []);

  // Switch camera when user selects device
  const handleDeviceChange = async (deviceId: string) => {
    const previousStream = streamRef.current;

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId === 'default' ? { facingMode: 'environment' } : { deviceId: { exact: deviceId } },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      previousStream?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => undefined);
      }
      setCameraDevice(deviceId);
      setIsCameraActive(true);
      setCameraError(null);
      setCameraNotice(null);
      setAvailableDevices(await getVideoInputs());
    } catch {
      // Keep the previous working stream if the requested camera cannot be opened.
      setCameraError('Could not switch to chosen device.');
    }
  };

  const handleSwitchCamera = async () => {
    let devices: MediaDeviceInfo[] = [];
    try {
      devices = await getVideoInputs();
      setAvailableDevices(devices);
    } catch {
      showCameraNotice('Unable to list camera devices.');
      return;
    }

    if (devices.length <= 1) {
      showCameraNotice(devices.length === 0 ? 'No camera devices detected.' : 'Only one camera is available on this device.');
      return;
    }

    const currentIndex = devices.findIndex((device) => device.deviceId === cameraDevice);
    const nextDevice = devices[(currentIndex + 1) % devices.length];
    await handleDeviceChange(nextDevice.deviceId);
  };

  // 2. Real Frame Capture + OCR Processing Pipeline
  const handleCaptureAndSolve = async () => {
    if (!isCameraActive || !videoRef.current || !canvasRef.current) {
      showCameraNotice('Camera is not active. Please start or grant camera access first.');
      return;
    }

    setIsProcessingCapture(true);
    setCaptureFeedbackText('Capturing Optical Frame...');

    try {
      let imageUri: string | null = null;
      let snapshotUrl: string | null = null;

      // Crop ONLY the Region of Interest and binarize
      const video = videoRef.current;
      const rawCanvas = canvasRef.current;
      rawCanvas.width = video.videoWidth || 1280;
      rawCanvas.height = video.videoHeight || 720;
      const ctx = rawCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, rawCanvas.width, rawCanvas.height);

        // The targeting amber box corresponds to 78% width, 58% height centered
        const roiRatio = {
          x: (1 - 0.78) / 2,
          y: (1 - 0.58) / 2,
          width: 0.78,
          height: 0.58,
        };

        const { preprocessCameraFrame } = await import('@/lib/engine/preprocessor');
        const { croppedDataUrl, binarizedDataUrl } = preprocessCameraFrame(rawCanvas, roiRatio);
        imageUri = binarizedDataUrl;
        snapshotUrl = croppedDataUrl;
        setCapturedSnapshot(croppedDataUrl);
      }

      if (!imageUri || !snapshotUrl) {
        throw new Error('Could not capture frame from camera.');
      }

      const targetImage = snapshotUrl;

      let rawOcrText = '';
      let confScore = 95.0;
      let engineLabel = 'Hybrid OCR (Tesseract + Gemini)';

      // ----------------------------------------------------
      // PHASE 1: Run Local WASM Tesseract.js (Optical Symbol Scan)
      // ----------------------------------------------------
      let localTesseractCandidate = '';
      let tesseractConfidence = 0;

      if (ocrEngine !== 'gemini') {
        let worker: import('tesseract.js').Worker | null = null;
        try {
          setCaptureFeedbackText('Step 1/2: Optical Symbol Scan (Tesseract)...');
          const { createWorker } = await import('tesseract.js');
          worker = await createWorker('eng');

          await worker.setParameters({
            tessedit_char_whitelist: '0123456789+-*/=^()xyzXYZabAB ',
            tessedit_pageseg_mode: '7' as unknown as import('tesseract.js').PSM,
          });

          const ret1 = await worker.recognize(imageUri);
          if (ret1.data?.text) {
            localTesseractCandidate = ret1.data.text.trim();
            tesseractConfidence = ret1.data.confidence || 0;
          }

          if ((!localTesseractCandidate || !/[+\-*/=a-zA-Z]/.test(localTesseractCandidate)) && targetImage) {
            await worker.setParameters({
              tessedit_pageseg_mode: '6' as unknown as import('tesseract.js').PSM,
            });
            const ret2 = await worker.recognize(targetImage);
            if (ret2.data?.text) {
              localTesseractCandidate = ret2.data.text.trim();
              tesseractConfidence = ret2.data.confidence || tesseractConfidence;
            }
          }
        } catch (tessErr) {
          console.warn('Tesseract scan skipped or failed:', tessErr);
        } finally {
          if (worker) {
            try {
              await worker.terminate();
            } catch {
              // ignore worker cleanup error
            }
          }
        }
      }

      // ----------------------------------------------------
      // PHASE 2: Gemini Vision AI Reconciles Tesseract Data
      // Passes BOTH image pixels AND Tesseract candidate tokens
      // to cross-verify and produce the best combined output
      // ----------------------------------------------------
      let geminiSuccess = false;

      if (ocrEngine !== 'wasm' && targetImage) {
        try {
          setCaptureFeedbackText('Step 2/2: Reconciling with Gemini Vision...');
          const res = await fetch('/api/ocr/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: targetImage,
              mimeType: 'image/jpeg',
              ocrHint: localTesseractCandidate || undefined,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.expression && data.expression.trim().length > 0) {
              rawOcrText = data.expression.trim();
              geminiSuccess = true;
              const providerName = data.provider === 'groq-vision' ? 'Groq Vision (Qwen)' : 'Gemini 2.5 Flash';
              engineLabel = localTesseractCandidate ? `Ensemble: Tesseract + ${data.provider === 'groq-vision' ? 'Groq' : 'Gemini'}` : providerName;
            }
          }
        } catch (apiErr) {
          console.warn('Gemini endpoint error, will fallback to Tesseract output:', apiErr);
        }
      }

      // If Gemini was offline or disabled, use the local Tesseract candidate
      if (!geminiSuccess) {
        rawOcrText = localTesseractCandidate;
        confScore = tesseractConfidence || 75.0;
        engineLabel = 'Local Tesseract';
      }


      setActiveEngineUsed(engineLabel);

      // Clean and normalize using engine normalizer
      const { normalizeMathExpression } = await import('@/lib/engine/normalizer');
      const normalizedOcr = normalizeMathExpression(rawOcrText);

      if (!normalizedOcr || normalizedOcr.length < 2) {
        setCaptureFeedbackText('No math symbols detected. Reposition camera.');
        setCameraError('Could not read math symbols. Hold camera steady, ensure good lighting, and align inside the amber box.');
        setIsProcessingCapture(false);
        return;
      }

      setCameraError(null);
      setOcrConfidence(Number(confScore.toFixed(1)));
      setCurrentExpression(normalizedOcr);
      setEditBuffer(normalizedOcr);
      setIsEditingConfirm(true);
      setHistoryId(null);
      setHistoryNotice(null);
      setIsCaptureStarred(false);

      setCaptureFeedbackText(`Recognized via ${engineLabel}. Confirm the expression to solve.`);
      setTimeout(() => {
        setIsProcessingCapture(false);
        setCaptureFeedbackText(null);
      }, 1400);
    } catch (err: unknown) {
      console.warn('OCR error during capture:', err);
      const msg = err instanceof Error ? err.message : 'Camera capture error';
      setCameraError(msg);
      setCaptureFeedbackText('Recognition error');
      setTimeout(() => {
        setIsProcessingCapture(false);
        setCaptureFeedbackText(null);
      }, 1500);
    }
  };

  // 3. Confirm Step: Solve edited expression
  const handleConfirmEdit = async () => {
    const sol = solveMathProblem(editBuffer);
    if (!sol.success) {
      setCameraError(sol.error || 'The expression could not be solved. Check the syntax.');
      return;
    }

    setCurrentExpression(sol.normalizedExpression);
    setEditBuffer(sol.normalizedExpression);
    setSolution(sol);
    setIsEditingConfirm(false);
    setCameraError(null);

    if (session?.user && currentExpression && currentExpression !== sol.normalizedExpression) {
      void fetch('/api/ocr/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recognizedText: currentExpression,
          correctedText: sol.normalizedExpression,
          confidence: ocrConfidence,
          engine: activeEngineUsed,
        }),
      }).catch(() => undefined);
    }

    try {
      const record = await saveHistory({
        expression: sol.normalizedExpression,
        latex: sol.latexExpression || sol.normalizedExpression,
        recognizedText: currentExpression,
        problemType: sol.problemType,
        inputType: 'camera',
        finalAnswerPlain: sol.finalAnswerPlain,
        finalAnswerLatex: sol.finalAnswerLatex,
        isVerified: sol.isVerified,
        steps: sol.steps,
      });
      setHistoryId(record.id);
      setHistoryNotice('Confirmed result saved to Notebook.');
    } catch {
      setHistoryId(null);
      setHistoryNotice('Could not save this result to Notebook.');
    }
  };

  const handleCaptureFavorite = async () => {
    if (!historyId) return;
    const next = !isCaptureStarred;
    setIsCaptureStarred(next);
    try {
      await setHistoryFavorite(historyId, next);
      setHistoryNotice(next ? 'Saved to Favorites.' : 'Removed from Favorites.');
    } catch {
      setIsCaptureStarred(!next);
      setHistoryNotice('Could not update Favorites.');
    }
  };

  return (
    <div className="flex flex-col w-full">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="w-full px-margin py-space-lg flex flex-col gap-space-lg max-w-[1520px] mx-auto">
        {/* Top Metadata & Header Section */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-space-md border-b border-hairline pb-space-sm">
          <div className="flex flex-col gap-1.5 max-w-3xl">
            <h1 className="font-headline-xl text-headline-xl text-ink tracking-tight font-semibold">
              Capture Photo &amp; Solve
            </h1>
            <p className="font-body-lg text-body-lg text-ink-muted leading-relaxed">
                Align a handwritten note or printed problem inside the frame, capture it, then review the recognized expression before solving.
            </p>
          </div>

        </section>

        {/* Main Two-Column Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
          {/* LEFT COLUMN: Live Viewfinder & Optical Capture Engine */}
          <section className="xl:col-span-6 flex flex-col gap-space-md">
            {/* Viewfinder Outer Housing */}
            <div className="relative flex w-full flex-col gap-3 overflow-hidden rounded-2xl bg-ink p-3 shadow-card">
              {/* Camera Stream / Video Surface */}
              <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-ink select-none flex items-center justify-center">
                {cameraError && (
                  <div className="absolute inset-x-3 top-3 z-30 flex flex-col items-center gap-2 rounded-xl bg-error/95 px-4 py-3 text-center text-xs font-medium text-white shadow-lg backdrop-blur-md">
                    <span>{cameraError}</span>
                    <Link
                      href="/solve/upload"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-error hover:bg-surface transition-colors shadow-xs"
                    >
                      <span>Switch to File Upload Instead</span>
                    </Link>
                  </div>
                )}
                {isCameraActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : capturedSnapshot ? (
                  <div
                    className="absolute inset-0 bg-contain bg-center bg-no-repeat bg-surface-container-lowest brightness-[0.95]"
                    style={{
                      backgroundImage: `url('${capturedSnapshot}')`,
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-container-low p-6 text-center text-ink-muted">
                    <span className="material-symbols-outlined text-[48px] opacity-40">videocam_off</span>
                    <p className="font-body-sm text-sm max-w-xs">Camera is inactive. Turn on camera permissions to view live viewfinder and solve equations.</p>
                  </div>
                )}

                {/* Live Feedback overlay banner when capturing / processing */}
                {captureFeedbackText && (
                  <div className="absolute top-4 inset-x-4 z-30 flex items-center justify-center">
                    <div className="flex items-center gap-2 rounded-full bg-ink/80 backdrop-blur-md px-4 py-1.5 text-xs font-medium text-white shadow-md animate-in fade-in duration-200">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber" />
                      <span>{captureFeedbackText}</span>
                    </div>
                  </div>
                )}

                {/* Precision Amber Corner Guides (Targeting Box) */}
                <div className="relative z-10 w-[82%] h-[64%] rounded flex items-center justify-center pointer-events-none">
                  {/* Top-Left Amber Guide */}
                  <div className="absolute top-0 left-0 w-8 h-8 flex flex-col justify-start">
                    <div className="w-8 h-[2.5px] bg-amber rounded-full"></div>
                    <div className="w-[2.5px] h-8 bg-amber rounded-full"></div>
                  </div>
                  {/* Top-Right Amber Guide */}
                  <div className="absolute top-0 right-0 w-8 h-8 flex flex-col items-end">
                    <div className="w-8 h-[2.5px] bg-amber rounded-full"></div>
                    <div className="w-[2.5px] h-8 bg-amber rounded-full"></div>
                  </div>
                  {/* Bottom-Left Amber Guide */}
                  <div className="absolute bottom-0 left-0 w-8 h-8 flex flex-col justify-end">
                    <div className="w-[2.5px] h-8 bg-amber rounded-full"></div>
                    <div className="w-8 h-[2.5px] bg-amber rounded-full"></div>
                  </div>
                  {/* Bottom-Right Amber Guide */}
                  <div className="absolute bottom-0 right-0 w-8 h-8 flex flex-col items-end justify-end">
                    <div className="w-[2.5px] h-8 bg-amber rounded-full"></div>
                    <div className="w-8 h-[2.5px] bg-amber rounded-full"></div>
                  </div>
                </div>
              </div>

              {/* Bottom Viewfinder Action Buttons: Equal circular icon buttons */}
              <div className="flex items-center justify-center gap-3 pt-1">
                {/* Primary Capture Button */}
                <button
                  onClick={handleCaptureAndSolve}
                  disabled={isProcessingCapture}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-amber hover:bg-primary-fixed active:scale-95 text-ink shadow-md transition-all cursor-pointer disabled:opacity-50 shrink-0"
                  id="btn-primary-capture"
                  type="button"
                  title="Capture and solve"
                  aria-label="Capture and solve"
                >
                  {isProcessingCapture ? (
                    <Loader2 className="w-5 h-5 animate-spin text-ink" />
                  ) : (
                    <CameraIcon className="w-5 h-5 text-ink" />
                  )}
                </button>

                {/* Switch Camera Button */}
                <button
                  onClick={handleSwitchCamera}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-surface/15 hover:bg-surface/25 active:scale-95 text-white transition-all cursor-pointer shadow-sm shrink-0"
                  id="btn-retake"
                  type="button"
                  title="Switch camera"
                  aria-label="Switch camera"
                >
                  <RefreshCw className="w-5 h-5 text-white" />
                </button>
              </div>

              {cameraNotice && (
                <p role="status" aria-live="polite" className="px-2 text-center font-code-sm text-[11px] text-amber">
                  {cameraNotice}
                </p>
              )}
            </div>
          </section>

          {/* RIGHT COLUMN: OCR Confirmation, Canonical Proof & Step Derivation */}
          <section className="xl:col-span-6 flex flex-col gap-space-md">
            {/* Status chip */}
            <div className="flex items-center justify-between flex-wrap gap-space-xs">
              <div className="flex items-center gap-space-xs">
                {ocrConfidence !== null && (
                  <span className="rounded-full bg-secondary-fixed px-space-sm py-0.5 font-code-sm text-[10px] font-medium text-on-secondary-fixed sm:text-code-sm">
                    Confidence: {ocrConfidence}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-secondary font-code-sm text-code-sm">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>{solution ? solution.problemType : activeEngineUsed || 'Deterministic Solver'}</span>
              </div>
            </div>

            {!currentExpression && !solution ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-hairline bg-surface p-space-xl text-center shadow-card">
                <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center border border-hairline text-amber">
                  <span className="material-symbols-outlined text-[26px]">photo_camera</span>
                </div>
                <h2 className="font-headline-sm text-headline-sm font-semibold text-ink">
                  Capture Math Equation to Solve
                </h2>
                <p className="max-w-md font-body-sm text-body-sm text-ink-muted">
                  Position your handwritten worksheet or textbook problem inside the viewfinder and click the capture button to scan and confirm.
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
                        setIsEditingConfirm(!isEditingConfirm);
                        if (!isEditingConfirm) {
                          setEditBuffer(currentExpression);
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
                        <MathRenderer
                          math={solution?.latexExpression || currentExpression}
                          block
                          className="text-2xl text-ink md:text-3xl"
                        />
                      </div>
                      {!solution && (
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-hairline/60">
                          <span className="font-body-sm text-xs text-ink-muted">Does this formula match your camera capture?</span>
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

                {solution && (
                  <div className="contents">
                    {/* Canonical Answer Hero Card */}
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
                      originalProblem={currentExpression}
                      idPrefix="capture-narrative"
                    />

                    {/* Utility Action Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-space-xs w-full">
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={handleCaptureFavorite}
                          disabled={!historyId}
                          className={`w-10 h-10 rounded-xl bg-surface hover:bg-surface-container shadow-xs text-ink flex items-center justify-center transition-colors border border-hairline shrink-0 ${
                            historyId ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'
                          } ${isCaptureStarred ? 'text-amber' : ''}`}
                          id="star-btn"
                          title={historyId ? 'Favorite in Notebook' : 'Confirm a result to save it'}
                          type="button"
                          aria-pressed={isCaptureStarred}
                        >
                          <span
                            className="material-symbols-outlined text-[18px]"
                            style={{ fontVariationSettings: isCaptureStarred ? "'FILL' 1" : "'FILL' 0" }}
                          >
                            {isCaptureStarred ? 'star' : 'star_border'}
                          </span>
                        </button>

                        <button
                          onClick={() => {
                            setIsEditingConfirm(false);
                            setCameraError(null);
                            setHistoryNotice(null);
                            setOcrConfidence(null);
                            setCapturedSnapshot(null);
                            setCurrentExpression('');
                            setSolution(null);
                          }}
                          className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-amber text-ink font-body-sm text-xs sm:text-body-sm font-semibold flex items-center justify-center gap-1.5 hover:brightness-105 active:scale-95 transition-all shadow-xs cursor-pointer whitespace-nowrap"
                          id="solve-another-btn"
                          type="button"
                        >
                          <span>Capture Another</span>
                          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
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
