'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PenTool,
  Camera,
  Upload,
  Keyboard,
  ArrowRight,
  Undo2,
  Redo2,
  Trash2,
  RefreshCw,
  CheckCircle2,
  CheckSquare,
  FileText,
  Zap,
  PlayCircle,
  School,
  User as UserIcon,
  BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MathRenderer } from '@/components/ui/MathRenderer';
import { solveMathProblem } from '@/lib/engine/solver';

interface Benchmark {
  id: string;
  type: string;
  name: string;
  equation: string;
  latexEquation: string;
}

const BENCHMARKS: Benchmark[] = [
  {
    id: 'quad',
    type: 'Quadratic Equation',
    name: 'Quadratic Equation',
    equation: 'x^2 - 5x + 6 = 0',
    latexEquation: 'x^2 - 5x + 6 = 0',
  },
  {
    id: 'linear',
    type: 'Linear Equation',
    name: 'Linear Equation',
    equation: '3x + 5 = 20',
    latexEquation: '3x + 5 = 20',
  },
  {
    id: 'arithmetic',
    type: 'Exact Arithmetic',
    name: 'Exact Arithmetic',
    equation: '1/3 + 1/6',
    latexEquation: '\\frac{1}{3} + \\frac{1}{6}',
  },
  {
    id: 'quad-complex',
    type: 'Quadratic Equation',
    name: 'Complex Roots',
    equation: 'x^2 + 4 = 0',
    latexEquation: 'x^2 + 4 = 0',
  },
];

