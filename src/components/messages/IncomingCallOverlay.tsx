"use client";

import { useState, useEffect } from "react";
import { onForegroundMessage } from "@/lib/notifications";
import { Phone, PhoneOff, Video, X } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { useRouter } from "next/navigation";

export default function IncomingCallOverlay() {
    const [incomingCall, setIncomingCall] = useState<any>(null);
    const router = useRouter();

    useEffect(() => {
        // Listen for incoming call signals
        const unsubscribe = onForegroundMessage((payload) => {
            if (payload.data?.type === 'call') {
                setIncomingCall(payload.data);
                // Play ringtone
                const audio = new Audio('/ringtone.mp3');
                audio.play().catch(() => console.log("User interaction needed for audio"));
            }
        });

        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, []);

    if (!incomingCall) return null;

    const { callType, conversationId, fromUserName, fromUserAvatar, roomName } = incomingCall;

    const handleAccept = () => {
        setIncomingCall(null);
        // Navigate to the chat where the call will be active
        router.push(`/messages/${conversationId}?call=true&type=${callType}&room=${roomName}`);
    };

    const handleDecline = () => {
        setIncomingCall(null);
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col items-center gap-6 max-w-sm w-full p-8 text-center">
                <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-twitter-blue/20 animate-ping" />
                    <div className="relative w-32 h-32 rounded-full border-4 border-twitter-blue overflow-hidden shadow-2xl shadow-twitter-blue/20">
                        {fromUserAvatar ? (
                            <img src={fromUserAvatar} className="w-full h-full object-cover" alt="Caller" />
                        ) : (
                            <div className="w-full h-full bg-twitter-blue flex items-center justify-center text-4xl font-bold text-white uppercase">
                                {fromUserName?.[0] || "?"}
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="space-y-2">
                    <h2 className="text-3xl font-black text-white">{fromUserName || "Someone"}</h2>
                    <p className="text-twitter-blue font-medium animate-pulse">
                        Incoming {callType === 'video' ? 'Video' : 'Voice'} Call...
                    </p>
                </div>

                <div className="flex items-center justify-center gap-12 w-full mt-12">
                    <button 
                        onClick={handleDecline}
                        className="group flex flex-col items-center gap-3"
                    >
                        <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-white hover:bg-red-700 transition-all hover:scale-110 active:scale-95 shadow-lg shadow-red-900/20">
                            <PhoneOff className="w-8 h-8" />
                        </div>
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Decline</span>
                    </button>

                    <button 
                        onClick={handleAccept}
                        className="group flex flex-col items-center gap-3"
                    >
                        <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white hover:bg-green-600 transition-all hover:scale-110 active:scale-95 shadow-lg shadow-green-900/20">
                            {callType === 'video' ? <Video className="w-8 h-8" /> : <Phone className="w-8 h-8" />}
                        </div>
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Accept</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
