"use client";

import { useState, useEffect } from "react";
import { X, RefreshCw, Smartphone, Info, Share } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CURRENT_VERSION = "4.0.0"; // Force a new update check

export default function UpdateBanner() {
    const [isVisible, setIsVisible] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        // Only run on client
        if (typeof window === "undefined") return;

        // Detect mobile
        setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));

        // Check version
        const savedVersion = localStorage.getItem("twitter_clone_version");
        if (savedVersion !== CURRENT_VERSION) {
            // Show banner if version mismatch
            const timer = setTimeout(() => setIsVisible(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleUpdate = async () => {
        setIsUpdating(true);
        localStorage.setItem("twitter_clone_version", CURRENT_VERSION);
        
        // Try to clear service workers if they exist
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
            }
        }

        // Small delay for visual feedback
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    };

    const handleDismiss = () => {
        localStorage.setItem("twitter_clone_version", CURRENT_VERSION);
        setIsVisible(false);
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    className="fixed top-4 left-4 right-4 z-[9999] flex justify-center pointer-events-none"
                >
                    <div className="w-full max-w-md bg-[#1d9bf0] text-white p-4 rounded-2xl shadow-2xl flex flex-col gap-3 pointer-events-auto border border-white/20">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 p-2 rounded-full">
                                    <RefreshCw className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-[15px]">New Update Available! ✨</h3>
                                    <p className="text-[13px] opacity-90 leading-tight mt-0.5">
                                        We've updated the design and added the new Twitter logo.
                                    </p>
                                </div>
                            </div>
                            <button onClick={handleDismiss} className="p-1 hover:bg-white/10 rounded-full transition">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {isMobile && (
                            <div className="bg-black/10 rounded-xl p-3 flex items-start gap-3">
                                <Smartphone className="w-4 h-4 mt-0.5 shrink-0" />
                                <p className="text-[12px] leading-snug">
                                    <span className="font-bold uppercase block mb-1">To update your home screen icon:</span>
                                    1. Delete your old icon <br />
                                    2. Tap <Share className="w-3 h-3 inline mx-0.5" /> or <Info className="w-3 h-3 inline mx-0.5" /> and <b>"Add to Home Screen"</b> again.
                                </p>
                            </div>
                        )}

                        <div className="flex gap-2 mt-1">
                            <button 
                                onClick={handleUpdate}
                                disabled={isUpdating}
                                className="flex-grow bg-white text-[#1d9bf0] font-bold py-2 rounded-full text-sm hover:bg-gray-100 transition active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isUpdating && <RefreshCw className="w-4 h-4 animate-spin" />}
                                {isUpdating ? "Updating..." : "Refresh Now"}
                            </button>
                            <button 
                                onClick={handleDismiss}
                                className="px-4 py-2 text-sm font-medium hover:bg-white/10 rounded-full transition"
                            >
                                Later
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
