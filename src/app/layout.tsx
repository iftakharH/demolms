import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ToastProvider } from '@/components/ui/toast';
import { APP_URL } from '@/lib/env';

/**
 * Inter, self-hosted (src/fonts/Inter-Variable.woff2) so the app never needs
 * the network. Fetched once by scripts/fetch-fonts.mjs.
 */
const inter = localFont({
  src: '../fonts/Inter-Variable.woff2',
  display: 'swap',
  weight: '100 900',
  variable: '--font-inter',
  fallback: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
});

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'demolms - Learn something useful this month',
    template: '%s · demolms',
  },
  description:
    'A local demo learning platform: practical courses in software, data, design and career ' +
    'skills, with quizzes, assignments and verifiable certificates.',
  applicationName: 'demolms',
  openGraph: {
    type: 'website',
    siteName: 'demolms',
    locale: 'en_GB',
    url: APP_URL,
    title: 'demolms - Learn something useful this month',
    description:
      'Practical courses in software, data, design and career skills, with quizzes, ' +
      'assignments and verifiable certificates.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'demolms - Learn something useful this month',
    description: 'Practical, verifiable online courses. Demo build running locally.',
  },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en-GB" data-scroll-behavior="smooth" className={`${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
