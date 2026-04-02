"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import RightSidebar from "@/components/layout/RightSidebar";
import MobileNav from "@/components/layout/MobileNav";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, BellOff, X } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: React.ReactNode;
}

function MainLayoutContent({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [showNotificationNotice, setShowNotificationNotice] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "denied") {
        setShowNotificationNotice(true);
      }
    }
  }, [user]);

  const isHomePage = pathname === "/";
  const isGrokPage = pathname !== null && pathname.toLowerCase().includes("grok");
  const isMessagePage = (pathname !== null && pathname.startsWith("/messages")) || isGrokPage;
  const isImmersiveVideo = pathname !== null && pathname.includes("/videos") && searchParams?.get('url');
  const isMessageConversation = (pathname !== null && pathname.startsWith("/messages/") && pathname !== "/messages") || isGrokPage;

  return (
    <div className="max-w-[1300px] mx-auto flex w-full justify-center sm:justify-start bg-black min-h-screen">
      {!isImmersiveVideo && <Sidebar />}
      
      <main 
        className={cn(
          "flex-grow border-x border-gray-800 w-full relative",
          !isImmersiveVideo && "ml-0 sm:ml-20 xl:ml-64",
          isImmersiveVideo ? "max-w-none border-none" : "max-w-2xl pb-14 sm:pb-0"
        )}
      >
        <Suspense fallback={
          <div className="flex items-center justify-center h-screen bg-black">
            <div className="w-8 h-8 border-2 border-twitter-blue border-t-transparent animate-spin rounded-full" />
          </div>
        }>
          {children}
        </Suspense>
      </main>

      {!isMessagePage && !isImmersiveVideo && (
        <div className="hidden lg:block">
          <RightSidebar />
        </div>
      )}
      
      {!isImmersiveVideo && !isMessageConversation && <MobileNav />}
      
      {showNotificationNotice && user && !isMessageConversation && (
        <div className="sm:hidden fixed top-0 left-0 right-0 z-[100] bg-zinc-900 border-b border-gray-800 p-3 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="bg-red-500/10 p-2 rounded-full">
              <BellOff className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-grow flex flex-col gap-1">
              <p className="text-white font-bold text-[14px]">Notifications are blocked</p>
              <p className="text-gray-400 text-xs leading-tight pr-4">
                Allow notifications to receive messages instantly.
              </p>
            </div>
            <button onClick={() => setShowNotificationNotice(false)} className="p-1 hover:bg-white/10 rounded-full transition">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      )}

      {user && !isMessagePage && !isImmersiveVideo && pathname !== "/grok" && (
          <button 
              onClick={() => router.push('/compose/post')}
              className="sm:hidden fixed bottom-20 right-4 w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-lg z-40 transition hover:bg-gray-200"
          >
            <Plus className="w-6 h-6 text-black" />
          </button>
      )}
    </div>
  );
}

export default function MainLayout(props: MainLayoutProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <MainLayoutContent {...props} />
    </Suspense>
  );
}
