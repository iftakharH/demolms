import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ToastProvider } from '@/components/ui/toast';
import { APP_URL } from '@/lib/env';

/**
 * Instrument Sans, self-hosted (src/fonts/InstrumentSans-Variable.woff2) so the
 * app never needs the network. One family for the whole product - see DESIGN.md.
 */
const instrument = localFont({
  src: '../fonts/InstrumentSans-Variable.woff2',
  display: 'swap',
  weight: '400 700',
  variable: '--font-instrument',
});

/**
 * Applied before the body paints, so a remembered dark theme never flashes
 * white. The toggle in components/ui/theme-toggle.tsx writes the same key.
 */
const THEME_SCRIPT = `(function(){try{var c=localStorage.getItem('demolms-theme')||'system';var d=c==='dark'||(c==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d){r.setAttribute('data-theme','dark')}r.dataset.themeChoice=c}catch(e){}})();`;

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
    <html
      lang="en-GB"
      data-scroll-behavior="smooth"
      className={`${instrument.variable} h-full`}
      suppressHydrationWarning
    >
      {/* In <head>, before any body content is parsed, so a remembered dark theme
          never flashes light. Kept out of the body: React warns about script tags
          rendered as part of a component tree. */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
