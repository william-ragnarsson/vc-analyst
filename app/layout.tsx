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
  title: "AI VC Analyst - 800+ decks, distilled",
  description: "Top 6 of 250. 800 pitch decks reviewed. Everything I learned, distilled into an AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`}
    >
      <body className="relative min-h-screen overflow-x-hidden">
        {/* Background orbs */}
        <div className="orb orb-1" style={{ width: 420, height: 420, top: -80, right: -60, background: "radial-gradient(circle at 30% 30%, #b9f0c9, transparent 70%)" }} />
        <div className="orb orb-2" style={{ width: 480, height: 480, top: 200, right: -120, background: "radial-gradient(circle at 70% 30%, #ece0b8, transparent 70%)" }} />
        <div className="orb orb-1" style={{ width: 360, height: 360, bottom: -120, left: "30%", background: "radial-gradient(circle at 50% 50%, #d9eafc, transparent 70%)" }} />

        <AnalysisProvider>
          <LayoutShell>{children}</LayoutShell>
        </AnalysisProvider>
      </body>
    </html>
  );
}
