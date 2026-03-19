"use client";

import { ArrowLeft, Bell, Settings2, Mail, Info, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function NotificationSettings() {
    return (
        <div className="flex flex-col min-h-screen border-r border-gray-800">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800 px-4 py-1 flex items-center gap-6 h-[53px]">
                <Link href="/settings" className="p-1.5 hover:bg-white/10 rounded-full transition -ml-1">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-xl font-bold">Notifications</h1>
            </div>

            <div className="p-4 border-b border-gray-800">
                <p className="text-[13px] text-gray-500 leading-tight">
                    Select the kinds of notifications you get about your activities, interests, and recommendations.
                </p>
            </div>

            <div className="flex flex-col">
                <div className="p-4 hover:bg-white/5 transition flex items-center gap-4 cursor-pointer border-b border-gray-800">
                    <Settings2 className="w-5 h-5 text-gray-500" />
                    <div className="flex flex-col flex-1">
                        <span className="text-white text-[15px] font-medium">Filters</span>
                        <span className="text-gray-500 text-[13px]">Choose the notifications you'd like to see — and those you don't.</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                </div>
                <div className="p-4 hover:bg-white/5 transition flex items-center gap-4 cursor-pointer border-b border-gray-800">
                    <Bell className="w-5 h-5 text-gray-500" />
                    <div className="flex flex-col flex-1">
                        <span className="text-white text-[15px] font-medium">Preferences</span>
                        <span className="text-gray-500 text-[13px]">Select your preferences by notification type.</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                </div>
            </div>

            <div className="mt-12 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-twitter-blue/10 flex items-center justify-center mb-4">
                    <Bell className="w-8 h-8 text-twitter-blue" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Control what you see</h2>
                <p className="text-gray-500 text-[15px] max-w-sm">
                    Keep your notifications organized and relevant to you.
                </p>
            </div>
        </div>
    );
}
