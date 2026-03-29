"use client";

import { useAuth } from "@/contexts/AuthContext";
import ConversationList from "@/components/messages/ConversationList";
import ChatBox from "@/components/messages/ChatBox";
import { use } from "react";

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
    const { user } = useAuth();
    const { id } = use(params);

    return (
        <div className="flex w-full h-[100dvh] overflow-hidden">
            <div className="hidden sm:block border-r border-gray-800">
                <ConversationList activeId={id} />
            </div>
            <ChatBox conversationId={id} />
        </div>
    );
}
