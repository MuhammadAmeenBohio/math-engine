'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    const digest =
      error instanceof Error
        ? (error as Error & { digest?: string }).digest
        : undefined;
    console.error(`[math-engine] route error${digest ? ` (digest: ${digest})` : ''}`);
  }, [error]);

  return (
    <main className="bg-canvas flex min-h-dvh items-center justify-center px-4 py-12 text-ink">
      <div className="border-hairline w-full max-w-md rounded-2xl border bg-surface p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold tracking-[0.18em] text-amber uppercase">
          Unexpected error
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          Something went wrong
        </h1>
        <p className="text-ink-muted mt-3 text-sm leading-6">
          We could not finish that request. Nothing was lost. Try again, or head
          back home and start fresh.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => retry()}
            className="bg-ink inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-medium text-surface transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
          >
            Try again
          </button>
          <Link
            href="/"
            className="border-hairline inline-flex min-h-11 items-center justify-center rounded-xl border bg-surface-container-low px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
