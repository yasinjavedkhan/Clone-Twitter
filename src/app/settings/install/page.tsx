"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Smartphone, Share, Copy, Check, Info } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InstallApp() {
    const { userData } = useAuth();
    const router = useRouter();
    const [copied, setCopied] = useState(false);

    const appUrl = typeof window !== "undefined" ? window.location.origin : "https://clone-twitter-fmya.vercel.app";

    const copyToClipboard = () => {
        navigator.clipboard.writeText(appUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col min-h-screen bg-black border-r border-gray-800">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800 p-4 flex items-center gap-6">
                <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-full transition">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex flex-col">
                    <h1 className="text-xl font-bold">Install App</h1>
                    <p className="text-[13px] text-gray-400">Never lose access again</p>
                </div>
            </div>

            <div className="p-6 flex flex-col gap-8 max-w-lg mx-auto w-full">
                {/* Intro */}
                <div className="text-center">
                    <div className="w-20 h-20 bg-[#1d9bf0]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Smartphone className="w-10 h-10 text-[#1d9bf0]" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Add to Home Screen</h2>
                    <p className="text-gray-500">
                        Get the full app experience on your phone. It's safe, fast, and stays updated.
                    </p>
                </div>

                {/* Instructions */}
                <div className="space-y-4">
                    <div className="bg-[#15181c] border border-gray-800 rounded-3xl p-6">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                             For iPhone Users
                        </h3>
                        <ol className="space-y-4 text-gray-300">
                            <li className="flex gap-4">
                                <span className="bg-[#1d9bf0] text-white w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-sm">1</span>
                                <div>Tap the <Share className="w-4 h-4 inline mx-1 mb-1 text-[#1d9bf0]" /> <b>Share</b> button in Safari.</div>
                            </li>
                            <li className="flex gap-4">
                                <span className="bg-[#1d9bf0] text-white w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-sm">2</span>
                                <div>Scroll down and tap <b>"Add to Home Screen"</b>.</div>
                            </li>
                            <li className="flex gap-4">
                                <span className="bg-[#1d9bf0] text-white w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-sm">3</span>
                                <div>Tap <b>Add</b> to confirm.</div>
                            </li>
                        </ol>
                    </div>

                    <div className="bg-[#15181c] border border-gray-800 rounded-3xl p-6">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                             For Android Users
                        </h3>
                        <ol className="space-y-4 text-gray-300">
                            <li className="flex gap-4">
                                <span className="bg-[#1d9bf0] text-white w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-sm">1</span>
                                <div>Tap the <b>three dots</b> <span className="text-gray-500">⋮</span> in Chrome.</div>
                            </li>
                            <li className="flex gap-4">
                                <span className="bg-[#1d9bf0] text-white w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-sm">2</span>
                                <div>Tap <b>"Install App"</b> or <b>"Add to Home Screen"</b>.</div>
                            </li>
                            <li className="flex gap-4">
                                <span className="bg-[#1d9bf0] text-white w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-sm">3</span>
                                <div>Confirm the installation.</div>
                            </li>
                        </ol>
                    </div>
                </div>

                {/* Backup Link */}
                <div className="bg-[#1d9bf0]/10 border border-[#1d9bf0]/20 rounded-3xl p-6">
                    <h3 className="font-bold text-[#1d9bf0] mb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
                        <Info className="w-4 h-4" /> Save this link
                    </h3>
                    <p className="text-gray-400 text-sm mb-4 leading-tight">
                        If you ever delete the app icon, just open this link in your browser to get it back.
                    </p>
                    <div className="flex items-center gap-2 bg-black/40 p-3 rounded-2xl border border-white/5">
                        <span className="flex-1 text-xs truncate text-gray-500">{appUrl}</span>
                        <button 
                            onClick={copyToClipboard}
                            className="bg-[#1d9bf0] text-white p-2 rounded-xl hover:bg-blue-600 transition grow-0 shrink-0"
                        >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
