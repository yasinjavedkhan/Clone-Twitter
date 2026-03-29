"use client";

import { useState, useEffect, useRef } from "react";
import { onForegroundMessage } from "@/lib/notifications";
import { Phone, PhoneOff, Video, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, onSnapshot, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function IncomingCallOverlay() {
    const [incomingCall, setIncomingCall] = useState<any>(null);
    const router = useRouter();
    const { user } = useAuth();
    const ringtoneRef = useRef<HTMLAudioElement | null>(null);
    const [isAnswering, setIsAnswering] = useState(false);

    useEffect(() => {
        // Fallback: Listen for incoming FCM call signals for edge cases
        const unsubscribeFCM = onForegroundMessage((payload) => {
            if (payload.data?.type === 'call' && !incomingCall) {
                setIncomingCall(payload.data);
                playRingtone();
            }
        });

        return () => {
            if (typeof unsubscribeFCM === 'function') unsubscribeFCM();
        };
    }, []);

    useEffect(() => {
        if (!user?.uid) return;

        // Primary: Real-time In-App Firestore listener for rock-solid reliability
        const q = query(
            collection(db, "calls"), 
            where("toUserId", "==", user.uid),
            where("status", "==", "ringing")
        );

        const unsubFirestore = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const callDoc = snapshot.docs[0];
                const callData = callDoc.data();
                
                // Expiration Guard: Ignore calls older than 60 seconds (Ghost Call fix)
                const createdAt = callData.createdAt?.toDate ? callData.createdAt.toDate() : new Date();
                const ageInSeconds = (Date.now() - createdAt.getTime()) / 1000;
                
                if (ageInSeconds > 60) {
                    console.log("FCM: Ignoring stale call (Age:", ageInSeconds, "s)");
                    deleteDoc(callDoc.ref).catch(() => {});
                    setIncomingCall(null);
                    stopRingtone();
                    return;
                }
                
                setIncomingCall({ ...callData, id: callDoc.id });
                playRingtone();
            } else {
                setIncomingCall(null);
                stopRingtone();
            }
        });

        return () => unsubFirestore();
    }, [user?.uid]);

    const playRingtone = () => {
        if (!ringtoneRef.current) {
            ringtoneRef.current = new Audio('/ringtone.mp3');
            ringtoneRef.current.loop = true;
        }
        ringtoneRef.current.play().catch(() => console.log("User interaction needed for audio"));
    };

    const stopRingtone = () => {
        if (ringtoneRef.current) {
            ringtoneRef.current.pause();
            ringtoneRef.current.currentTime = 0;
        }
    };

    if (!incomingCall) return null;

    const { callType, conversationId, fromUserName, fromUserAvatar, roomName, id } = incomingCall;

    const handleAccept = async () => {
        setIsAnswering(true);
        stopRingtone();
        if (id) await updateDoc(doc(db, "calls", id), { status: 'accepted' }).catch(() => {});
        // Note: Don't setIncomingCall(null) immediately to allow navigation to complete
        router.push(`/messages/${conversationId}?call=true&type=${callType}&room=${roomName}`);
        
        // Brief delay before removing overlay to ensure ChatBox has time to mount AgoraCall
        setTimeout(() => {
            setIncomingCall(null);
            setIsAnswering(false);
        }, 800);
    };

    const handleDecline = async () => {
        stopRingtone();
        if (id) await deleteDoc(doc(db, "calls", id)).catch(() => {});
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
                        disabled={isAnswering}
                        className={`group flex flex-col items-center gap-3 ${isAnswering ? 'opacity-20 grayscale cursor-not-allowed' : ''}`}
                    >
                        <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-white hover:bg-red-700 transition-all hover:scale-110 active:scale-95 shadow-lg shadow-red-900/20">
                            <PhoneOff className="w-8 h-8" />
                        </div>
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Decline</span>
                    </button>

                    <button 
                        onClick={handleAccept}
                        disabled={isAnswering}
                        className="group flex flex-col items-center gap-3"
                    >
                        <div className={`w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white hover:bg-green-600 transition-all hover:scale-110 active:scale-95 shadow-lg shadow-green-900/20 ${isAnswering ? 'animate-pulse' : ''}`}>
                            {isAnswering ? (
                                <div className="w-8 h-8 border-4 border-white border-t-transparent animate-spin rounded-full" />
                            ) : callType === 'video' ? (
                                <Video className="w-8 h-8" />
                            ) : (
                                <Phone className="w-8 h-8" />
                            )}
                        </div>
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                            {isAnswering ? 'Answering...' : 'Accept'}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}
