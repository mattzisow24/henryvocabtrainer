import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { LEARNER_NAME } from "@/lib/config";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: `${LEARNER_NAME}'s SAT Vocab`,
  description: "SAT Words in Context training",
  appleWebApp: { capable: true, title: `${LEARNER_NAME}'s SAT Vocab`, statusBarStyle: "default" },
};

// viewportFit lets the tab bar sit above the home indicator; interactiveWidget
// makes browsers that support it shrink the page when the keyboard opens.
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f1f3f8", viewportFit: "cover", interactiveWidget: "resizes-content" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
