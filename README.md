# Math Engine

> **Write, snap, upload, or type. Solved with deterministic rigor.**
> A hybrid mathematical compiler and step-by-step problem solver bridging multimodal vision with deterministic computer algebra.

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-16.4-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![Google Gemini](https://img.shields.io/badge/Gemini_2.5_Flash-Vision_OCR-4285F4?logo=google)](https://deepmind.google/technologies/gemini/)
[![KaTeX](https://img.shields.io/badge/KaTeX-LaTeX_Render-3298dc)](https://katex.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose_9-47A248?logo=mongodb)](https://www.mongodb.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## The Core Philosophy: Separation of Concerns

Traditional AI math solvers suffer from **stochastic hallucinations**—frequently making subtle arithmetic mistakes or inventing false intermediate steps because they predict tokens probabilistically. Conversely, traditional Computer Algebra Systems (CAS) require strict, non-ambiguous syntax and completely fail when handling uneven handwriting.

**Math Engine solves this through a strict architectural boundary:**

1. **Half A: Recognition (Untrusted):** Multimodal AI Vision (Gemini 2.5 Flash, with an optional local Ollama vision model or Groq fallback) and local Tesseract.js transcribe noisy handwritten strokes or camera captures into clean LaTeX.
2. **Interactive Confirmation Gate:** The user visually verifies and can tweak any ambiguous symbol in seconds.
3. **Half B: Deterministic Math Compiler (Trusted):** Zero AI calls. The expression is parsed into an Abstract Syntax Tree (AST), simplified, solved, and verified step-by-step with 100% mathematical certainty.

---

## Mathematical Compiler Pipeline

The mathematical compiler transforms unparsed equation strings into verified algebraic derivations through a formal six-stage pipeline:

### Pipeline Stages:
1. **Normalizer:** Cleans whitespace, handles implicit multiplications (e.g. `2x(x+3)` $\to$ `2*x*(x+3)`), replaces unicode operator variants, and balances brackets.
2. **Preprocessor & Equation Classifier:** Detects LHS / RHS boundaries, separates equation types, and isolates targets.
3. **Lexer / Tokenizer:** Scans characters into typed tokens (Number, Variable, Operator, Function, Parenthesis).
4. **AST Parser:** Builds an immutable Abstract Syntax Tree preserving operator precedence and mathematical associativity.
5. **Solver Core:** Applies algebraic rewrite rules and the quadratic/linear solving algorithms.
6. **Narrative Step Generator:** Generates human-readable, step-by-step textbook explanations with formal KaTeX math deductions.

---

## Supported Problem Domains & Taxonomy

Math Engine is engineered to handle diverse mathematical branches deterministically without sending problems to cloud solver APIs:

- **Quadratic Equations:** Real, irrational, and complex roots via the discriminant and quadratic formula, with exact verification.
- **Linear Equations:** Single-variable equations, multi-step balancing, and fraction clearing.
- **Exact Arithmetic & Scientific:** Exact fractions, BigInt factorials, radical simplifications, and logarithmic operations.

> This build is intentionally scoped to arithmetic, linear, and quadratic equations while the quadratic solver is hardened further. Systems of equations, inequalities, matrices, calculus, and polynomial factoring have been removed for now.

---

## Technology Stack & Architecture

Math Engine is built as an offline-first, high-performance web platform combining client-side rendering with serverless AI routes:

| Layer | Technologies & Purpose |
| :--- | :--- |
| **Frontend & UI** | **Next.js 16**, **React 19**, **TypeScript**, **Tailwind CSS v4**, **KaTeX** (instant math rendering), **Framer Motion** |
| **AI & Vision OCR** | **Google Gemini 2.5 Flash** (via `@google/genai`) primary OCR, optional **Groq Vision** or local **Ollama** vision model as fallback, + **Tesseract.js** for local offline fallback |
| **Compiler Engine** | Custom Lexer & Recursive Descent Parser, Exact Rational BigInt CAS |
| **Backend & Database** | Next.js Server Actions & Route Handlers, **MongoDB** & **Mongoose**, **Better Auth** (Session, Google OAuth, Email OTP), **Zod** schema validation |
| **Tooling** | **ESLint**, **Turbopack**, **pnpm**, **Vitest** (configured, test suite not yet written) |

---

## Database & Schema Architecture

Math Engine supports seamless anonymous guest exploration with local **IndexedDB** caching, alongside cloud persistence for authenticated users via MongoDB:

- **`users` Collection:** Stores user identity, Google OAuth profile info, and creation timestamps (managed by Better Auth).
- **`problems` Collection:** Persists complete derivation history, input method (`upload` \| `camera` \| `pad` \| `typed`), recognized raw text, final LaTeX expression, classified problem type, exact verified answers, step-by-step intermediate arrays, canvas stroke telemetry, and notebook favorites with full text-search indexing.

---

## Getting Started

### Prerequisites
- **Node.js** 20.x or higher
- **pnpm** (recommended: `pnpm@10+`)
- **MongoDB Instance** (local MongoDB or Atlas cluster)
- At least one OCR provider: a **Google Gemini API Key** (free tier at [Google AI Studio](https://aistudio.google.com/)), a **Groq API key**, or a local **Ollama** install with a vision-capable model (e.g. `qwen2.5vl`)

### 1. Clone the repository
```bash
git clone https://github.com/your-username/math-engine.git
cd math-engine
```

### 2. Install dependencies
```bash
pnpm install
```

### 3. Configure environment variables
Copy the example environment configuration:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:
```env
# Database & Authentication
MONGODB_URI="mongodb://localhost:27017/mathengine"
BETTER_AUTH_SECRET="your-secure-random-secret"
BETTER_AUTH_URL="http://localhost:3000"

# OCR: Gemini is primary. Groq and local Ollama are optional fallbacks.
GEMINI_API_KEY=""
GROQ_API_KEY=""
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="qwen2.5vl:3b"

# Optional: Google OAuth sign-in
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Optional: email OTP sign-in (falls back to logging the code to the console in dev)
RESEND_API_KEY=""
```

### 4. Run the development server
```bash
pnpm dev
```
Navigate to [http://localhost:3000](http://localhost:3000) to open the application.

---

## Tooling

```bash
# Run TypeScript typechecks
pnpm typecheck

# Run linter
pnpm lint

# Run Vitest (configured; no test suite checked in yet)
pnpm test
```

---

## Project Structure

```
math-engine/
├── app/                      # Next.js App Router
│   ├── api/                  # API Route handlers (OCR, auth, history)
│   ├── auth/                 # Sign-in & Authentication views
│   ├── solve/                # Solver workspaces (capture, upload, write, type, notebook)
│   └── page.tsx              # Landing page
├── components/                # UI & Solver components
│   ├── canvas/                # Digital ink canvas & handwriting pad
│   ├── ocr/                   # Webcam capture & image crop components
│   ├── solve-header.tsx       # Navigation & profile header
│   └── ui/                    # Component primitives & design tokens
├── lib/                       # Core business logic & compiler
│   ├── engine/                 # Deterministic math compiler & solver
│   │   ├── lexer.ts            # Mathematical tokenization
│   │   ├── parser.ts           # AST construction & precedence
│   │   ├── solver.ts           # Rewrite rules & step generator
│   │   └── types.ts            # AST type definitions
│   ├── db/                     # MongoDB client, schemas & models
│   └── history.ts              # IndexedDB local cache & server sync
└── public/                    # Static assets
```
