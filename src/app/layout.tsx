import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Syne, Instrument_Serif } from "next/font/google";
import "./globals.css";
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
import { getServerFrontendUser } from "@/lib/auth-server";

const inter = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const syne = Syne({ subsets: ["latin"], variable: "--font-heading", display: "swap" });
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const connectEnabled = isFeatureEnabled("teacherConnect");
  const premiumEnabled = isFeatureEnabled("premiumSubscriptions");
  const socialEnabled = isFeatureEnabled("studentSocial");
  // Seed the client AuthProvider with the server-resolved user so the client
  // skips the /api/users/me waterfall on every page load.
  const initialUser = await getServerFrontendUser().catch(() => null);
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${syne.variable} ${instrumentSerif.variable}`}>
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          disableTransitionOnChange
        >
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <AuthProvider initialUser={initialUser}>
              <NotificationProvider>
                <QuotaProvider>
                  <ClientShell connectEnabled={connectEnabled} premiumEnabled={premiumEnabled} socialEnabled={socialEnabled}>{children}</ClientShell>
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
