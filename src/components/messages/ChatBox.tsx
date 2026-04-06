"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc, increment, deleteDoc, arrayUnion, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Send, Image, User, Phone, Video, X, Mic, MicOff, VideoOff, Maximize2, Minimize2, MoreHorizontal, Trash2, Circle, Info, ArrowLeft, ShieldAlert, Edit, Check, CheckCheck } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { sendPushNotification } from "@/lib/notifications";
import AgoraCall from "./AgoraCall";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { useCall } from "@/contexts/CallContext";

const formatDateSeparator = (date: Date) => {
    const now = new Date();
    const dString = date.toDateString();
    if (dString === now.toDateString()) return "Today";
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (dString === yesterday.toDateString()) return "Yesterday";
    return format(date, 'MMMM d, yyyy');
};

export default function ChatBox({ conversationId }: { conversationId: string }) {
    const searchParams = useSearchParams();
    const { user, userData } = useAuth();
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [otherUser, setOtherUser] = useState<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const { startCall } = useCall();
    
    // Core states restored after accidental deletion
    const [mediaFiles, setMediaFiles] = useState<{ file: File; type: 'image' | 'video'; preview: string }[]>([]);
    const [isSending, setIsSending] = useState(false);
    const [otherUserIsTyping, setOtherUserIsTyping] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [deleteMenuMessageId, setDeleteMenuMessageId] = useState<string | null>(null);
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [hasMounted, setHasMounted] = useState(false);
    const [showOfflineOverlay, setShowOfflineOverlay] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(true);
    const [viewportHeight, setViewportHeight] = useState('100dvh');
    const [viewportTop, setViewportTop] = useState(0);
    const [toast, setToast] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);


    useEffect(() => {
        setHasMounted(true);
        
        // WhatsApp-Style Visual Viewport Lock
        const handleViewportResize = () => {
            if (window.visualViewport) {
                setViewportHeight(`${window.visualViewport.height}px`);
                setViewportTop(window.visualViewport.offsetTop);
                // Prevent browser "push-up" by scrolling to 0
                if (window.visualViewport.offsetTop > 0) {
                    window.scrollTo(0, 0);
                }
            }
        };

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleViewportResize);
            window.visualViewport.addEventListener('scroll', handleViewportResize);
            handleViewportResize();
        }

        return () => {
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', handleViewportResize);
                window.visualViewport.removeEventListener('scroll', handleViewportResize);
            }
        };
    }, []);

    // Function to clear unread count for current user
    const clearUnreadCount = useCallback(async () => {
        if (!conversationId || !user?.uid) return;
        try {
            const convRef = doc(db, "conversations", conversationId);
            const convSnap = await getDoc(convRef);
            if (convSnap.exists() && convSnap.data().unreadCount?.[user.uid] > 0) {
                await updateDoc(convRef, {
                    [`unreadCount.${user.uid}`]: 0
                });
            }
        } catch (error) {
            console.error("Error clearing unread count:", error);
        }
    }, [conversationId, user?.uid]);

    // Clear unread on mount, and when focus returns
    useEffect(() => {
        clearUnreadCount();
        window.addEventListener('focus', clearUnreadCount);
        return () => window.removeEventListener('focus', clearUnreadCount);
    }, [clearUnreadCount]);

    useEffect(() => {
        if (!conversationId || !user?.uid) return;

        // Reset state for new conversation
        setMessages([]);
        setLoadingMessages(true);
        setEditingMessageId(null);
        setNewMessage("");

        const q = query(
            collection(db, "conversations", conversationId, "messages")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            try {
                const msgs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Heartbeat every 3 seconds for real-time presence
                // Sort in memory to avoid missing index errors
                const sorted = msgs.sort((a: any, b: any) => {
                    const timeA = a.createdAt?.seconds || 0;
                    const timeB = b.createdAt?.seconds || 0;
                    return timeA - timeB;
                });

                // Find the first unread message after sorting
                const firstUnread = sorted.find((msg: any) => msg.senderId !== user.uid && !msg.read);
                const firstUnreadId = firstUnread?.id;

                // Mark unread messages as read
                msgs.forEach((msg: any) => {
                    if (msg.senderId !== user.uid && !msg.read) {
                        updateDoc(doc(db, "conversations", conversationId, "messages", msg.id), {
                            read: true
                        }).catch(console.error);
                    }
                });

                setMessages(sorted);
                setLoadingMessages(false);

                // Scroll to bottom logic - check if we should jump or scroll
                if (scrollRef.current) {
                    const container = document.getElementById('messages-container');
                    
                    setTimeout(() => {
                        if (firstUnreadId) {
                            const unreadElement = document.getElementById(`msg-${firstUnreadId}`);
                            if (unreadElement) {
                                unreadElement.scrollIntoView({ 
                                    behavior: "auto",
                                    block: "center"
                                });
                                return;
                            }
                        }

                        if (container && sorted.length > 0) {
                            const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
                            
                            if (isNearBottom || sorted.length <= messages.length + 1) {
                                scrollRef.current?.scrollIntoView({ 
                                    behavior: messages.length === 0 ? "auto" : "smooth",
                                    block: "end"
                                });
                            }
                        }
                    }, 50);
                }
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
                
                // Also clear unread count if we see it's > 0 in real-time
                if (data.unreadCount?.[user.uid] > 0) {
                    updateDoc(doc(db, "conversations", conversationId), {
                        [`unreadCount.${user.uid}`]: 0
                    }).catch(() => {});
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
            return (Date.now() - date.getTime()) / 1000 < 30;
        } catch {
            return false;
        }
    };

    const [, setTick] = useState(0);
    useEffect(() => {
        if (!hasMounted) return;
        const timer = setInterval(() => setTick(prev => prev + 1), 3000);
        return () => clearInterval(timer);
    }, [hasMounted]);


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

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                if (audioChunksRef.current.length > 0) {
                    await sendVoiceMessage(audioBlob);
                }
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingDuration(0);
            recordingIntervalRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Microphone access denied:", err);
            alert("Please allow microphone access to send voice messages.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
            }
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            audioChunksRef.current = [];
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
            }
            setRecordingDuration(0);
        }
    };

    const sendVoiceMessage = async (blob: Blob) => {
        if (!user || !conversationId) return;
        setIsSending(true);
        try {
            const audioFile = new File([blob], "voice_message.webm", { type: blob.type });
            const audioUrl = await uploadToCloudinary(audioFile);

            const convDoc = await getDoc(doc(db, "conversations", conversationId));
            const participants = convDoc.data()?.participants || [];
            const otherId = participants.find((p: string) => p !== user.uid);

            await addDoc(collection(db, "conversations", conversationId, "messages"), {
                senderId: user.uid,
                text: "",
                audioUrl,
                read: otherId ? false : true,
                createdAt: serverTimestamp(),
            });

            await updateDoc(doc(db, "conversations", conversationId), {
                lastMessage: "🎤 Voice message",
                lastTimestamp: serverTimestamp(),
                ...(otherId ? { [`unreadCount.${otherId}`]: increment(1) } : {})
            });

            if (otherUser?.userId && otherUser.userId !== user.uid) {
                const senderName = userData?.displayName || userData?.username || 'Someone';
                await sendPushNotification({
                    toUserId: otherUser.userId,
                    title: `💬 ${senderName}`,
                    body: "🎤 Sent a voice message",
                    data: {
                        type: 'message',
                        conversationId,
                        fromUserId: user.uid,
                        url: `/messages/${conversationId}`,
                    },
                });
            }
        } catch (error) {
            console.error("Error sending voice message:", error);
        } finally {
            setIsSending(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!newMessage.trim() && mediaFiles.length === 0) || !user || isSending) return;

        const text = newMessage.trim();
        const currentMedia = [...mediaFiles];
        const isEditing = !!editingMessageId;
        const currentEditId = editingMessageId;
        
        setNewMessage("");
        setMediaFiles([]);
        setEditingMessageId(null);
        setIsSending(true);

        try {
            if (isEditing && currentEditId) {
                await updateDoc(doc(db, "conversations", conversationId, "messages", currentEditId), {
                    text,
                    isEdited: true,
                    updatedAt: serverTimestamp()
                });
                setToast("Message updated");
                setTimeout(() => setToast(null), 3000);
                setIsSending(false);
                return;
            }

            const convDoc = await getDoc(doc(db, "conversations", conversationId));
            const participants = convDoc.data()?.participants || [];
            const otherId = participants.find((p: string) => p !== user.uid);

            let mediaUrls: string[] = [];
            if (currentMedia.length > 0) {
                const uploadPromises = currentMedia.map(m => uploadToCloudinary(m.file));
                mediaUrls = await Promise.all(uploadPromises);
            }

            await addDoc(collection(db, "conversations", conversationId, "messages"), {
                senderId: user.uid,
                text,
                mediaUrls,
                read: otherId ? false : true,
                createdAt: serverTimestamp(),
            });

            await updateDoc(doc(db, "conversations", conversationId), {
                lastMessage: text || (mediaUrls.length > 0 ? (mediaUrls.length > 1 ? "Sent multiple media" : "Sent a photo") : ""),
                lastTimestamp: serverTimestamp(),
                ...(otherId ? { [`unreadCount.${otherId}`]: increment(1) } : {})
            });

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
            setToast("Message deleted");
            setTimeout(() => setToast(null), 3000);
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
            
            setToast("Message deleted");
            setTimeout(() => setToast(null), 3000);
            
            setDeleteMenuMessageId(null);
        } catch (error) {
            console.error("Error deleting for both:", error);
        }
    };

    const handleLongPress = (messageId: string) => {
        if (navigator.vibrate) navigator.vibrate(50);
        setEditingMessageId(null);
        setDeleteMenuMessageId(messageId);
    };

    const handleStartEdit = (messageId: string, currentText: string) => {
        setEditingMessageId(messageId);
        setNewMessage(currentText);
        setDeleteMenuMessageId(null);
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
        <div 
            className="flex flex-col w-full border-r border-gray-800 bg-black overflow-hidden fixed left-0 sm:relative z-[50]"
            style={{ 
                height: viewportHeight,
                top: viewportTop,
                maxHeight: viewportHeight
            }}
        >
            <header className="flex-none w-full min-h-[64px] border-b border-gray-800 flex items-center px-4 gap-3 sm:gap-4 bg-black/95 backdrop-blur-md z-[20] pt-[env(safe-area-inset-top)]">
                <Link 
                    href={otherUser?.userId ? `/profile/${otherUser.userId}` : "#"} 
                    className="flex items-center gap-3 sm:gap-4 flex-grow min-w-0 group hover:opacity-80 transition-opacity"
                >
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0 font-bold text-white uppercase overflow-hidden text-lg">
                        {otherUser?.profileImage ? (
                            <img src={otherUser.profileImage} className="w-full h-full rounded-full object-cover" alt="Avatar" />
                        ) : (
                            (otherUser?.displayName || otherUser?.username || "?")[0]
                        )}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <h2 className="font-bold text-white text-[16px] sm:text-[17px] leading-tight truncate group-hover:underline">
                            {otherUser?.displayName || otherUser?.username || (conversationId ? "..." : "Select a chat")}
                            {otherUser?.isSelf ? " (You)" : ""}
                        </h2>
                        <div className="flex items-center gap-1.5 truncate h-5">
                            {otherUserIsTyping ? (
                                <p className="text-twitter-blue text-[12px] sm:text-[13px] animate-pulse font-medium">
                                     Typing...
                                </p>
                            ) : hasMounted && otherUser?.lastSeen ? (
                                <div className="flex items-center gap-1">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isUserActive(otherUser.lastSeen) ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-gray-500'}`} />
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
                    <button className="p-2 hover:bg-white/10 rounded-full text-white transition-colors" title="Voice Call" onClick={() => startCall(otherUser, 'voice', conversationId)}>
                        <Phone className="w-5 h-5" />
                    </button>
                    <button className="p-2 hover:bg-white/10 rounded-full text-white transition-colors" title="Video Call" onClick={() => startCall(otherUser, 'video', conversationId)}>
                        <Video className="w-5 h-5" />
                    </button>
                    <button className="p-2 hover:bg-white/10 rounded-full text-white transition-colors hidden sm:block">
                        <Info className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {otherUser && !isUserActive(otherUser.lastSeen) && (hasMounted) && (
                <div className="flex-none bg-zinc-900 border-b border-gray-800 px-4 py-2 text-center">
                    <p className="text-[11px] text-gray-400 font-medium tracking-tight">
                        {otherUser.displayName || otherUser.username} is currently offline. Calls are disabled.
                    </p>
                </div>
            )}

            <div 
                id="messages-container"
                className="flex-1 overflow-y-auto p-4 space-y-4 container scroll-smooth custom-scrollbar"
            >
                {loadingMessages ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
                        <div className="w-8 h-8 border-2 border-twitter-blue border-t-transparent animate-spin rounded-full" />
                        <p className="text-sm font-medium">Loading messages...</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                        <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-3xl font-bold text-white uppercase overflow-hidden mb-4 shadow-xl">
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
                        if (msg.deletedBy && msg.deletedBy.includes(user?.uid)) return null;

                        const msgDate = msg.createdAt?.toDate ? msg.createdAt.toDate() : (msg.createdAt instanceof Date ? msg.createdAt : new Date());
                        const prevMsg = index > 0 ? messages[index - 1] : null;
                        const prevDate = prevMsg?.createdAt?.toDate ? prevMsg.createdAt.toDate() : (prevMsg?.createdAt instanceof Date ? prevMsg.createdAt : null);
                        
                        const showDateSeparator = !prevDate || msgDate.toDateString() !== prevDate.toDateString();

                        return (
                            <div key={msg.id} className="flex flex-col gap-4">
                                {showDateSeparator && (
                                    <div className="flex justify-center my-2">
                                        <div className="bg-[#15181c] text-gray-500 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-gray-800 shadow-sm uppercase tracking-wider opacity-80">
                                            {formatDateSeparator(msgDate)}
                                        </div>
                                    </div>
                                )}
                                <div 
                                    id={`msg-${msg.id}`}
                                    className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                                >
                                    <div 
                                        className={cn(
                                            "w-fit max-w-[85%] sm:max-w-[70%] px-2.5 py-1.5 rounded-2xl select-none touch-none shadow-sm relative group",
                                            isMine 
                                                ? "bg-twitter-blue text-white rounded-br-none" 
                                                : msg.isDeletedForEveryone 
                                                    ? "bg-transparent border border-gray-800 text-gray-500 italic rounded-2xl rounded-tl-none"
                                                    : "bg-[#202327] text-white rounded-bl-none"
                                        )}
                                        onTouchStart={() => startPress(msg.id)}
                                        onTouchEnd={endPress}
                                        onMouseDown={() => startPress(msg.id)}
                                        onMouseUp={endPress}
                                        onMouseLeave={endPress}
                                        onContextMenu={(e) => e.preventDefault()}
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
                                        
                                        <div className="flex flex-col min-w-[40px]">
                                            <p className="text-[13px] sm:text-[14px] whitespace-pre-wrap break-words leading-tight pr-1">
                                                {msg.text}
                                            </p>
                                            
                                            <div className={cn(
                                                "flex items-center justify-end gap-1 mt-0.5 self-end select-none",
                                                isMine ? "text-blue-100/60" : "text-gray-500"
                                            )}>
                                                {msg.isEdited && (
                                                    <span className="text-[8px] italic mr-0.5">edited</span>
                                                )}
                                                <span className="text-[9px] font-medium leading-none">
                                                    {msg.createdAt ? format(msgDate, 'h:mm a') : '...'}
                                                </span>
                                                {isMine && !msg.isDeletedForEveryone && (
                                                    <div className="flex items-center ml-0.5">
                                                        {msg.read ? (
                                                            <CheckCheck className="w-3 h-3 text-white" />
                                                        ) : (
                                                            <Check className="w-3 h-3 opacity-60" />
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div className="h-2 w-full" />
                <div ref={scrollRef} className="h-1" />
            </div>

            {/* Rest of the file: Input Area, etc. (skipped for brevity) */}
            {/* ... */}
        </div>
    );
}
