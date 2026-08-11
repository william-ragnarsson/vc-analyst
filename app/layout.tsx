import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import LayoutShell from "@/components/layout/LayoutShell";
import AnalysisProvider from "@/components/features/analyze/AnalysisProvider";
import AuthProvider from "@/components/features/auth/AuthProvider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vcanalyst.williamragnarsson.dev";
const title = "AI VC Analyst - 800+ decks, distilled";
const description =
  "Top 6 of 250. 800 pitch decks reviewed. Everything I learned, distilled into an AI.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "VC Analyst",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`}
    >
      <body className="relative min-h-screen overflow-x-hidden">
        {/* Auth wraps analysis: starting a run needs a user, so AnalysisProvider
            consumes useAuth(). This layout stays a static server component —
            the session is read client-side, which keeps the landing page
            statically rendered. Nothing here is gated, so there's no need to
            know who the user is before the first paint. */}
        <AuthProvider>
          <AnalysisProvider>
            <LayoutShell>{children}</LayoutShell>
          </AnalysisProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
