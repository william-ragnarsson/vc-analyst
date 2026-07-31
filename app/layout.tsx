import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import LayoutShell from "@/components/layout/LayoutShell";
import AnalysisProvider from "@/components/features/analyze/AnalysisProvider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vcanalyst.williamragnarsson.dev"),
  title: "AI VC Analyst - 800+ decks, distilled",
  description: "Top 6 of 250. 800 pitch decks reviewed. Everything I learned, distilled into an AI.",
  openGraph: {
    title: "AI VC Analyst - 800+ decks, distilled",
    description: "Top 6 of 250. 800 pitch decks reviewed. Everything I learned, distilled into an AI.",
    url: "https://vcanalyst.williamragnarsson.dev",
    siteName: "AI VC Analyst",
    type: "website",
    // og:image tags are emitted automatically from app/opengraph-image.png
  },
  twitter: {
    // X has no image of its own — it falls back to the Open Graph image above.
    // This just asks X to render it as a large card rather than a small thumbnail.
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`}
    >
      <body className="relative min-h-screen overflow-x-hidden">
        <AnalysisProvider>
          <LayoutShell>{children}</LayoutShell>
        </AnalysisProvider>
      </body>
    </html>
  );
}
