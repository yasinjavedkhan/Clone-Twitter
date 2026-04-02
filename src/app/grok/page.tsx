"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/ui/Avatar";

interface Message {
  role: "user" | "model";
  content: string;
}

const SUGGESTED_PROMPTS = [
  "What's happening in the tech world today?",
  "Write a funny tweet about coding late at night.",
  "Explain quantum computing like I'm five.",
  "Summarize the latest trends on Twitter."
];

export default function GrokPage() {
  const { user, userData } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text: string = input) => {
    if ((typeof text === 'string' && !text.trim()) || isLoading) return;
    
    const messageText = typeof text === 'string' ? text : input;
    if (!messageText.trim()) return;

    const newMessage: Message = { role: "user", content: messageText };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: messageText,
          history: messages,
          userName: userData?.displayName || userData?.username || "User",
        }),
      });

      const data = await response.json();

      if (data.error) {
        // Handle specific quota/rate limit errors with a Grok-style message
        if (data.error.toLowerCase().includes("quota") || data.error.toLowerCase().includes("429") || data.error.toLowerCase().includes("limit")) {
          setMessages((prev) => [...prev, { 
            role: "model", 
            content: "Whoa there, space traveler! 🚀 I'm processing too many requests right now. Give me about 15-30 seconds to catch my breath and then ask me again!" 
          }]);
          setIsLoading(false);
          return;
        }
        throw new Error(data.error);
      }

      setMessages((prev) => [...prev, { role: "model", content: data.text }]);
    } catch (error: any) {
      console.error("Grok Error:", error);
      const isQuotaError = error.message?.toLowerCase().includes("quota") || error.message?.toLowerCase().includes("429");
      
      setMessages((prev) => [
        ...prev,
        { 
          role: "model", 
          content: isQuotaError 
            ? "I'm a bit overwhelmed with requests right now! 😅 Please wait a few seconds and try again." 
            : `Error: ${error.message || "Something went wrong with the AI connection."}` 
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)] sm:h-screen bg-black text-white border-r border-gray-800 overflow-hidden">
        {/* Force hide mobile FAB on this page */}
        <style jsx global>{`
          .sm\\:hidden.fixed.bottom-20.right-4 {
            display: none !important;
          }
        `}</style>
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-3">
          {user && (
            <button 
                onClick={() => window.dispatchEvent(new CustomEvent("toggleMobileDrawer"))}
                className="sm:hidden p-0.5 rounded-full active:bg-white/10 transition cursor-pointer shrink-0"
            >
                <Avatar
                    src={userData?.profileImage}
                    fallbackText={userData?.displayName || userData?.username}
                    size="md"
                />
            </button>
          )}
          <div className="bg-gradient-to-br from-purple-500 to-twitter-blue p-2 rounded-xl shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-none">Grok</h1>
            <p className="text-[11px] text-gray-500 mt-1 uppercase tracking-wider font-semibold leading-none">Beta</p>
          </div>
        </div>
        <button 
          onClick={clearChat}
          className="p-2 hover:bg-white/10 rounded-full transition text-gray-500 hover:text-red-500"
          title="Clear Chat"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Chat Content */}
      <div className="flex-grow overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="relative">
                <div className="absolute inset-0 bg-twitter-blue blur-3xl opacity-20 rounded-full animate-pulse"></div>
                <Sparkles className="w-16 h-16 text-twitter-blue relative z-10" />
            </div>
            <div>
                <h2 className="text-3xl font-black mb-2 italic tracking-tight">Grok is ready.</h2>
                <p className="text-gray-500">Ask me anything about what's happening or just have a chat.</p>
            </div>
            
            <div className="grid grid-cols-1 gap-2 w-full">
                {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                        key={prompt}
                        onClick={() => handleSend(prompt)}
                        className="text-left p-4 rounded-2xl border border-gray-800 hover:border-twitter-blue/50 hover:bg-twitter-blue/5 transition group"
                    >
                        <p className="text-[14px] group-hover:text-twitter-blue transition">{prompt}</p>
                    </button>
                ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in duration-300`}
            >
              <div 
                className={`max-w-[85%] p-4 rounded-3xl ${
                  msg.role === "user" 
                    ? "bg-twitter-blue text-white rounded-tr-none shadow-[0_0_20px_rgba(29,155,240,0.15)]" 
                    : "bg-[#16181c] text-gray-100 rounded-tl-none border border-gray-800"
                }`}
              >
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))
        )}
        {isLoading && (
            <div className="flex justify-start animate-pulse">
                <div className="bg-[#16181c] p-4 rounded-3xl rounded-tl-none border border-gray-800">
                    <div className="flex gap-1.5 px-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:0.2s]"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-800 bg-black shrink-0">
        <div className="max-w-4xl mx-auto relative group">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask Grok..."
            className="w-full bg-[#202327] rounded-3xl py-4 pl-6 pr-14 resize-none outline-none focus:ring-2 focus:ring-twitter-blue/30 border border-transparent focus:border-twitter-blue/50 transition min-h-[56px] max-h-32 text-[15px] shadow-inner"
            rows={1}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className={`absolute right-2 bottom-2 p-2.5 rounded-full transition-all duration-300 ${
              input.trim() && !isLoading 
                ? "bg-white text-black scale-100 shadow-lg hover:bg-gray-200" 
                : "bg-gray-800 text-gray-500 scale-90 opacity-50 cursor-not-allowed"
            }`}
          >
            <Send className="w-5 h-5 fill-current" />
          </button>
        </div>
        <p className="text-[10px] text-gray-600 text-center mt-3 tracking-wide">
          Grok is an AI and sometimes provides incorrect information.
        </p>
      </div>
    </div>
  );
}
