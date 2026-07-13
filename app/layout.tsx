import type { Metadata } from 'next';
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import './tactile.css';

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
    default: 'Polynize | AI Agent Teams for Your Business',
    template: '%s · Polynize',
  },
  description:
    'Polynize designs and deploys AI agent teams for small and mid-sized businesses. Map the bottleneck choking your business and we build the team to solve it.',
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
    title: 'Polynize | AI Agent Teams for Your Business',
    description:
      'Map the bottleneck choking your business. We design and deploy the AI agent team to solve it.',
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
    title: 'Polynize | AI Agent Teams for Your Business',
    description:
      'Map the bottleneck choking your business. We design and deploy the AI agent team to solve it.',
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
      </body>
    </html>
  );
}
