import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { HelpPanel } from '@/components/help-panel';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { site } from '@/lib/site';
import { aiConfig } from '@/server/ai/config';
import { getSession } from '@/server/auth/session';
import './globals.css';

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
});

// Read per request so the public address comes from the environment (APP_URL).
export async function generateMetadata(): Promise<Metadata> {
  const base = process.env.APP_URL ?? 'http://localhost:3000';
  return {
    metadataBase: new URL(base),
    title: {
      default: `${site.name} - ${site.tagline}`,
      template: `%s | ${site.name}`,
    },
    description: site.description,
    applicationName: site.name,
    openGraph: {
      type: 'website',
      siteName: site.name,
      title: site.name,
      description: site.description,
      images: [{ url: '/images/hero-devotion.jpg', alt: 'Devotees gathered in kirtan' }],
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const session = await getSession();
  return (
    <html lang="en" className={`${poppins.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only z-50 bg-black px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <HelpPanel
          signedIn={Boolean(session)}
          name={session?.name}
          assistant={aiConfig().enabled}
        />
      </body>
    </html>
  );
}
