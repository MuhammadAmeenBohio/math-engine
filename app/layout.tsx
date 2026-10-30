import type { Metadata, Viewport } from 'next';
import { Manrope, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const viewport: Viewport = {
  themeColor: '#F3F7F5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'Math Engine • Web CAS | Deterministic Math Solver',
    template: '%s | Math Engine',
  },
  description:
    'Photo, camera, handwriting, and typed math solver. Gemini assists with OCR, then a deterministic client-side CAS solves and verifies each step. Saved history stays on your device.',
  keywords: [
    'math solver',
    'photo math solver',
    'handwriting math solver',
    'camera math calculator',
    'step by step math solver',
    'quadratic equation solver',
    'deterministic CAS',
    'client side math solver',
    'verified math solver',
    'open source math compiler',
  ],
  authors: [{ name: 'Math Engine Team' }],
  creator: 'Math Engine',
  publisher: 'Math Engine',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: APP_URL,
    title: 'Math Engine • Deterministic Photo & Handwriting Math Solver',
    description:
      'Write, snap, upload, or type math problems. Gemini OCR reads the input; a deterministic client-side CAS solves and verifies the result.',
    siteName: 'Math Engine',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Math Engine • Web CAS | Deterministic Math Solver',
    description:
      'Client-side photo, camera & handwriting math solver with verified step-by-step derivations.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${manrope.variable} ${plexMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-canvas text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
