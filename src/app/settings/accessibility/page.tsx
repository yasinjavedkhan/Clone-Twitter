"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Monitor, Moon, Sun, Type, Palette, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function AccessibilitySettings() {
    const { userData } = useAuth();
    const [theme, setTheme] = useState("dark");

    // Sample theme change logic (requires global state or CSS variables in real app)
    const toggleTheme = (newTheme: string) => {
        setTheme(newTheme);
        // In a real app, you'd apply this to document.documentElement.classList
    };

    return (
        <div className="flex flex-col min-h-screen border-r border-gray-800">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800 px-4 py-1 flex items-center gap-6 h-[53px]">
                <Link href="/settings" className="p-1.5 hover:bg-white/10 rounded-full transition -ml-1">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-xl font-bold">Display</h1>
            </div>

            {/* Preview Box */}
            <div className="p-8 border-b border-gray-800 bg-[#16181c] flex flex-col items-center">
                <div className="bg-black border border-gray-800 rounded-2xl p-4 max-w-sm w-full">
                    <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-full bg-twitter-blue flex items-center justify-center shrink-0">
                            <span className="text-white font-bold">X</span>
                        </div>
                        <div className="flex flex-col">
                            <div className="flex gap-1 items-center">
                                <span className="font-bold text-white">X Support</span>
                                <span className="text-gray-500 text-[14px]">@XSupport</span>
                            </div>
                            <p className="text-white text-[15px] mt-1">
                                At the heart of X is the spirit of innovation and free speech. Customize your experience here.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Display Sections */}
            <div className="flex flex-col">
                <div className="px-4 py-3 bg-[#16181c]/50">
                    <h2 className="font-bold text-white text-[15px]">Colors</h2>
                </div>
                <div className="px-4 py-6 flex justify-around border-b border-gray-800">
                    {["#1d9bf0", "#ffd400", "#f91880", "#7856ff", "#ff7a00", "#00ba7c"].map((color) => (
                        <button
                            key={color}
                            className="w-10 h-10 rounded-full border-2 border-transparent hover:border-white transition"
                            style={{ backgroundColor: color }}
                        />
                    ))}
                </div>

                <div className="px-4 py-3 bg-[#16181c]/50">
                    <h2 className="font-bold text-white text-[15px]">Background</h2>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4 border-b border-gray-800">
                    <button
                        onClick={() => toggleTheme("light")}
                        className={`p-4 rounded-lg flex items-center justify-center gap-2 border-2 transition ${theme === "light" ? "border-twitter-blue bg-white text-black" : "border-gray-800 bg-white text-black hover:border-gray-500"}`}
                    >
                        <Sun className="w-5 h-5" />
                        <span className="font-bold">Default</span>
                    </button>
                    <button
                        onClick={() => toggleTheme("dark")}
                        className={`p-4 rounded-lg flex items-center justify-center gap-2 border-2 transition ${theme === "dark" ? "border-twitter-blue bg-black text-white" : "border-gray-800 bg-black text-white hover:border-gray-500"}`}
                    >
                        <Moon className="w-5 h-5" />
                        <span className="font-bold">Lights out</span>
                    </button>
                </div>

                {/* Additional Accessibility Info */}
                <div className="p-4 hover:bg-white/5 transition flex items-center justify-between cursor-pointer border-b border-gray-800">
                    <div className="flex items-center gap-3">
                        <Type className="w-5 h-5 text-gray-500" />
                        <span className="text-[15px]">Font size</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-twitter-blue text-[14px] font-medium">Default</span>
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                    </div>
                </div>
            </div>
        </div>
    );
}
