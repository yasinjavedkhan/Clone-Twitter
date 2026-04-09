import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
import RightSidebar from "@/components/layout/RightSidebar";
import MobileNav from "@/components/layout/MobileNav";
import MainLayout from "@/components/layout/MainLayout";

// Force dynamic rendering for all pages - prevents SSR errors with browser globals
export const dynamic = 'force-dynamic';

const outfit = Outfit({ subsets: ["latin"] });

import CallOverlayWrapper from "@/components/messages/CallOverlayWrapper";
import { CallProvider } from "@/contexts/CallContext";

export const metadata: Metadata = {
  title: "Dark Twitter",
  description: "A production-ready generic social media platform",
  icons: {
    icon: "/v5-twitter-icon.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json?v=2" />
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </head>
      <body className={`${outfit.className} bg-black text-white min-h-screen`}>
        <AuthProvider>
          <CallProvider>
            <MainLayout>
              {children}
            </MainLayout>
            <CallOverlayWrapper />
          </CallProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