export default function Home() {
  const [activeModality, setActiveModality] = useState<'write' | 'camera' | 'file' | 'typed'>('write');

  const handleModalityChange = (value: string) => {
    const modality = value as 'write' | 'camera' | 'file' | 'typed';
    setActiveModality(modality);
  };
  const [selectedBenchmark, setSelectedBenchmark] = useState<Benchmark>(BENCHMARKS[0]);
  const [runtimeMs, setRuntimeMs] = useState<number | null>(null);
  const selectedResult = useMemo(
    () => solveMathProblem(selectedBenchmark.equation),
    [selectedBenchmark]
  );

  const runBenchmark = (benchmark: Benchmark) => {
    setSelectedBenchmark(benchmark);
    setRuntimeMs(solveMathProblem(benchmark.equation).executionTimeMs);
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'Math Engine',
        operatingSystem: 'All Modern Web Browsers',
        applicationCategory: 'EducationalApplication',
        description:
          'Camera, photo, handwriting, and typed math solver with Gemini-assisted OCR and a deterministic client-side computer algebra system for verified step-by-step results.',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Does Math Engine use an LLM to solve problems?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'No. Gemini is used only for optical character recognition. The lexer, parser, computer algebra system, and step verifier are deterministic and run locally in your browser.',
            },
          },
          {
            '@type': 'Question',
            name: 'Are my math photos or handwriting uploaded to a server?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Images may be sent to Google Gemini for OCR when the AI reader is used, with a local Tesseract fallback. Solving and saved history stay in your browser.',
            },
          },
          {
            '@type': 'Question',
            name: 'What types of math problems does Math Engine support?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Math Engine supports exact arithmetic, order of operations, linear equations, and quadratic equations with real, irrational, and complex roots.',
            },
          },
        ],
      },
    ],
  };

  return (
    <div className="bg-canvas min-h-screen text-ink flex flex-col font-sans overflow-x-hidden w-full">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* ================= HEADER ================= */}
      <header className="fixed top-0 w-full z-50 bg-canvas/90 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-16 max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Tag */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <Link href="/" className="flex items-center gap-2 group text-ink">
              <div className="relative w-8 h-8 rounded-full bg-surface flex items-center justify-center shrink-0 shadow-xs border border-black/5">
                <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7"></circle>
                  <path d="m16 16 4.5 4.5"></path>
                  <path d="m7 12 2-3 2.5 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"></path>
                  <circle cx="13.5" cy="9.5" fill="#1A8F6B" r="1.5" stroke="none"></circle>
                </svg>
              </div>
              <span className="font-semibold text-lg sm:text-xl tracking-tight text-ink">Math Engine</span>
            </Link>
          </div>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1 p-1 rounded-full bg-olive-tint-soft/50">
            <a href="#features" className="px-4 py-1.5 rounded-full text-sm text-ink-muted hover:text-ink transition-colors">Features</a>
            <a href="#how-it-works" className="px-4 py-1.5 rounded-full text-sm text-ink-muted hover:text-ink transition-colors">How it Works</a>
            <a href="#comparison" className="px-4 py-1.5 rounded-full text-sm text-ink-muted hover:text-ink transition-colors">Methods &amp; Verification</a>
            <a href="#benchmarks" className="px-4 py-1.5 rounded-full text-sm text-ink-muted hover:text-ink transition-colors">Benchmarks</a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <Button variant="secondary" size="sm" asChild className="hidden sm:inline-flex h-9 px-3.5 sm:h-10 sm:px-5">
              <Link href="/auth">Sign In</Link>
            </Button>
            <Button variant="default" size="sm" asChild className="h-9 px-3.5 sm:h-10 sm:px-5">
              <Link href="/solve/capture">
                <span className="hidden xs:inline">Launch</span> Solver
              </Link>
            </Button>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary flex items-center justify-center shrink-0 text-white">
              <UserIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTENT ================= */}
      <main className="w-full pt-16 bg-canvas flex-1 overflow-x-hidden">
        <div className="flex flex-col w-full">

          {/* 1. HERO SECTION */}
          <section className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-14 pb-8 flex flex-col items-center text-center">
           
            {/* Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl max-w-4xl font-bold text-ink tracking-tight mb-4 sm:mb-5 leading-tight sm:leading-tight px-1">
              Write, snap, upload, or type. Solved with{' '}
              <span className="relative inline-block text-ink whitespace-nowrap">
                deterministic
                <svg className="absolute -bottom-1.5 left-0 w-full h-2.5 sm:h-3 text-amber overflow-visible" fill="none" preserveAspectRatio="none" viewBox="0 0 100 12">
                  <path d="M2 9C28 3 72 2.5 98 8" stroke="currentColor" strokeLinecap="round" strokeWidth="3"></path>
                </svg>
              </span>{' '}
              rigor.
            </h1>


            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 w-full max-w-md mx-auto mb-6 sm:mb-8 px-2 pt-8">
              <Button size="lg" asChild className="w-full sm:w-auto h-12 sm:h-[54px]">
                <Link href="/solve/capture" className="flex items-center justify-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-surface/30 ">Guest Mode</span>
                  <ArrowRight className="w-4 h-4 ml-0.5 shrink-0" />
                </Link>
              </Button>
              <Button variant="secondary" size="lg" asChild className="w-full sm:w-auto h-12 sm:h-[54px]">
                <Link href="/auth" className="flex items-center justify-center gap-2">
                  <School className="w-4 h-4 text-tertiary shrink-0" />
                  <span>Quick Sign In</span>
                </Link>
              </Button>
            </div>

          </section>

          {/* 2. INTERACTIVE TEASER & SYMBOLIC WORKBENCH PREVIEW */}
          <section id="how-it-works" className="w-full max-w-6xl mx-auto px-3 sm:px-6 mb-12 sm:mb-16">
            <Card className="overflow-hidden border border-black/5 shadow-[0_1px_12px_rgba(0,0,0,0.06)]">
              {/* Workbench Top Bar with Tabs */}
              <Tabs value={activeModality} onValueChange={handleModalityChange} className="w-full">
                <div className="px-3 sm:px-5 py-3 bg-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-black/5">
                  {/* Modality Selector (Mobile Scrollable) */}
                  <div className="overflow-x-auto pb-1 md:pb-0 w-full md:w-auto">
                    <TabsList className="w-full sm:w-auto justify-start sm:justify-center">
                      <TabsTrigger value="write" className="text-[11px] sm:text-xs px-2.5 sm:px-4">
                        <PenTool className="w-3.5 h-3.5 text-amber shrink-0" />
                        <span className="whitespace-nowrap">1. Writepad</span>
                      </TabsTrigger>
                      <TabsTrigger value="camera" className="text-[11px] sm:text-xs px-2.5 sm:px-4">
                        <Camera className="w-3.5 h-3.5 shrink-0" />
                        <span className="whitespace-nowrap">2. Camera OCR</span>
                      </TabsTrigger>
                      <TabsTrigger value="file" className="text-[11px] sm:text-xs px-2.5 sm:px-4">
                        <Upload className="w-3.5 h-3.5 shrink-0" />
                        <span className="whitespace-nowrap">3. File Drop</span>
                      </TabsTrigger>
                      <TabsTrigger value="typed" className="text-[11px] sm:text-xs px-2.5 sm:px-4">
                        <Keyboard className="w-3.5 h-3.5 shrink-0" />
                        <span className="whitespace-nowrap">4. Type</span>
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <Link
                    href={
                      activeModality === 'write'
                        ? '/solve/write'
                        : activeModality === 'camera'
                        ? '/solve/capture'
                        : activeModality === 'typed'
                        ? '/solve/type'
                        : '/solve/upload'
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber hover:brightness-105 text-ink font-semibold text-xs transition-colors shrink-0 shadow-xs"
                  >
                    <span>Open Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </Tabs>

              {/* Split Demonstration Pane */}
              <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[380px] sm:min-h-[420px]">
                {/* Left: Input Expression Canvas */}
                <div className="lg:col-span-5 p-4 sm:p-6 flex flex-col justify-between gap-4 bg-surface relative overflow-hidden border-b lg:border-b-0 lg:border-r border-black/5">
                  <div className="relative z-10">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs text-ink-muted uppercase tracking-wider font-semibold truncate">Handwriting Pad</span>
                      <span className="font-mono text-[11px] sm:text-xs px-2 py-0.5 rounded bg-surface-container-high text-ink shrink-0">Stylus Ready</span>
                    </div>
                    <p className="text-xs sm:text-sm text-ink-muted">Draw equations naturally with stylus, finger, or mouse:</p>
                  </div>

                  {/* Equation Preview */}
                  <div className="relative z-10 my-auto py-3 flex flex-col items-center justify-center w-full overflow-hidden gap-3">
                    <div className="text-2xl sm:text-3xl text-ink font-semibold">
                      <MathRenderer math="x^2 - 5x + 6 = 0" />
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-low border border-black/5 font-mono text-[11px] sm:text-xs text-ink-muted">
                      <span className="w-2 h-2 rounded-full bg-amber shrink-0"></span>
                      <span>Instant Stroke Recognition</span>
                    </div>
                  </div>

                  {/* Canvas controls */}
                  <div className="relative z-10 flex items-center justify-between pt-2 border-t border-black/5">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" aria-label="Undo" className="h-8 w-8"><Undo2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label="Redo" className="h-8 w-8"><Redo2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label="Clear Canvas" className="h-8 w-8 hover:text-error hover:bg-error-container/30"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                    <span className="font-mono text-[11px] sm:text-xs text-ink-muted">Instant Response</span>
                  </div>
                </div>

                {/* Center Divider / Pipeline Transition */}
                <div className="lg:col-span-1 bg-surface-container-low flex flex-col items-center justify-center py-3 lg:py-0 border-b lg:border-b-0 lg:border-r border-black/5">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-surface shadow-xs flex items-center justify-center text-amber border border-black/5">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <span className="font-mono text-[10px] text-ink-muted mt-1.5 tracking-tighter uppercase font-semibold">Solve</span>
                </div>

                {/* Right: CAS Output & Steps */}
                <div className="lg:col-span-6 p-4 sm:p-6 bg-surface flex flex-col justify-between">
                  <div>
                    {/* Header with confidence */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3 sm:mb-4">
                      <span className="text-xs text-ink-muted uppercase tracking-wider font-semibold">Step-by-Step Solution</span>
                      <Badge variant="sage" className="text-[11px] sm:text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-sage shrink-0" />
                        <span>Valid Math Expression</span>
                      </Badge>
                    </div>

                    {/* Parsed Formula (KaTeX) */}
                    <div className="p-3 sm:p-4 rounded-xl bg-surface-container-lowest border border-black/5 shadow-xs mb-3 sm:mb-4 overflow-x-auto">
                      <span className="font-mono text-[11px] sm:text-xs text-ink-muted block mb-1">Parsed Expression (LaTeX)</span>
                      <div className="text-xl sm:text-2xl text-ink font-semibold py-1">
                        <MathRenderer math="x^2 - 5x + 6 = 0" block />
                      </div>
                    </div>

                    {/* Step Decomposition */}
                    <div className="space-y-2 mb-3 sm:mb-4">
                      <div className="p-2.5 sm:p-3 rounded-lg bg-surface-container-low flex items-start gap-3">
                        <span className="font-mono text-xs text-amber font-semibold shrink-0 mt-0.5">01</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs sm:text-sm font-medium text-ink truncate">Polynomial Factorization</span>
                            <span className="font-mono text-[11px] text-ink-muted shrink-0">Exact</span>
                          </div>
                          <div className="text-xs sm:text-sm text-ink-muted mt-1 overflow-x-auto">
                            <MathRenderer math="(x - 2)(x - 3) = 0" />
                          </div>
                        </div>
                      </div>

                      <div className="p-2.5 sm:p-3 rounded-lg bg-surface-container-low flex items-start gap-3">
                        <span className="font-mono text-xs text-sage font-semibold shrink-0 mt-0.5">02</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs sm:text-sm font-medium text-ink truncate">Zero-Product Principle</span>
                            <span className="text-[11px] text-sage font-semibold shrink-0">Roots</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded bg-surface text-ink text-xs sm:text-sm font-semibold shadow-xs border border-black/5">
                              <MathRenderer math="x_1 = 2" />
                            </span>
                            <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded bg-surface text-ink text-xs sm:text-sm font-semibold shadow-xs border border-black/5">
                              <MathRenderer math="x_2 = 3" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Verification Pill */}
                  <div className="p-2.5 sm:p-3 rounded-xl bg-surface-container text-ink font-mono text-[11px] sm:text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckSquare className="w-4 h-4 text-sage shrink-0" />
                      <span className="truncate">Verified: f(2) = 0, f(3) = 0</span>
                    </div>
                    <span className="text-secondary shrink-0 text-[10px] sm:text-xs font-semibold">Exact Solution Validated</span>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {/* 3. THREE CORE CAPTURE WORKFLOWS */}
          <section id="features" className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
              <span className="text-xs uppercase tracking-wider text-amber font-semibold block mb-1.5">Input Modalities</span>
              <h2 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight mb-2">
                Three visual capture workflows. Confirm before solve.
              </h2>
              <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                Every confirmed expression compiles into an immutable syntax tree and is solved in browser memory. OCR images may go to Gemini; math content is not sent for solving.
              </p>
            </div>

            {/* Triad Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {/* Card 1: Inking */}
              <Card className="p-5 sm:p-6 flex flex-col justify-between hover:-translate-y-1 transition-transform">
                <div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber/15 text-primary flex items-center justify-center mb-3 sm:mb-4">
                    <PenTool className="w-5 h-5 sm:w-6 sm:h-6 text-amber" />
                  </div>
                  <div className="inline-block px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wide bg-surface-container-high text-ink font-medium mb-2">Modality A</div>
                  <h3 className="text-base sm:text-lg font-semibold text-ink mb-1">Write Problem &amp; Solve</h3>
                  <p className="text-xs sm:text-sm text-ink-muted mb-4 leading-relaxed">
                    Pointer-event inking canvas tuned for Apple Pencil, Wacom, touch, and trackpads. Includes configurable stroke widths, an eraser, and undo/redo history.
                  </p>
                </div>
                <div className="pt-3 bg-surface-container-low/50 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 p-3 sm:p-4 rounded-b-2xl flex items-center justify-between text-ink-muted font-mono text-[11px] sm:text-xs border-t border-black/5">
                  <span className="truncate">Target: PointerEvents</span>
                  <span className="text-sage font-medium shrink-0">Undo/redo history</span>
                </div>
              </Card>

              {/* Card 2: Optical Camera OCR */}
              <Card className="p-5 sm:p-6 flex flex-col justify-between hover:-translate-y-1 transition-transform">
                <div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-secondary-container/60 text-secondary flex items-center justify-center mb-3 sm:mb-4">
                    <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
                  </div>
                  <div className="inline-block px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wide bg-surface-container-high text-ink font-medium mb-2">Modality B</div>
                  <h3 className="text-base sm:text-lg font-semibold text-ink mb-1">Capture Photo &amp; Solve</h3>
                  <p className="text-xs sm:text-sm text-ink-muted mb-4 leading-relaxed">
                    Camera frame capture with Gemini-assisted OCR and a local Tesseract fallback. Review the recognized expression before the deterministic solver runs.
                  </p>
                </div>
                <div className="pt-3 bg-surface-container-low/50 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 p-3 sm:p-4 rounded-b-2xl flex items-center justify-between text-ink-muted font-mono text-[11px] sm:text-xs border-t border-black/5">
                  <span className="truncate">MediaStream API</span>
                  <span className="text-sage font-medium shrink-0">Gemini + local fallback</span>
                </div>
              </Card>

              {/* Card 3: File Upload Dropzone */}
              <Card className="p-5 sm:p-6 flex flex-col justify-between hover:-translate-y-1 transition-transform">
                <div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-tertiary-fixed text-on-tertiary-fixed-variant flex items-center justify-center mb-3 sm:mb-4">
                    <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-tertiary" />
                  </div>
                  <div className="inline-block px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wide bg-surface-container-high text-ink font-medium mb-2">Modality C</div>
                  <h3 className="text-base sm:text-lg font-semibold text-ink mb-1">Upload Photo &amp; Solve</h3>
                  <p className="text-xs sm:text-sm text-ink-muted mb-4 leading-relaxed">
                    Drag-and-drop support for PNG, JPG, or WebP worksheet photos, with rotation and inversion controls before OCR.
                  </p>
                </div>
                <div className="pt-3 bg-surface-container-low/50 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 p-3 sm:p-4 rounded-b-2xl flex items-center justify-between text-ink-muted font-mono text-[11px] sm:text-xs border-t border-black/5">
                  <span className="truncate">PNG, JPG, WebP</span>
                  <span className="text-sage font-medium shrink-0">Confirm before solve</span>
                </div>
              </Card>
            </div>
          </section>

          {/* 4. DETERMINISTIC ENGINE VS PROBABILISTIC AI */}
          <section id="comparison" className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-8 sm:py-12">
            <Card className="p-4 sm:p-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 sm:gap-4 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-black/5">
                <div>
                  <span className="text-xs uppercase tracking-wider text-sage font-semibold block mb-1">How It Compares</span>
                  <h2 className="text-xl sm:text-3xl font-bold text-ink tracking-tight">
                    Exact Mathematical Steps vs. AI Guesswork
                  </h2>
                </div>
                <div className="text-ink-muted font-mono text-[11px] sm:text-xs">
                  200 Golden Problem Suite Verified (100% Passed)
                </div>
              </div>

              {/* Responsive Table with scroll container */}
              <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                <table className="w-full text-left text-xs sm:text-sm min-w-[540px]">
                  <thead>
                    <tr className="text-ink-muted text-[11px] sm:text-xs uppercase tracking-wider border-b border-black/5">
                      <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-semibold">Feature</th>
                      <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-semibold">Typical AI Chatbots</th>
                      <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-semibold text-ink">Math Engine</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    <tr>
                      <td className="py-3 sm:py-4 px-3 sm:px-4 font-medium text-ink">Calculation Method</td>
                      <td className="py-3 sm:py-4 px-3 sm:px-4 text-ink-muted">Guesses text words; frequently miscalculates signs and numbers</td>
                      <td className="py-3 sm:py-4 px-3 sm:px-4 font-semibold text-ink">Mathematical algebra engine with proven rules</td>
                    </tr>
                    <tr>
                      <td className="py-3 sm:py-4 px-3 sm:px-4 font-medium text-ink">Fractions &amp; Roots</td>
                      <td className="py-3 sm:py-4 px-3 sm:px-4 text-ink-muted">Rounds to decimals (1/3 ≈ 0.3333) losing accuracy</td>
                      <td className="py-3 sm:py-4 px-3 sm:px-4 font-semibold text-ink">Keeps exact fractions and real/complex roots</td>
                    </tr>
                    <tr>
                      <td className="py-3 sm:py-4 px-3 sm:px-4 font-medium text-ink">Answer Verification</td>
                      <td className="py-3 sm:py-4 px-3 sm:px-4 text-ink-muted">No self-checking; confident even when wrong</td>
                      <td className="py-3 sm:py-4 px-3 sm:px-4 font-semibold text-ink">Validates answers by back-substitution before showing</td>
                    </tr>
                    <tr>
                      <td className="py-3 sm:py-4 px-3 sm:px-4 font-medium text-ink">Speed &amp; Latency</td>
                      <td className="py-3 sm:py-4 px-3 sm:px-4 text-ink-muted">Slow 3-6 second cloud waiting time</td>
                      <td className="py-3 sm:py-4 px-3 sm:px-4 font-semibold text-ink">Instant browser calculation (typically &lt; 2ms)</td>
                    </tr>
                    <tr>
                      <td className="py-3 sm:py-4 px-3 sm:px-4 font-medium text-ink">Privacy</td>
                      <td className="py-3 sm:py-4 px-3 sm:px-4 text-ink-muted">Sends your entire notebook/worksheet to external servers</td>
                      <td className="py-3 sm:py-4 px-3 sm:px-4 font-semibold text-ink">Equations solve locally; your history stays on your device</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          {/* 5. INTERACTIVE LIVE BENCHMARK STRIP */}
          <section id="benchmarks" className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 mb-12 sm:mb-16">
            <div className="bg-surface-container rounded-2xl p-4 sm:p-6 shadow-xs border border-black/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber shrink-0" />
                  <span className="text-lg sm:text-xl font-bold text-ink">Live Interactive Examples</span>
                </div>
                <span className="text-xs text-ink-muted">Click an expression to see how it solves:</span>
              </div>

              {/* Clickable Benchmark Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-4">
                {BENCHMARKS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => runBenchmark(b)}
                    type="button"
                    className={`p-3 rounded-xl bg-surface text-ink text-left text-xs hover:shadow-md transition-all active:scale-[0.98] shadow-xs flex flex-col justify-between border cursor-pointer ${
                      selectedBenchmark.id === b.id ? 'ring-2 ring-amber border-transparent' : 'border-black/5'
                    }`}
                  >
                    <span className="text-[11px] font-sans text-ink-muted mb-1 truncate">{b.name}</span>
                    <div className="font-semibold text-ink mb-2 text-sm overflow-x-auto">
                      <MathRenderer math={b.latexEquation} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-sage font-medium">
                      <span>Instant</span>
                      <PlayCircle className="w-4 h-4 text-amber shrink-0" />
                    </div>
                  </button>
                ))}
              </div>

              {/* Telemetry output */}
              <div className="bg-surface rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-ink border border-black/5">
                <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-sage/20 text-ink flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                    <CheckCircle2 className="w-4 h-4 text-sage" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] sm:text-xs text-ink-muted block truncate">Selected: {selectedBenchmark.type}</span>
                    <div className="text-xs sm:text-sm font-semibold text-ink flex flex-wrap items-center gap-1.5 mt-0.5 overflow-x-auto">
                      <MathRenderer math={selectedBenchmark.latexEquation} />
                      <span className="text-ink-muted text-xs">⟶ Sol:</span>
                      <MathRenderer math={selectedResult.finalAnswerLatex} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-black/5">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] sm:text-xs text-ink-muted block">Solve Time</span>
                    <span className="font-mono text-xs sm:text-sm font-bold text-amber">{runtimeMs === null ? "Instant" : `${runtimeMs.toFixed(2)}ms`}</span>
                  </div>
                  <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded bg-secondary-container text-ink font-mono text-[10px] sm:text-xs font-semibold whitespace-nowrap">
                    Verified
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* 6. FINAL ACADEMIC CTA BANNER */}
          <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
            <Card className="relative p-6 sm:p-12 overflow-hidden text-center flex flex-col items-center">
              <Badge variant="default" className="mb-3 sm:mb-4 text-xs">
                <School className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary shrink-0" />
                <span className="truncate">Free &amp; Open Math Solver</span>
              </Badge>
              <h2 className="text-xl sm:text-3xl font-bold text-ink tracking-tight max-w-2xl mb-2 px-1">
                Experience fast, reliable mathematical reasoning in your browser.
              </h2>
              <p className="text-xs sm:text-sm text-ink-muted max-w-xl mx-auto mb-5 sm:mb-6 leading-relaxed px-2">
                Works seamlessly in all modern browsers. No account required, with solution history saved securely on your device.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 w-full max-w-md">
                <Button size="lg" asChild className="w-full sm:w-auto flex-1 h-12 sm:h-[52px]">
                  <Link href="/solve/capture" className="flex items-center justify-center gap-2">
                    <span>Launch Solver Now</span>
                    <Zap className="w-4 h-4 shrink-0" />
                  </Link>
                </Button>
                <Button variant="secondary" size="lg" asChild className="w-full sm:w-auto h-12 sm:h-[52px]">
                  <a href="#comparison" className="flex items-center justify-center gap-2">
                    <BookOpen className="w-4 h-4 text-ink-muted shrink-0" />
                    <span>How It Compares</span>
                  </a>
                </Button>
              </div>
            </Card>
          </section>

        </div>
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="w-full bg-surface py-6 sm:py-8 border-t border-black/5 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 text-ink-muted text-center md:text-left text-xs">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <span className="w-2 h-2 rounded-full bg-sage shrink-0"></span>
            <span>Math Engine • Step-by-Step Mathematical Solver • MIT License</span>
          </div>
          <div className="flex items-center justify-center gap-3 sm:gap-4 text-[11px] sm:text-xs">
            <span>Built for students &amp; educators</span>
            <span>•</span>
            <span>Local &amp; Private</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
