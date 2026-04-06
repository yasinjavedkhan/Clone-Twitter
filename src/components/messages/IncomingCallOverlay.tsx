"use client";

import { useState, useEffect, useRef } from "react";
import { onForegroundMessage } from "@/lib/notifications";
import { Phone, PhoneOff, Video, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, onSnapshot, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCall } from "@/contexts/CallContext";
import CallUI from "./CallUI";

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

    const { joinCall } = useCall();

    const handleAccept = async () => {
        setIsAnswering(true);
        stopRingtone();
        if (id) await updateDoc(doc(db, "calls", id), { status: 'accepted' }).catch(() => {});
        
        // WhatsApp-Style: Join the global call context
        joinCall(roomName, callType, { 
            userId: incomingCall.fromUserId, 
            displayName: fromUserName, 
            profileImage: fromUserAvatar 
        });

        // Navigate to the chat for a better UI experience, but the call is now global
        router.push(`/messages/${conversationId}`);
        
        setIncomingCall(null);
        setIsAnswering(false);
    };

    const handleDecline = async () => {
        stopRingtone();
        if (id) await deleteDoc(doc(db, "calls", id)).catch(() => {});
        setIncomingCall(null);
    };

    return (
        <CallUI 
            status="incoming"
            type={callType}
            otherUser={{
                displayName: fromUserName,
                profileImage: fromUserAvatar,
                userId: incomingCall.fromUserId
            }}
            connectedAt={null}
            onEnd={handleDecline}
            onAccept={handleAccept}
            onReject={handleDecline}
        />
    );
}
