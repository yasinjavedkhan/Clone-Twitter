import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { Suspense } from "react";
import Sidebar from "@/components/layout/Sidebar";
import RightSidebar from "@/components/layout/RightSidebar";
import MobileNav from "@/components/layout/MobileNav";
import MainLayout from "@/components/layout/MainLayout";

// Force dynamic rendering for all pages - prevents SSR errors with browser globals
export const dynamic = 'force-dynamic';

const outfit = Outfit({ subsets: ["latin"] });

import IncomingCallOverlay from "@/components/messages/IncomingCallOverlay";

export const metadata: Metadata = {
  title: "Twitter Clone",
  description: "A production-ready generic social media platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${outfit.className} bg-black text-white min-h-screen`} suppressHydrationWarning>
        <AuthProvider>
          <MainLayout>
            {children}
          </MainLayout>
          <Suspense fallback={null}>
            <IncomingCallOverlay />
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
