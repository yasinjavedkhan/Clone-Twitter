"use client";

import { createContext, useContext, useState, useRef, useEffect, ReactNode } from "react";
import { doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./AuthContext";

type CallType = 'voice' | 'video';

interface CallContextType {
    isCalling: boolean;
    roomName: string | null;
    callType: CallType;
    callStatus: 'calling' | 'ringing' | 'accepted' | 'connected' | 'ended' | null;
    connectedAt: number | null;
    activeOtherUser: any | null;
    startCall: (otherUser: any, type: CallType, conversationId: string) => Promise<void>;
    endCall: () => Promise<void>;
    joinCall: (room: string, type: CallType, otherUser: any) => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [isCalling, setIsCalling] = useState(false);
    const [roomName, setRoomName] = useState<string | null>(null);
    const [callType, setCallType] = useState<CallType>('voice');
    const [callStatus, setCallStatus] = useState<'calling' | 'ringing' | 'accepted' | 'connected' | 'ended' | null>(null);
    const [connectedAt, setConnectedAt] = useState<number | null>(null);
    const [activeOtherUser, setActiveOtherUser] = useState<any | null>(null);
    const manuallyInitiated = useRef(false);

    // Global listener for the active call status
    useEffect(() => {
        if (!isCalling || !roomName) return;

        console.log("Global Call Listener: Monitoring room:", roomName);
        let initialLoad = true;

        const unsub = onSnapshot(doc(db, "calls", roomName), (docSnap) => {
            if (!docSnap.exists()) {
                // If the document is gone, the call ended
                if (initialLoad && manuallyInitiated.current) {
                    initialLoad = false;
                    return;
                }
                console.log("Global Call: Call ended by other party (document deleted)");
                setIsCalling(false);
                setRoomName(null);
                setCallStatus(null);
                setConnectedAt(null);
                setActiveOtherUser(null);
                manuallyInitiated.current = false;
            } else {
                const data = docSnap.data();
                if (data?.status) {
                    setCallStatus(data.status);
                    if (data.status === 'accepted' && !connectedAt && !manuallyInitiated.current) {
                         // Receiver just accepted
                         setConnectedAt(Date.now());
                    }
                }
            }
            initialLoad = false;
        }, (error) => {
            console.error("Global Call listener error:", error);
        });

        return () => unsub();
    }, [isCalling, roomName]);

    const startCall = async (otherUser: any, type: CallType, conversationId: string) => {
        if (!user || !otherUser?.userId) return;

        const generatedRoom = `DirectCall_${Math.random().toString(36).substring(2, 11)}_${Math.random().toString(36).substring(2, 11)}`;
        
        setRoomName(generatedRoom);
        setCallType(type);
        setCallStatus('calling');
        setActiveOtherUser(otherUser);
        setIsCalling(true);
        manuallyInitiated.current = true;

        try {
            await setDoc(doc(db, "calls", generatedRoom), {
                toUserId: otherUser.userId,
                fromUserId: user.uid,
                fromUserName: user.displayName || "Someone",
                fromUserAvatar: (user as any).profileImage || '',
                callType: type,
                roomName: generatedRoom,
                conversationId,
                status: 'ringing',
                createdAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Global Call: Failed to start call:", error);
            setIsCalling(false);
            setRoomName(null);
            setCallStatus(null);
            manuallyInitiated.current = false;
        }
    };

    const joinCall = (room: string, type: CallType, otherUser: any) => {
        setRoomName(room);
        setCallType(type);
        setCallStatus('connected');
        setConnectedAt(Date.now());
        setActiveOtherUser(otherUser);
        setIsCalling(true);
        manuallyInitiated.current = false;
    };

    const endCall = async () => {
        if (roomName) {
            await deleteDoc(doc(db, "calls", roomName)).catch(console.error);
        }
        setIsCalling(false);
        setRoomName(null);
        setCallStatus(null);
        setConnectedAt(null);
        setActiveOtherUser(null);
        manuallyInitiated.current = false;
    };

    return (
        <CallContext.Provider value={{ isCalling, roomName, callType, callStatus, connectedAt, activeOtherUser, startCall, endCall, joinCall }}>
            {children}
        </CallContext.Provider>
    );
}

export function useCall() {
    const context = useContext(CallContext);
    if (context === undefined) {
        throw new Error("useCall must be used within a CallProvider");
    }
    return context;
}
