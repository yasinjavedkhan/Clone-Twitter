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

import IncomingCallOverlay from "@/components/messages/IncomingCallOverlay";
import { CallProvider, useCall } from "@/contexts/CallContext";
import AgoraCall from "@/components/messages/AgoraCall";

function GlobalCallOverlay() {
  const { isCalling, roomName, callType, activeOtherUser, endCall } = useCall();

  if (!isCalling || !roomName) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black">
      <AgoraCall 
        roomName={roomName}
        callType={callType}
        otherUser={activeOtherUser}
        onEndCall={endCall}
      />
    </div>
  );
}

export const metadata: Metadata = {
  title: "Twitter Clone",
  description: "A production-ready generic social media platform",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
    interactiveWidget: "resizes-content",
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
        <link rel="manifest" href="/manifest.json" />
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
            <IncomingCallOverlay />
            <GlobalCallOverlay />
          </CallProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
