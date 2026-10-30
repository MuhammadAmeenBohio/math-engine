import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In • Math Engine | Access Academic Mathematical Workspace',
  description:
    'Sign in to Math Engine using Google or email OTP, or continue as a guest. Gemini handles optional OCR; solving and saved history stay deterministic and on-device.',
  keywords: [
    'math solver sign in',
    'math engine login',
    'math problem solver account',
    'private math workspace',
    'deterministic CAS solver',
  ],
  alternates: {
    canonical: '/auth',
  },
  openGraph: {
    title: 'Sign In • Math Engine Mathematical Workspace',
    description:
      'Access your private, deterministic math notebook. Solve arithmetic, linear, and quadratic problems with a deterministic client-side engine.',
    url: '/auth',
    siteName: 'Math Engine',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sign In • Math Engine Mathematical Workspace',
    description: 'Instant Google or email OTP login for deterministic math solving.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Sign In • Math Engine Academic Workspace',
    url: '/auth',
    description:
      'Sign in to Math Engine using Google or email OTP to save step-by-step derivations, or continue locally as a guest.',
    isPartOf: {
      '@type': 'WebSite',
      name: 'Math Engine',
      url: '/',
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: '/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Sign In',
          item: '/auth',
        },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
