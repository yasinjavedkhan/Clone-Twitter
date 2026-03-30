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
    const [otherUserIsTyping, setOtherUserIsTyping] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
    const [showOfflineOverlay, setShowOfflineOverlay] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(true);

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

                // Heartbeat every 3 seconds for real-time presence
                // Sort in memory to avoid missing index errors
                const sorted = msgs.sort((a: any, b: any) => {
                    const timeA = a.createdAt?.seconds || 0;
                    const timeB = b.createdAt?.seconds || 0;
                    return timeA - timeB;
                });

                setMessages(sorted);
                setLoadingMessages(false);
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

    // Real-time listener for typing status
    useEffect(() => {
        if (!conversationId || !user?.uid) return;

        const unsubscribe = onSnapshot(doc(db, "conversations", conversationId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const typing = data.typing || {};
                const participants = data.participants || [];
                const otherId = participants.find((p: string) => p !== user.uid);
                
                if (otherId) {
                    setOtherUserIsTyping(!!typing[otherId]);
                }
            }
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
            if (diffInSeconds < 30) return "Active now"; // Robust 30s threshold
            
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
            // Robust threshold: 30 seconds handles network lag and time drift
            return (Date.now() - date.getTime()) / 1000 < 30;
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
            // Clear typing status immediately after sending
            if (user?.uid && conversationId) {
                updateDoc(doc(db, "conversations", conversationId), {
                    [`typing.${user.uid}`]: false
                }).catch(() => {});
            }
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
            // Clear typing status immediately after sending
            if (user?.uid && conversationId) {
                updateDoc(doc(db, "conversations", conversationId), {
                    [`typing.${user.uid}`]: false
                }).catch(() => {});
            }
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
        <div className="flex flex-col fixed inset-0 sm:relative h-[100dvh] w-full max-h-[100dvh] border-r border-gray-800 bg-black overflow-hidden isolate z-[50] sm:z-auto">
            {/* Header - Fixed on mobile to prevent disappearing when keyboard opens */}
            <div className="fixed sm:sticky top-0 left-0 right-0 z-[120] min-h-[calc(64px+env(safe-area-inset-top))] h-auto pt-[env(safe-area-inset-top)] border-b border-gray-800 flex items-center px-4 gap-3 sm:gap-4 bg-black/95 backdrop-blur-md shrink-0 transform-gpu">
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
                        <h2 className="font-bold text-white text-[16px] sm:text-[17px] leading-tight truncate px-0.5 group-hover:underline">
                            {otherUser?.displayName || otherUser?.username || (conversationId ? "..." : "Select a chat")}
                            {otherUser?.isSelf ? " (You)" : ""}
                        </h2>
                        <div className="flex items-center gap-1.5 truncate h-5">
                            {otherUserIsTyping ? (
                                <p className="text-twitter-blue text-[12px] sm:text-[13px] animate-pulse font-medium">Typing...</p>
                            ) : hasMounted && otherUser?.lastSeen ? (
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
                                    if (!isUserActive(otherUser.lastSeen)) {
                                        setShowOfflineOverlay(true);
                                        return;
                                    }
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
                                className={`p-2.5 hover:bg-white/10 rounded-full text-twitter-blue transition-all duration-200 ${!isUserActive(otherUser.lastSeen) ? 'opacity-20 grayscale cursor-pointer' : ''}`}
                                title={isUserActive(otherUser.lastSeen) ? "Voice Call" : "User Offline"}
                            >
                                <Phone className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={async () => { 
                                    if (!isUserActive(otherUser.lastSeen)) {
                                        setShowOfflineOverlay(true);
                                        return;
                                    }
                                    const generatedRoom = `DirectVideoCall_${Math.random().toString(36).substring(2, 11)}_${Math.random().toString(36).substring(2, 11)}`;
                                    
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
                                            body: `${user.displayName || 'Someone'} is calling...`,
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

                                    // 4. Update UI - Now safe because document exists
                                    manuallyInitiated.current = true;
                                    setCallType('video');
                                    setRoomName(generatedRoom);
                                    setIsCalling(true);
                                }}
                                className={`p-2.5 hover:bg-white/10 rounded-full text-twitter-blue transition-all duration-200 ${!isUserActive(otherUser.lastSeen) ? 'opacity-20 grayscale cursor-pointer' : ''}`}
                                title={isUserActive(otherUser.lastSeen) ? "Video Call" : "User Offline"}
                            >
                                <Video className="w-5 h-5" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Offline/Presence Overlay for Calls */}
            {showOfflineOverlay && (
                <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-[#15181c] border border-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                                <Phone className="w-8 h-8 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2">User is Offline</h3>
                                <p className="text-gray-400 text-[15px]">
                                    {otherUser?.displayName || "The user"} is not currently active. You can only start calls when both participants are online.
                                </p>
                            </div>
                            <button 
                                onClick={() => setShowOfflineOverlay(false)}
                                className="w-full mt-2 py-3 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition active:scale-95"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Messages Area - Added padding for fixed header/footer on mobile */}
            <div 
                ref={scrollRef}
                className="flex-grow overflow-y-auto px-4 py-4 pt-[calc(80px+env(safe-area-inset-top))] pb-[calc(110px+env(safe-area-inset-bottom))] sm:pt-4 sm:pb-4 space-y-4 scroll-smooth"
            >
                {loadingMessages ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
                        <div className="w-8 h-8 border-2 border-twitter-blue border-t-transparent animate-spin rounded-full" />
                        <p className="text-sm font-medium">Loading messages...</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center h-full pt-20">
                        <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-3xl font-bold text-white uppercase overflow-hidden mb-4">
                            {otherUser?.profileImage ? (
                                <img src={otherUser.profileImage} className="w-full h-full object-cover" alt="" />
                            ) : (
                                (otherUser?.displayName || otherUser?.username || "?")[0]
                            )}
                        </div>
                        <h3 className="text-xl font-bold text-white">{otherUser?.displayName || otherUser?.username}</h3>
                        <p className="text-gray-500 text-sm mt-1 mb-6">@{otherUser?.username}</p>
                        <p className="text-gray-500 text-[15px] max-w-[280px]">
                            This is the beginning of your conversation with {otherUser?.displayName || otherUser?.username}.
                        </p>
                    </div>
                ) : (
                    messages.map((msg, index) => {
                        const isMine = msg.senderId === user?.uid;
                        
                        // Check if this message was deleted by the user
                        if (msg.deletedBy && msg.deletedBy.includes(user?.uid)) return null;

                        return (
                            <div 
                                key={msg.id} 
                                className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                                onTouchStart={() => startPress(msg.id)}
                                onTouchEnd={endPress}
                                onMouseDown={() => startPress(msg.id)} // Desktop support
                                onMouseUp={endPress}
                                onMouseLeave={endPress}
                            >
                                <div className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${isMine ? 'items-end' : 'items-start'}`}>
                                    <div 
                                        className={cn(
                                            "px-4 py-2.5 text-[15px] leading-relaxed break-words shadow-sm",
                                            isMine 
                                                ? "bg-twitter-blue text-white rounded-2xl rounded-tr-none" 
                                                : msg.isDeletedForEveryone 
                                                    ? "bg-transparent border border-gray-800 text-gray-500 italic rounded-2xl rounded-tl-none"
                                                    : "bg-[#202327] text-white rounded-2xl rounded-tl-none"
                                        )}
                                    >
                                        {msg.mediaUrls && msg.mediaUrls.length > 0 && (
                                            <div className="mb-2 space-y-2">
                                                {msg.mediaUrls.map((url: string, i: number) => {
                                                    const isVideo = url.includes('/video/upload/');
                                                    return (
                                                        <div key={i} className="rounded-xl overflow-hidden border border-white/5">
                                                            {isVideo ? (
                                                                <video src={url} controls className="max-w-full h-auto" />
                                                            ) : (
                                                                <img src={url} alt="" className="max-w-full h-auto" />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {msg.audioUrl && (
                                            <div className="mb-2 py-1">
                                                <audio src={msg.audioUrl} controls className="max-w-full h-10 filter invert brightness-200" />
                                            </div>
                                        )}
                                        {msg.text}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1 px-1">
                                        <span className="text-[11px] text-gray-500 font-medium">
                                            {msg.createdAt?.toDate ? format(msg.createdAt.toDate(), 'h:mm a') : '...'}
                                        </span>
                                        {isMine && (
                                            <span className="text-[11px] text-twitter-blue/80 font-bold">
                                                {msg.read ? '• Seen' : '• Sent'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                {/* Visual anchor for scrolling */}
                <div className="h-6 w-full" />
                <div ref={scrollRef} className="h-2" />
            </div>

            {/* Input Area - Fixed on mobile to ensure it stays above keyboard */}
            <div className="fixed sm:relative bottom-0 left-0 right-0 z-[110] bg-black border-t border-gray-800 shrink-0 overflow-visible">
                
                {/* Floating Typing Indicator Bubble - specifically for mobile visibility */}
                {otherUserIsTyping && (
                    <div className="sm:hidden absolute -top-14 left-4 z-[150] animate-in slide-in-from-bottom-3 duration-300 pointer-events-none">
                        <div className="bg-[#202327]/95 border border-twitter-blue/40 rounded-full px-3 py-1.5 flex items-center gap-2 shadow-2xl backdrop-blur-md">
                            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white uppercase overflow-hidden shrink-0">
                                {otherUser?.profileImage ? (
                                    <img src={otherUser.profileImage} className="w-full h-full object-cover" alt="" />
                                ) : (
                                    (otherUser?.displayName || otherUser?.username || "?")[0]
                                )}
                            </div>
                            <span className="text-twitter-blue text-xs font-bold whitespace-nowrap">
                                {otherUser?.displayName || otherUser?.username || "Someone"} is typing...
                            </span>
                        </div>
                    </div>
                )}

                {/* Media Previews (shown above the main input) */}
                {mediaFiles.length > 0 && (
                    <div className="p-3 flex gap-2 overflow-x-auto bg-black border-b border-gray-800 scrollbar-hide">
                        {mediaFiles.map((m, i) => (
                            <div key={i} className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden border border-white/10 group">
                                {m.type === 'image' ? (
                                    <img src={m.preview} className="w-full h-full object-cover" alt="" />
                                ) : (
                                    <video src={m.preview} className="w-full h-full object-cover" />
                                )}
                                <button 
                                    onClick={() => setMediaFiles(prev => prev.filter((_, idx) => idx !== i))}
                                    className="absolute top-1 right-1 bg-black/60 p-1 rounded-full text-white hover:bg-black transition"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                                {isSending && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                                    </div>
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
                                onChange={(e) => {
                                    setNewMessage(e.target.value);
                                    
                                    // Handle typing status
                                    if (user?.uid && conversationId) {
                                        // Set typing to true
                                        updateDoc(doc(db, "conversations", conversationId), {
                                            [`typing.${user.uid}`]: true
                                        }).catch(() => {});

                                        // Clear previous timeout
                                        if (typingTimeoutRef.current) {
                                            clearTimeout(typingTimeoutRef.current);
                                        }

                                        // Set timeout to clear typing status
                                        typingTimeoutRef.current = setTimeout(() => {
                                            updateDoc(doc(db, "conversations", conversationId), {
                                                [`typing.${user.uid}`]: false
                                            }).catch(() => {});
                                        }, 4000); // 4 seconds after last keypress
                                    }
                                }}
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
