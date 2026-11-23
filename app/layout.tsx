import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { LEARNER_NAME } from "@/lib/config";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

/** Applies the saved theme before the page paints, so there is no flash of the wrong one. */
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export const metadata: Metadata = {
  title: `${LEARNER_NAME}'s SAT Vocab`,
  description: "SAT Words in Context training",
  appleWebApp: { capable: true, title: `${LEARNER_NAME}'s SAT Vocab`, statusBarStyle: "default" },
};

// viewportFit lets the tab bar sit above the home indicator; interactiveWidget
// makes browsers that support it shrink the page when the keyboard opens.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1, themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f3f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
  viewportFit: "cover", interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The theme script sets data-theme before first paint, so the server and
    // browser markup differ on that one attribute by design.
    <html lang="en" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
