"use client";

import { useAuth } from "@/contexts/AuthContext";
import ConversationList from "@/components/messages/ConversationList";
import { Mail } from "lucide-react";

export default function Messages() {
    const { user } = useAuth();

    return (
        <div className="flex w-full min-h-screen">
            {/* Left: Conversation List */}
            <div className="w-full sm:w-[360px] xl:w-[400px] flex-shrink-0 border-r border-gray-800 h-screen overflow-hidden flex flex-col">
                <ConversationList />
            </div>

            {/* Right: Empty State */}
            <div className="hidden sm:flex flex-col flex-grow items-center justify-center p-8 text-center h-screen">
                <div className="flex flex-col items-center max-w-xs gap-4">
                    <div className="w-16 h-16 rounded-full bg-[var(--color-twitter-blue)]/10 flex items-center justify-center mb-2">
                        <Mail className="w-8 h-8 text-[var(--color-twitter-blue)]" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-white">Select a message</h2>
                    <p className="text-gray-500 text-[15px] leading-relaxed">
                        Choose from your existing conversations, start a new one, or just keep swimming.
                    </p>
                    <button className="mt-2 px-5 py-2.5 bg-[var(--color-twitter-blue)] hover:bg-[#1a8cd8] text-white font-bold rounded-full transition text-[15px]">
                        New Message
                    </button>
                </div>
            </div>
        </div>
    );
}
