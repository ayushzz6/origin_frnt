import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Syne, Instrument_Serif } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-display",
  weight: "400",
  display: "swap",
});
import AgentationLoader from "@/components/layout/AgentationLoader";
import "katex/dist/katex.min.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import ClientShell from "@/components/layout/ClientShell";
import { QuotaProvider } from "@/context/QuotaContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { getCanonicalSiteUrl } from "@/lib/site-url";
import { isFeatureEnabled } from "@/lib/feature-flags";

const siteUrl = getCanonicalSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "ORIGIN AI - Best Preparation Platform for JEE/NEET",
  description: "The most advanced AI-powered learning platform for JEE, NEET, and Foundation. Personalized guidance, infinite practice, and 24/7 AI mentoring.",
  openGraph: {
    title: "ORIGIN AI - Best Preparation Platform for JEE/NEET",
    description: "Personalized guidance, infinite practice, and 24/7 AI mentoring for JEE and NEET scholars.",
    url: siteUrl,
    siteName: "ORIGIN AI",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "ORIGIN AI - Best Prep Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ORIGIN AI - Best Preparation Platform for JEE/NEET",
    description: "The most advanced AI-powered learning platform for JEE, NEET, and Foundation.",
    images: ["/og-image.jpg"],
  },
};

/**
 * Keep the root layout free of request-specific cookie reads.
 * AuthProvider hydrates the user on the client via /api/users/me so the root
 * shell never reads request cookies during production rendering.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Env-only read (no request cookies) — safe in the root layout. Gates the
  // student "Connect" nav entry so it mirrors the server `teacherConnect` gate.
  const connectEnabled = isFeatureEnabled("teacherConnect");
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${syne.variable} ${instrumentSerif.variable}`}>
      <head />
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <AuthProvider initialUser={null}>
              <NotificationProvider>
                <QuotaProvider>
                  <ClientShell connectEnabled={connectEnabled}>{children}</ClientShell>
                </QuotaProvider>
              </NotificationProvider>
            </AuthProvider>
          </Suspense>
          <Toaster position="top-right" richColors />
          {process.env.NODE_ENV === "development" && <AgentationLoader />}
        </ThemeProvider>
      </body>
    </html>
  );
}
