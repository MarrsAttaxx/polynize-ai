import type { Metadata } from 'next';
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import './tactile.css';
import { Analytics } from '@vercel/analytics/next';
import { AttributionCapture } from './_components/AttributionCapture';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://polynize.ai';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Polynize | Humans, Amplified',
    template: '%s · Polynize',
  },
  description:
    'Polynize builds the human capability that makes an AI economy work. Map the work that is choking your business, see every capability scored against what good looks like, and get the plan that trains your people first and deploys the agents around them.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-192x192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Polynize',
    title: 'Polynize | Humans, Amplified',
    description:
      'Every capability benchmarked against what good looks like. We train your people first, then deploy the agents around them.',
    images: [
      {
        url: '/favicon-192x192.png',
        width: 192,
        height: 192,
        alt: 'Polynize',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Polynize | Humans, Amplified',
    description:
      'Every capability benchmarked against what good looks like. We train your people first, then deploy the agents around them.',
    images: ['/favicon-192x192.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body data-depth="tactile" suppressHydrationWarning>
        {/* Apply the saved theme before paint to avoid a flash, but ONLY on
            console routes: the public site is dark-only, so light mode must not
            leak to it on a hard load. Client nav in/out is handled by the
            console ThemeToggle's mount/unmount. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(location.pathname.indexOf('/console')===0&&localStorage.getItem('pam-theme')==='light')document.body.classList.add('theme-light')}catch(e){}",
          }}
        />
        {children}
        {/* Pageviews. Custom events go through lib/analytics, which forwards to the same
            SDK; without this component mounted those calls are no-ops. */}
        <Analytics />
        {/* Which post sent this visitor (D97). Reads utm labels off the arrival url once; renders nothing. */}
        <AttributionCapture />
      </body>
    </html>
  );
}
