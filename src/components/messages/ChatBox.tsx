"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc, increment, deleteDoc, arrayUnion, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Send, Image, User, Phone, Video, X, Mic, MicOff, VideoOff, Maximize2, Minimize2, MoreHorizontal, Trash2, Circle, Info, ArrowLeft, ShieldAlert, Edit } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { sendPushNotification } from "@/lib/notifications";
import AgoraCall from "./AgoraCall";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
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
    const [viewportHeight, setViewportHeight] = useState('100dvh');
    const [viewportTop, setViewportTop] = useState(0);
    const [toast, setToast] = useState<string | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);


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
                    // Use sorted.length to check if this is the first time we got messages for this session
                    // But we rely on setMessages state transition actually.
                    // Better: check if we were currently loading.
                    const container = document.getElementById('messages-container');
                    
                    setTimeout(() => {
                        if (firstUnreadId) {
                            // If we have unread messages on first load, scroll to the FIRST one
                            const unreadElement = document.getElementById(`msg-${firstUnreadId}`);
                            if (unreadElement) {
                                unreadElement.scrollIntoView({ 
                                    behavior: "auto",
                                    block: "center"
                                });
                                return;
                            }
                        }

                        // Default: Scroll to bottom
                        if (container && sorted.length > 0) {
                            // Instant jump for first load, smooth for new ones
                            // We can use a simpler check: if the scroll is already near the bottom, stay there
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
        setEditingMessageId(null); // Clear any pending edit when opening menu
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
            {isCalling && roomName && (
                <div className="absolute inset-0 z-[100] bg-black">
                    <AgoraCall 
                        roomName={roomName}
                        callType={callType}
                        otherUser={otherUser}
                        onEndCall={async () => {
                            setIsCalling(false);
                            manuallyInitiated.current = false;
                            if (roomName) {
                                await deleteDoc(doc(db, "calls", roomName)).catch(() => {});
                                setRoomName("");
                            }
                        }}
                    />
                </div>
            )}
            {/* Header - Pure Flex Item (stays at top naturally) */}
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
                    {otherUser && otherUser.userId !== user?.uid && (
                        <>
                            <button 
                                onClick={async () => {
                                    if (!isUserActive(otherUser.lastSeen)) {
                                        setShowOfflineOverlay(true);
                                        return;
                                    }
                                    const generatedRoom = `DirectCall_${Math.random().toString(36).substring(2, 11)}_${Math.random().toString(36).substring(2, 11)}`;
                                    await recordCallEvent('voice');
                                    if (user && otherUser?.userId) {
                                        setRoomName(generatedRoom);
                                        setCallType('voice');
                                        setIsCalling(true);
                                        manuallyInitiated.current = true;
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
                                }}
                                className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
                                title="Voice Call"
                            >
                                <Phone className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={async () => {
                                    if (!isUserActive(otherUser.lastSeen)) {
                                        setShowOfflineOverlay(true);
                                        return;
                                    }
                                    const generatedRoom = `DirectCall_${Math.random().toString(36).substring(2, 11)}_${Math.random().toString(36).substring(2, 11)}`;
                                    await recordCallEvent('video');
                                    if (user && otherUser?.userId) {
                                        setRoomName(generatedRoom);
                                        setCallType('video');
                                        setIsCalling(true);
                                        manuallyInitiated.current = true;
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
                                }}
                                className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
                                title="Video Call"
                            >
                                <Video className="w-5 h-5" />
                            </button>
                        </>
                    )}
                    <button className="p-2 hover:bg-white/10 rounded-full text-white transition-colors hidden sm:block">
                        <Info className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Offline Message Indicator */}
            {otherUser && !isUserActive(otherUser.lastSeen) && (hasMounted) && (
                <div className="flex-none bg-zinc-900 border-b border-gray-800 px-4 py-2 text-center">
                    <p className="text-[11px] text-gray-400 font-medium tracking-tight">
                        {otherUser.displayName || otherUser.username} is currently offline. Calls are disabled.
                    </p>
                </div>
            )}

            {/* Messages Container - Flex-1 (Grows to fill space) */}
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

                        return (
                            <div 
                                key={msg.id} 
                                id={`msg-${msg.id}`} // Unique ID for smart scrolling
                                className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                            >
                                <div 
                                    className={cn(
                                        "max-w-[85%] sm:max-w-[75%] px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl select-none touch-none shadow-sm",
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
                                    <p className="text-[14px] sm:text-[15px] whitespace-pre-wrap break-words leading-relaxed">
                                        {msg.text}
                                    </p>
                                    {msg.isEdited && (
                                        <span className="text-[10px] opacity-60 block mt-1">(edited)</span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
                {/* Visual anchor for scrolling */}
                <div className="h-2 w-full" />
                <div ref={scrollRef} className="h-1" />
            </div>

            {/* Input Area - FLEX-NONE (Stays at bottom) */}
            <div className="flex-none bg-black border-t border-gray-800 pb-[env(safe-area-inset-bottom)] z-[30] relative overflow-visible">
                
                {/* Floating Typing Indicator Bubble - specifically for mobile keyboard visibility */}
                {otherUserIsTyping && (
                    <div className="sm:hidden absolute -top-12 left-4 z-[40] animate-in slide-in-from-bottom-2 duration-300 pointer-events-none">
                        <div className="bg-[#202327]/95 border border-twitter-blue/40 rounded-full px-3 py-1.5 flex items-center gap-2 shadow-2xl backdrop-blur-md">
                            <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white uppercase overflow-hidden shrink-0">
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

                {/* Media Previews */}
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

                {editingMessageId && (
                    <div className="flex items-center justify-between px-4 py-2 bg-twitter-blue/10 border-b border-twitter-blue/20">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <ShieldAlert className="w-4 h-4 text-twitter-blue shrink-0" />
                            <p className="text-xs text-twitter-blue font-bold truncate">Editing message...</p>
                        </div>
                        <button 
                            onClick={() => { setEditingMessageId(null); setNewMessage(""); }}
                            className="p-1 hover:bg-twitter-blue/20 rounded-full transition"
                        >
                            <X className="w-4 h-4 text-twitter-blue" />
                        </button>
                    </div>
                )}

                <form onSubmit={handleSendMessage} className="p-3 flex items-center gap-2">
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
                            <button type="button" onClick={cancelRecording} className="text-gray-500 hover:text-white font-bold text-sm transition text-nowrap">Cancel</button>
                            <button type="button" onClick={stopRecording} className="bg-twitter-blue hover:brightness-110 text-black p-1.5 rounded-full"><Send className="w-4 h-4 fill-current" /></button>
                        </div>
                    ) : (
                        <>
                            <input id="chat-file-input" type="file" accept="image/*,video/*" multiple className="hidden" ref={fileInputRef} onChange={handleMediaSelect} />
                            <label htmlFor="chat-file-input" className="p-2 hover:bg-twitter-blue/10 rounded-full text-twitter-blue transition cursor-pointer shrink-0"><Image className="w-5 h-5" /></label>
                            <button type="button" onClick={startRecording} className="p-2 hover:bg-twitter-blue/10 rounded-full text-twitter-blue transition shrink-0"><Mic className="w-5 h-5" /></button>
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => {
                                    setNewMessage(e.target.value);
                                    if (user?.uid && conversationId) {
                                        updateDoc(doc(db, "conversations", conversationId), { [`typing.${user.uid}`]: true }).catch(() => {});
                                        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                                        typingTimeoutRef.current = setTimeout(() => {
                                            updateDoc(doc(db, "conversations", conversationId), { [`typing.${user.uid}`]: false }).catch(() => {});
                                        }, 4000);
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

            {/* Offline Calls Overlay */}
            {showOfflineOverlay && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-zinc-900 border border-gray-800 rounded-3xl p-6 w-full max-w-xs text-center shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Phone className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">User Offline</h3>
                        <p className="text-gray-400 text-sm mb-6">
                            You can only call {otherUser?.displayName || otherUser?.username} when they are "Active now".
                        </p>
                        <button 
                            onClick={() => setShowOfflineOverlay(false)}
                            className="w-full bg-white text-black font-bold py-3 rounded-full hover:bg-gray-200 transition active:scale-95"
                        >
                            Got it
                        </button>
                    </div>
                </div>
            )}

            {/* Global Delete Action Sheet Overlay - Absolute within locked viewport to stay above keyboard */}
            {deleteMenuMessageId && (
                <div 
                    className="absolute inset-0 z-[250] bg-black/60 flex items-center justify-center p-6 animate-in fade-in duration-200"
                    onClick={() => setDeleteMenuMessageId(null)}
                >
                    <div 
                        className="w-full max-w-xs bg-[#15181c] rounded-3xl border border-gray-800 overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 text-center">
                            <h3 className="text-white font-bold text-lg mb-1">Message Options</h3>
                            <p className="text-gray-500 text-sm">Choose an action for this message.</p>
                        </div>
                        
                        <div className="flex flex-col border-t border-gray-800 font-bold">
                            {messages.find(m => m.id === deleteMenuMessageId)?.senderId === user?.uid && (
                                <>
                                    <button 
                                        onClick={() => handleStartEdit(deleteMenuMessageId, messages.find(m => m.id === deleteMenuMessageId)?.text || "")}
                                        className="w-full py-4 text-[var(--color-twitter-blue)] hover:bg-black/40 transition border-b border-gray-800 active:bg-black flex items-center justify-center gap-2"
                                    >
                                        <Edit className="w-4 h-4" />
                                        Edit Message
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteForBoth(deleteMenuMessageId)}
                                        className="w-full py-4 text-red-500 hover:bg-black/40 transition border-b border-gray-800 active:bg-black"
                                    >
                                        Delete for everyone
                                    </button>
                                </>
                            )}
                            
                            <button 
                                onClick={() => handleDeleteForMe(deleteMenuMessageId)}
                                className="w-full py-4 text-white hover:bg-black/40 transition border-b border-gray-800 active:bg-black"
                            >
                                Delete for me
                            </button>
                            
                            <button 
                                onClick={() => setDeleteMenuMessageId(null)}
                                className="w-full py-4 text-gray-400 hover:bg-black/40 transition active:bg-black"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Notification Toast */}
            {toast && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[300] animate-in slide-in-from-top-4 duration-300 pointer-events-none">
                    <div className="bg-twitter-blue text-white px-4 py-2 rounded-full font-bold shadow-2xl flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 fill-white text-twitter-blue" />
                        {toast}
                    </div>
                </div>
            )}
        </div>
    );
}
