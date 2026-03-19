"use client";

import { ArrowLeft, HelpCircle, FileText, Scale, Info, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function ResourcesSettings() {
    return (
        <div className="flex flex-col min-h-screen border-r border-gray-800">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800 px-4 py-1 flex items-center gap-6 h-[53px]">
                <Link href="/settings" className="p-1.5 hover:bg-white/10 rounded-full transition -ml-1">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-xl font-bold">Resources</h1>
            </div>

            <div className="flex flex-col">
                <div className="p-4 hover:bg-white/5 transition flex items-center gap-4 cursor-pointer border-b border-gray-800">
                    <HelpCircle className="w-5 h-5 text-gray-500" />
                    <span className="text-white text-[15px] font-medium flex-1">Help Center</span>
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                </div>
                <div className="p-4 hover:bg-white/5 transition flex items-center gap-4 cursor-pointer border-b border-gray-800">
                    <FileText className="w-5 h-5 text-gray-500" />
                    <span className="text-white text-[15px] font-medium flex-1">Terms of Service</span>
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                </div>
                <div className="p-4 hover:bg-white/5 transition flex items-center gap-4 cursor-pointer border-b border-gray-800">
                    <Scale className="w-5 h-5 text-gray-500" />
                    <span className="text-white text-[15px] font-medium flex-1">Privacy Policy</span>
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                </div>
                <div className="p-4 hover:bg-white/5 transition flex items-center gap-4 cursor-pointer border-b border-gray-800">
                    <Info className="w-5 h-5 text-gray-500" />
                    <span className="text-white text-[15px] font-medium flex-1">About the App</span>
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                </div>
            </div>

            <div className="p-8 text-center mt-auto">
                <p className="text-gray-500 text-[13px]">© 2025 X Corp.</p>
            </div>
        </div>
    );
}
