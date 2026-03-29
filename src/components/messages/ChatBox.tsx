"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Send, Image, User, Phone, Video, X, Mic, MicOff, VideoOff, Maximize2, Minimize2, MoreHorizontal, Trash2, Circle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { sendPushNotification } from "@/lib/notifications";
import AgoraCall from "./AgoraCall";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import { deleteDoc, arrayUnion, setDoc } from "firebase/firestore";
import { useSearchParams } from "next/navigation";

export default function ChatBox({ conversationId }: { conversationId: string }) {
    const searchParams = useSearchParams();
    const { user, userData } = useAuth();
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [otherUser, setOtherUser] = useState<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [callType, setCallType] = useState<'voice' | 'video'>('voice');
    const [isCalling, setIsCalling] = useState(false);
    const [roomName, setRoomName] = useState("");
    const [mediaFiles, setMediaFiles] = useState<{ file: File; type: 'image' | 'video'; preview: string }[]>([]);
    const [isSending, setIsSending] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Voice Message states
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [deleteMenuMessageId, setDeleteMenuMessageId] = useState<string | null>(null);
    const manuallyInitiated = useRef(false);
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    useEffect(() => {
        // Check for call in query params
        const callTrigger = searchParams.get('call');
        if (callTrigger === 'true') {
            const type = searchParams.get('type') as any;
            const rName = searchParams.get('room');
            if (type) setCallType(type);
            if (rName && rName !== roomName) {
                console.log("Call pickup from URL:", rName);
                setRoomName(rName);
                setIsCalling(true);
            }
        }
    }, [searchParams, conversationId, roomName]);

    useEffect(() => {
        if (!conversationId || !user?.uid) return;

        const q = query(
            collection(db, "conversations", conversationId, "messages")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            try {
                const msgs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Mark unread messages as read
                msgs.forEach((msg: any) => {
                    if (msg.senderId !== user.uid && !msg.read) {
                        updateDoc(doc(db, "conversations", conversationId, "messages", msg.id), {
                            read: true
                        }).catch(console.error);
                    }
                });

                // Clear my unread count for this conversation
                updateDoc(doc(db, "conversations", conversationId), {
                    [`unreadCount.${user.uid}`]: 0
                }).catch(() => {});

                // Sort in memory to avoid missing index errors
                const sorted = msgs.sort((a: any, b: any) => {
                    const timeA = a.createdAt?.seconds || 0;
                    const timeB = b.createdAt?.seconds || 0;
                    return timeA - timeB;
                });

                setMessages(sorted);
                // Scroll to bottom
                setTimeout(() => {
                    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
                }, 100);
            } catch (error) {
                console.error("ChatBox messages error:", error);
            }
        }, (error) => {
            console.error("ChatBox snapshot error:", error);
        });

        return () => unsubscribe();
    }, [conversationId, user?.uid]);

    // Fetch other user info with real-time presence
    useEffect(() => {
        if (!conversationId || !user) return;

        let unsubUser: () => void;

        const setupUserListener = async () => {
            try {
                const convDoc = await getDoc(doc(db, "conversations", conversationId));
                if (convDoc.exists()) {
                    const participants = convDoc.data().participants;
                    const otherId = participants.find((p: string) => p !== user.uid) || user.uid;

                    unsubUser = onSnapshot(doc(db, "users", otherId), (docSnap) => {
                        if (docSnap.exists()) {
                            setOtherUser({ 
                                userId: docSnap.id, 
                                ...docSnap.data(),
                                isSelf: otherId === user.uid 
                            });
                        }
                    });
                }
            } catch (error) {
                console.error("Error setting up user presence listener:", error);
            }
        };

        setupUserListener();
        return () => unsubUser?.();
    }, [conversationId, user]);

    const formatLastSeen = (lastSeen: any) => {
        if (!lastSeen || !hasMounted) return null;
        try {
            const date = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
            if (isNaN(date.getTime())) return "Active recently";

            const diffInSeconds = (Date.now() - date.getTime()) / 1000;
            if (diffInSeconds < 5) return "Active now"; // Match 3s heartbeat
            
            if (diffInSeconds < 60) return `Active ${Math.floor(diffInSeconds)}s ago`;
            
            return `Active ${formatDistanceToNow(date)} ago`;
        } catch (err) {
            return "Active recently";
        }
    };

    const isUserActive = (lastSeen: any) => {
        if (!lastSeen || !hasMounted) return false;
        try {
            const date = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
            // Hyper-responsive: 5-second threshold for the 3-second heartbeat
            return (Date.now() - date.getTime()) / 1000 < 5;
        } catch {
            return false;
        }
    };

    // Force re-render frequently (3s) to keep up with the hyper-responsive heartbeats
    const [, setTick] = useState(0);
    useEffect(() => {
        if (!hasMounted) return;
        const timer = setInterval(() => setTick(prev => prev + 1), 3000);
        return () => clearInterval(timer);
    }, [hasMounted]);

    useEffect(() => {
        if (!isCalling || !roomName || !manuallyInitiated.current) return;

        // Auto-cancel call after 60 seconds if not answered
        const timeout = setTimeout(async () => {
            console.log("Call timed out after 60s");
            setIsCalling(false);
            manuallyInitiated.current = false;
            await deleteDoc(doc(db, "calls", roomName)).catch(() => {});
        }, 60000);

        console.log("Listening to call status for room:", roomName);
        const unsub = onSnapshot(doc(db, "calls", roomName), (docSnap) => {
            if (!docSnap.exists()) {
                 console.log("Call document deleted (ended by other party)");
                 setIsCalling(false);
                 manuallyInitiated.current = false;
                 clearTimeout(timeout);
            }
        }, (error) => {
            console.error("Call status listener error:", error);
        });

        return () => {
            unsub();
            clearTimeout(timeout);
        };
    }, [isCalling, roomName]);

    const recordCallEvent = async (type: 'voice' | 'video') => {
        if (!user || !conversationId) return;
        const text = type === 'voice' ? "📞 Started a voice call" : "📹 Started a video call";
        try {
            await addDoc(collection(db, "conversations", conversationId, "messages"), {
                senderId: user.uid,
                text,
                type: 'call',
                read: false,
                createdAt: serverTimestamp(),
            });

            const convDoc = await getDoc(doc(db, "conversations", conversationId));
            const participants = convDoc.data()?.participants || [];
            const otherId = participants.find((p: string) => p !== user.uid);

            if (otherId) {
                await updateDoc(doc(db, "conversations", conversationId), {
                    lastMessage: text,
                    lastTimestamp: serverTimestamp(),
                    [`unreadCount.${otherId}`]: increment(1)
                });
            }
        } catch (error) {
            console.error("Error recording call event:", error);
        }
    };

    const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Limit to 4 items
        const newFiles = files.slice(0, 4 - mediaFiles.length);
        
        newFiles.forEach(file => {
            const type = file.type.startsWith('video/') ? 'video' : 'image';
            const reader = new FileReader();
            reader.onloadend = () => {
                setMediaFiles(prev => [...prev, {
                    file,
                    type,
                    preview: reader.result as string
                }]);
            };
            reader.readAsDataURL(file);
        });

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const removeMedia = (index: number) => {
        setMediaFiles(prev => prev.filter((_, i) => i !== index));
    };

    const sendVoiceMessage = async (file: File) => {
        if (!user) return;
        setIsSending(true);
        try {
            const convDoc = await getDoc(doc(db, "conversations", conversationId));
            const participants = convDoc.data()?.participants || [];
            const otherId = participants.find((p: string) => p !== user.uid);
            
            const audioUrl = await uploadToCloudinary(file);
            
            await addDoc(collection(db, "conversations", conversationId, "messages"), {
                senderId: user.uid,
                audioUrl,
                type: 'voice',
                read: otherId ? false : true,
                createdAt: serverTimestamp(),
            });

            const senderName = userData?.displayName || userData?.username || 'Someone';

            // Update conversation last message for everyone
            await updateDoc(doc(db, "conversations", conversationId), {
                lastMessage: "🎤 Sent a voice message",
                lastTimestamp: serverTimestamp(),
                ...(otherId ? { [`unreadCount.${otherId}`]: increment(1) } : {})
            });

            // Signal via push only if not self
            if (otherId && otherId !== user.uid) {
                await sendPushNotification({
                    toUserId: otherId,
                    title: `💬 ${senderName}`,
                    body: "🎤 Sent you a voice message",
                    data: {
                        type: 'message',
                        conversationId,
                        fromUserId: user.uid,
                        url: `/messages/${conversationId}`,
                    },
                });
            }
        } catch (err) {
            console.error("Error sending voice message:", err);
            alert("Failed to send voice message. Please try again.");
        } finally {
            setIsSending(false);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            const chunks: Blob[] = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = async () => {
                const audioBlob = new Blob(chunks, { type: 'audio/webm' });
                const audioFile = new File([audioBlob], `voice-message-${Date.now()}.webm`, { type: 'audio/webm' });
                await sendVoiceMessage(audioFile);
                stream.getTracks().forEach(track => track.stop());
            };

            setAudioChunks(chunks);
            setMediaRecorder(recorder);
            recorder.start();
            setIsRecording(true);
            setRecordingDuration(0);

            timerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } catch (error) {
            console.error("Error starting recording:", error);
            alert("Microphone access is required for voice messages.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.onstop = null;
            mediaRecorder.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!newMessage.trim() && mediaFiles.length === 0) || !user || isSending) return;

        const text = newMessage.trim();
        const currentMedia = [...mediaFiles];
        
        setNewMessage("");
        setMediaFiles([]);
        setIsSending(true);

        try {
            const convDoc = await getDoc(doc(db, "conversations", conversationId));
            const participants = convDoc.data()?.participants || [];
            const otherId = participants.find((p: string) => p !== user.uid);

            // 1. Upload media if any
            let mediaUrls: string[] = [];
            if (currentMedia.length > 0) {
                const uploadPromises = currentMedia.map(m => uploadToCloudinary(m.file));
                mediaUrls = await Promise.all(uploadPromises);
            }

            // 2. Add message to Firestore
            await addDoc(collection(db, "conversations", conversationId, "messages"), {
                senderId: user.uid,
                text,
                mediaUrls,
                read: otherId ? false : true,
                createdAt: serverTimestamp(),
            });

            // 3. Update conversation last message values

            // Update conversation last message for everyone
            await updateDoc(doc(db, "conversations", conversationId), {
                lastMessage: text || (mediaUrls.length > 0 ? (mediaUrls.length > 1 ? "Sent multiple media" : "Sent a photo") : ""),
                lastTimestamp: serverTimestamp(),
                ...(otherId ? { [`unreadCount.${otherId}`]: increment(1) } : {})
            });

            // 4. Send push notification to the other user
            if (otherUser?.userId && otherUser.userId !== user.uid) {
                const senderName = userData?.displayName || userData?.username || 'Someone';
                await sendPushNotification({
                    toUserId: otherUser.userId,
                    title: `💬 ${senderName}`,
                    body: text ? (text.length > 80 ? text.substring(0, 80) + '...' : text) : 'Sent you a photo',
                    data: {
                        type: 'message',
                        conversationId,
                        fromUserId: user.uid,
                        url: `/messages/${conversationId}`,
                    },
                });
            }
        } catch (error) {
            console.error("Error sending message:", error);
            alert("Failed to send message/media. Please try again.");
        } finally {
            setIsSending(false);
        }
    };

    const handleDeleteForMe = async (messageId: string) => {
        if (!user || !conversationId) return;
        try {
            await updateDoc(doc(db, "conversations", conversationId, "messages", messageId), {
                deletedBy: arrayUnion(user.uid)
            });
            setDeleteMenuMessageId(null);
        } catch (error) {
            console.error("Error deleting for me:", error);
        }
    };

    const handleDeleteForBoth = async (messageId: string) => {
        if (!user || !conversationId) return;
        try {
            await updateDoc(doc(db, "conversations", conversationId, "messages", messageId), {
                text: "🚫 This message was deleted",
                mediaUrls: [],
                audioUrl: null,
                isDeletedForEveryone: true
            });
            setDeleteMenuMessageId(null);
        } catch (error) {
            console.error("Error deleting for both:", error);
        }
    };

    const handleLongPress = (messageId: string) => {
        if (navigator.vibrate) navigator.vibrate(50);
        setDeleteMenuMessageId(messageId);
    };

    const startPress = (messageId: string) => {
        longPressTimerRef.current = setTimeout(() => handleLongPress(messageId), 500);
    };

    const endPress = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    return (
        <div className="flex flex-col h-[100dvh] w-full max-h-[100dvh] border-r border-gray-800 bg-black overflow-hidden relative">
            {/* Header - Fixed with Flex */}
            <div className="min-h-[64px] h-auto pt-[env(safe-area-inset-top)] border-b border-gray-800 flex items-center px-4 gap-3 sm:gap-4 bg-black/95 backdrop-blur-md z-[110] shrink-0">
                <Link 
                    href={otherUser?.userId ? `/profile/${otherUser.userId}` : "#"} 
                    className="flex items-center gap-4 flex-grow min-w-0 group hover:opacity-80 transition-opacity"
                >
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0 font-bold text-white uppercase overflow-hidden text-lg">
                        {otherUser?.profileImage ? (
                            <img src={otherUser.profileImage} className="w-full h-full rounded-full object-cover" alt="Avatar" />
                        ) : (
                            (otherUser?.displayName || otherUser?.username || "?")[0]
                        )}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 mr-1 sm:mr-2">
                        <h2 className="font-bold text-white text-[16px] sm:text-[17px] leading-tight truncate group-hover:underline">
                            {otherUser?.displayName || otherUser?.username || (conversationId ? "..." : "Select a chat")}
                            {otherUser?.isSelf ? " (You)" : ""}
                        </h2>
                        <div className="flex items-center gap-1.5 truncate h-5">
                            {hasMounted && otherUser?.lastSeen ? (
                                <div className="flex items-center gap-1">
                                    <div className={`w-2 h-2 rounded-full ${isUserActive(otherUser.lastSeen) ? 'bg-green-500' : 'bg-gray-500'}`} />
                                    <p className={`text-[12px] sm:text-[13px] ${isUserActive(otherUser.lastSeen) ? 'text-green-500 font-medium' : 'text-gray-500'}`}>
                                        {formatLastSeen(otherUser.lastSeen)}
                                    </p>
                                </div>
                            ) : otherUser?.username ? (
                                <p className="text-gray-500 text-[12px] sm:text-[13px] truncate">@{otherUser.username}</p>
                            ) : null}
                        </div>
                    </div>
                </Link>
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    {otherUser && otherUser.userId !== user?.uid && (
                        <>
                            <button 
                                onClick={async () => { 
                                    const generatedRoom = `DirectCall_${Math.random().toString(36).substring(2, 11)}_${Math.random().toString(36).substring(2, 11)}`;
                                    
                                    // 1. Record in chat history
                                    await recordCallEvent('voice');

                                    // 2. Real-time in-app ringing via Firestore
                                    if (user && otherUser?.userId) {
                                        await setDoc(doc(db, "calls", generatedRoom), {
                                            toUserId: otherUser.userId,
                                            fromUserId: user.uid,
                                            fromUserName: user.displayName || userData?.username || "Someone",
                                            fromUserAvatar: (user as any).profileImage || '',
                                            callType: 'voice',
                                            roomName: generatedRoom,
                                            conversationId,
                                            status: 'ringing',
                                            createdAt: serverTimestamp()
                                        }).catch(console.error);
                                    }

                                    // 3. Fallback push notification for offline devices
                                    if (user && otherUser?.userId) {
                                        await sendPushNotification({
                                            toUserId: otherUser.userId,
                                            title: "Incoming Voice Call",
                                            body: `${user.displayName || 'Someone'} is calling...`,
                                            data: {
                                                type: 'call',
                                                callType: 'voice',
                                                conversationId,
                                                roomName: generatedRoom,
                                                fromUserName: user.displayName || user.email?.split('@')[0] || 'Someone',
                                                fromUserAvatar: (user as any).profileImage || ''
                                            }
                                        });
                                    }

                                    // 4. Update UI - Now safe because document exists
                                    manuallyInitiated.current = true;
                                    setCallType('voice'); 
                                    setRoomName(generatedRoom);
                                    setIsCalling(true);
                                }}
                                disabled={!isUserActive(otherUser.lastSeen)}
                                className="p-2.5 hover:bg-white/10 rounded-full text-twitter-blue transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed disabled:grayscale"
                                title={isUserActive(otherUser.lastSeen) ? "Voice Call" : "User Offline"}
                            >
                                <Phone className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={async () => { 
                                    const generatedRoom = `DirectCall_${Math.random().toString(36).substring(2, 11)}_${Math.random().toString(36).substring(2, 11)}`;
                                    
                                    // 1. Record in chat history
                                    await recordCallEvent('video');

                                    // 2. Real-time in-app ringing via Firestore
                                    if (user && otherUser?.userId) {
                                        await setDoc(doc(db, "calls", generatedRoom), {
                                            toUserId: otherUser.userId,
                                            fromUserId: user.uid,
                                            fromUserName: user.displayName || userData?.username || "Someone",
                                            fromUserAvatar: (user as any).profileImage || '',
                                            callType: 'video',
                                            roomName: generatedRoom,
                                            conversationId,
                                            status: 'ringing',
                                            createdAt: serverTimestamp()
                                        }).catch(console.error);
                                    }

                                    // 3. Fallback push notification for offline devices
                                    if (user && otherUser?.userId) {
                                        await sendPushNotification({
                                            toUserId: otherUser.userId,
                                            title: "Incoming Video Call",
                                            body: `${user.displayName || 'Someone'} is video calling...`,
                                            data: {
                                                type: 'call',
                                                callType: 'video',
                                                conversationId,
                                                roomName: generatedRoom,
                                                fromUserName: user.displayName || user.email?.split('@')[0] || 'Someone',
                                                fromUserAvatar: (user as any).profileImage || ''
                                            }
                                        });
                                    }

                                    // 4. Update UI
                                    manuallyInitiated.current = true;
                                    setCallType('video'); 
                                    setRoomName(generatedRoom);
                                    setIsCalling(true);
                                }}
                                disabled={!isUserActive(otherUser.lastSeen)}
                                className="p-2.5 hover:bg-white/10 rounded-full text-twitter-blue transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed disabled:grayscale"
                                title={isUserActive(otherUser.lastSeen) ? "Video Call" : "User Offline"}
                            >
                                <Video className="w-6 h-6" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Real Call Overlay (Agora) */}
            {isCalling && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col">
                    <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-black">
                        <h3 className="text-white font-bold">Call with {otherUser?.displayName || "User"}</h3>
                        <button 
                            onClick={async () => {
                                setIsCalling(false);
                                manuallyInitiated.current = false;
                                await deleteDoc(doc(db, "calls", roomName)).catch(() => {});
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full font-bold transition flex items-center gap-2"
                        >
                            <X className="w-5 h-5" /> End Call
                        </button>
                    </div>
                    <AgoraCall 
                        roomName={roomName} 
                        callType={callType} 
                        otherUser={otherUser}
                        onEndCall={async () => {
                            setIsCalling(false);
                            manuallyInitiated.current = false;
                            await deleteDoc(doc(db, "calls", roomName)).catch(() => {});
                        }} 
                    />
                </div>
            )}

            {/* Messages Area - Standard Scroll */}
            <div className="flex-grow overflow-y-auto px-4 py-4 flex flex-col gap-3 scroll-smooth" onClick={() => setDeleteMenuMessageId(null)}>
                {messages.filter(msg => !msg.deletedBy?.includes(user?.uid)).map((msg) => {
                    const isMe = msg.senderId === user?.uid;
                    const isSystemMessage = msg.isDeletedForEveryone;

                    return (
                        <div
                            key={msg.id}
                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative select-none`}
                            onContextMenu={(e) => !isSystemMessage && e.preventDefault()}
                            onTouchStart={() => !isSystemMessage && startPress(msg.id)}
                            onTouchEnd={endPress}
                            onMouseDown={() => !isSystemMessage && startPress(msg.id)}
                            onMouseUp={endPress}
                            onMouseLeave={endPress}
                        >
                            <div className="relative flex items-center group/bubble">
                                {isMe && !isSystemMessage && (
                                    <div className={cn(
                                        "transition-opacity mr-2 hidden sm:block",
                                        deleteMenuMessageId === msg.id ? "opacity-100" : "opacity-0 group-hover/bubble:opacity-100"
                                    )}>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteMenuMessageId(msg.id === deleteMenuMessageId ? null : msg.id);
                                            }}
                                            className="p-1 hover:bg-white/10 rounded-full text-gray-500"
                                        >
                                            <MoreHorizontal className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}

                                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-[15px] ${isMe
                                    ? 'bg-twitter-blue text-black rounded-br-none'
                                    : 'bg-[#2f3336] text-white rounded-bl-none'
                                    } ${isSystemMessage ? 'opacity-50 italic border border-gray-800 bg-transparent text-gray-500' : ''}`}>
                                    
                                    {!isSystemMessage && msg.mediaUrls && msg.mediaUrls.length > 0 && (
                                        <div className={cn(
                                            "grid gap-1 mb-2",
                                            msg.mediaUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"
                                        )}>
                                            {msg.mediaUrls.map((url: string, idx: number) => (
                                                <div key={idx} className="rounded-lg overflow-hidden border border-gray-800 bg-gray-950">
                                                    {url.includes('.mp4') || url.includes('.mov') ? (
                                                        <video src={url} className="max-h-60 w-full object-contain" controls />
                                                    ) : (
                                                        <img src={url} alt="Shared" className="max-h-60 w-full object-contain" onClick={() => window.open(url, '_blank')} />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {!isSystemMessage && msg.audioUrl && (
                                        <div className="flex flex-col gap-2 min-w-[200px] py-1">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center">
                                                    <Mic className="w-4 h-4 text-inherit" />
                                                </div>
                                                <audio 
                                                    src={msg.audioUrl} 
                                                    controls 
                                                    className="h-8 max-w-[180px] custom-audio-player"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {msg.text && <div>{msg.text}</div>}
                                </div>

                                {!isMe && !isSystemMessage && (
                                    <div className={cn(
                                        "transition-opacity ml-2 hidden sm:block",
                                        deleteMenuMessageId === msg.id ? "opacity-100" : "opacity-0 group-hover/bubble:opacity-100"
                                    )}>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteMenuMessageId(msg.id === deleteMenuMessageId ? null : msg.id);
                                            }}
                                            className="p-1 hover:bg-white/10 rounded-full text-gray-500"
                                        >
                                            <MoreHorizontal className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            {!isSystemMessage && (
                                <span className="text-gray-500 text-[11px] mt-1 px-1 flex items-center">
                                    {msg.createdAt?.toDate ? format(msg.createdAt.toDate(), 'p') : '...'}
                                    {isMe && (
                                        <span className={`font-bold ml-1.5 flex items-center gap-0.5 ${msg.read ? 'text-twitter-blue' : 'text-gray-500'}`}>
                                            <div className={`w-1 h-1 rounded-full ${msg.read ? 'bg-twitter-blue' : 'bg-gray-500'}`}></div>
                                            {msg.read ? 'Seen' : 'Sent'}
                                        </span>
                                    )}
                                </span>
                            )}
                        </div>
                    );
                })}
                <div ref={scrollRef} />
            </div>

            {/* Input Area - Fixed with Flex at bottom */}
            <div className="flex flex-col border-t border-gray-800 bg-black">
                {/* Media Preview Area */}
                {mediaFiles.length > 0 && (
                    <div className="flex gap-2 p-3 overflow-x-auto bg-black/50">
                        {mediaFiles.map((media, idx) => (
                            <div key={idx} className="relative shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-gray-800">
                                <button
                                    onClick={() => removeMedia(idx)}
                                    className="absolute top-1 right-1 z-10 bg-black/50 hover:bg-black/80 p-0.5 rounded-full text-white"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                                {media.type === 'image' ? (
                                    <img src={media.preview} className="w-full h-full object-cover" alt="Preview" />
                                ) : (
                                    <video src={media.preview} className="w-full h-full object-cover" muted />
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSendMessage} className="p-3 flex items-center gap-2 z-50 pb-[max(12px,env(safe-area-inset-bottom))]">
                    {isRecording ? (
                        <div className="flex-grow flex items-center bg-[#202327] rounded-2xl py-2 px-4 gap-4 animate-in fade-in duration-300">
                            <div className="flex items-center gap-2 flex-grow">
                                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                <span className="font-mono text-white text-[15px]">{formatDuration(recordingDuration)}</span>
                                <div className="flex gap-0.5 h-4 items-center flex-grow justify-center opacity-50">
                                    {[1, 2, 3, 4, 5, 6, 7].map(i => (
                                        <div key={i} className="w-1 bg-white rounded-full animate-bounce" style={{ height: `${20 + Math.random() * 80}%`, animationDelay: `${i * 0.1}s` }} />
                                    ))}
                                </div>
                            </div>
                            <button 
                                type="button" 
                                onClick={cancelRecording}
                                className="text-gray-500 hover:text-white font-bold text-sm transition"
                            >
                                Cancel
                            </button>
                            <button 
                                type="button" 
                                onClick={stopRecording}
                                className="bg-twitter-blue hover:brightness-110 text-black p-1.5 rounded-full shadow-lg shadow-twitter-blue/20 transition active:scale-90"
                            >
                                <Send className="w-4 h-4 fill-current" />
                            </button>
                        </div>
                    ) : (
                        <>
                            <input
                                id="chat-file-input"
                                type="file"
                                accept="image/*,video/*"
                                multiple
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleMediaSelect}
                            />
                            <label 
                                htmlFor="chat-file-input"
                                className="p-2 hover:bg-twitter-blue/10 rounded-full text-twitter-blue transition cursor-pointer shrink-0"
                            >
                                <Image className="w-5 h-5" />
                            </label>
                            <button 
                                type="button" 
                                onClick={startRecording}
                                className="p-2 hover:bg-twitter-blue/10 rounded-full text-twitter-blue transition shrink-0"
                                title="Voice Message"
                            >
                                <Mic className="w-5 h-5" />
                            </button>
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Start a new message"
                                className="flex-grow bg-[#202327] rounded-2xl py-2 px-4 outline-none focus:ring-1 focus:ring-twitter-blue transition text-[15px] min-w-0"
                            />
                            <button
                                type="submit"
                                disabled={(!newMessage.trim() && mediaFiles.length === 0) || isSending}
                                className="p-2 hover:bg-twitter-blue/10 rounded-full text-twitter-blue transition disabled:opacity-50 shrink-0"
                            >
                                {isSending ? (
                                    <div className="w-5 h-5 border-2 border-twitter-blue border-t-transparent animate-spin rounded-full" />
                                ) : (
                                    <Send className="w-5 h-5" />
                                )}
                            </button>
                        </>
                    )}
                </form>
            </div>
            {/* Global Delete Action Sheet Overlay */}
            {deleteMenuMessageId && (
                <div 
                    className="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
                    onClick={() => setDeleteMenuMessageId(null)}
                >
                    <div 
                        className="w-full sm:max-w-sm bg-[#15181c] rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-800 overflow-hidden animate-in slide-in-from-bottom duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-4 sm:p-6 text-center">
                            <h3 className="text-white font-bold text-lg mb-1">Delete message?</h3>
                            <p className="text-gray-500 text-sm">This action cannot be undone.</p>
                        </div>
                        
                        <div className="flex flex-col border-t border-gray-800">
                            <button 
                                onClick={() => handleDeleteForMe(deleteMenuMessageId)}
                                className="w-full py-4 text-white font-bold hover:bg-white/5 transition border-b border-gray-800"
                            >
                                Delete for me
                            </button>
                            
                            {messages.find(m => m.id === deleteMenuMessageId)?.senderId === user?.uid && (
                                <button 
                                    onClick={() => handleDeleteForBoth(deleteMenuMessageId)}
                                    className="w-full py-4 text-red-500 font-bold hover:bg-red-500/10 transition border-b border-gray-800"
                                >
                                    Delete for everyone
                                </button>
                            )}
                            
                            <button 
                                onClick={() => setDeleteMenuMessageId(null)}
                                className="w-full py-4 text-gray-400 hover:bg-white/5 transition"
                            >
                                Cancel
                            </button>
                        </div>
                        {/* Safe area for mobile */}
                        <div className="h-[env(safe-area-inset-bottom)] sm:hidden" />
                    </div>
                </div>
            )}
        </div>
    );
}
