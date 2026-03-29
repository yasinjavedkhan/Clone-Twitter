"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Send, Image, User, Phone, Video, X, Mic, MicOff, VideoOff, Maximize2, Minimize2, MoreHorizontal, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { sendPushNotification } from "@/lib/notifications";
import AgoraCall from "./AgoraCall";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import { deleteDoc, arrayUnion } from "firebase/firestore";

export default function ChatBox({ conversationId }: { conversationId: string }) {
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
    const [deleteMenuMessageId, setDeleteMenuMessageId] = useState<string | null>(null);

    useEffect(() => {
        // Check for call in query params
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            if (params.get('call') === 'true') {
                const type = params.get('type') as any;
                const rName = params.get('room');
                if (type) setCallType(type);
                if (rName) setRoomName(rName);
                setIsCalling(true);
            }
        }
    }, [conversationId]);

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

    // Fetch other user info
    useEffect(() => {
        if (!conversationId || !user) return;

        const fetchOtherUser = async () => {
            try {
                const convDoc = await getDoc(doc(db, "conversations", conversationId));
                if (convDoc.exists()) {
                    const participants = convDoc.data().participants;
                    const otherId = participants.find((p: string) => p !== user.uid);
                    if (otherId) {
                        const userDoc = await getDoc(doc(db, "users", otherId));
                        if (userDoc.exists()) {
                            setOtherUser({ userId: userDoc.id, ...userDoc.data() });
                        }
                    } else {
                        // Self chat
                        const userDoc = await getDoc(doc(db, "users", user.uid));
                        if (userDoc.exists()) {
                            setOtherUser({ userId: userDoc.id, ...userDoc.data(), isSelf: true });
                        }
                    }
                }
            } catch (error) {
                console.error("Error fetching other user:", error);
            }
        };
        fetchOtherUser();
    }, [conversationId, user]);

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
                        {otherUser?.username && (
                            <p className="text-gray-500 text-[12px] sm:text-[13px] truncate">@{otherUser.username}</p>
                        )}
                    </div>
                </Link>
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <button 
                        onClick={async () => { 
                            const generatedRoom = `DirectCall_${Math.random().toString(36).substring(2, 11)}_${Math.random().toString(36).substring(2, 11)}`;
                            setCallType('voice'); 
                            setRoomName(generatedRoom);
                            setIsCalling(true);
                            // 1. Record in chat history
                            await recordCallEvent('voice');
                            // 2. Signal
                            if (otherUser?.userId) {
                                await sendPushNotification({
                                    toUserId: otherUser.userId,
                                    title: "Incoming Voice Call",
                                    body: `${user?.displayName || 'Someone'} is calling...`,
                                    data: {
                                        type: 'call',
                                        callType: 'voice',
                                        conversationId,
                                        roomName: generatedRoom,
                                        fromUserName: user?.displayName || user?.email?.split('@')[0] || 'Someone',
                                        fromUserAvatar: (user as any)?.profileImage || ''
                                    }
                                });
                            }
                        }}
                        className="p-2.5 hover:bg-white/10 rounded-full text-twitter-blue transition-all duration-200"
                        title="Audio Call"
                    >
                        <Phone className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={async () => { 
                            const generatedRoom = `DirectCall_${Math.random().toString(36).substring(2, 11)}_${Math.random().toString(36).substring(2, 11)}`;
                            setCallType('video'); 
                            setRoomName(generatedRoom);
                            setIsCalling(true);
                            // 1. Record in chat history
                            await recordCallEvent('video');
                            // 2. Signal
                            if (otherUser?.userId) {
                                await sendPushNotification({
                                    toUserId: otherUser.userId,
                                    title: "Incoming Video Call",
                                    body: `${user?.displayName || 'Someone'} is video calling...`,
                                    data: {
                                        type: 'call',
                                        callType: 'video',
                                        conversationId,
                                        roomName: generatedRoom,
                                        fromUserName: user?.displayName || user?.email?.split('@')[0] || 'Someone',
                                        fromUserAvatar: (user as any)?.profileImage || ''
                                    }
                                });
                            }
                        }}
                        className="p-2.5 hover:bg-white/10 rounded-full text-twitter-blue transition-all duration-200"
                        title="Video Call"
                    >
                        <Video className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Real Call Overlay (Agora) */}
            {isCalling && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col">
                    <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-black">
                        <h3 className="text-white font-bold">Call with {otherUser?.displayName || "User"}</h3>
                        <button 
                            onClick={() => setIsCalling(false)}
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full font-bold transition flex items-center gap-2"
                        >
                            <X className="w-5 h-5" /> End Call
                        </button>
                    </div>
                    <AgoraCall 
                        roomName={roomName} 
                        callType={callType} 
                        onEndCall={() => setIsCalling(false)} 
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
                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}
                        >
                            <div className="relative flex items-center group/bubble">
                                {isMe && !isSystemMessage && (
                                    <div className="opacity-0 group-hover/bubble:opacity-100 transition-opacity mr-2">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteMenuMessageId(deleteMenuMessageId === msg.id ? null : msg.id);
                                            }}
                                            className="p-1 hover:bg-white/10 rounded-full text-gray-500"
                                        >
                                            <MoreHorizontal className="w-4 h-4" />
                                        </button>
                                        
                                        {deleteMenuMessageId === msg.id && (
                                            <div className="absolute bottom-full right-0 mb-2 w-48 bg-[#15181c] border border-gray-800 rounded-xl shadow-2xl z-[150] overflow-hidden animate-in fade-in zoom-in duration-200">
                                                <button 
                                                    onClick={() => handleDeleteForMe(msg.id)}
                                                    className="w-full text-left px-4 py-3 text-[14px] text-white hover:bg-white/5 flex items-center gap-2"
                                                >
                                                    <Trash2 className="w-4 h-4 text-gray-400" /> Delete for me
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteForBoth(msg.id)}
                                                    className="w-full text-left px-4 py-3 text-[14px] text-red-500 hover:bg-red-500/10 border-t border-gray-800 flex items-center gap-2"
                                                >
                                                    <Trash2 className="w-4 h-4" /> Delete for both
                                                </button>
                                            </div>
                                        )}
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
                                    <div className="opacity-0 group-hover/bubble:opacity-100 transition-opacity ml-2">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteMenuMessageId(deleteMenuMessageId === msg.id ? null : msg.id);
                                            }}
                                            className="p-1 hover:bg-white/10 rounded-full text-gray-500"
                                        >
                                            <MoreHorizontal className="w-4 h-4" />
                                        </button>
                                        
                                        {deleteMenuMessageId === msg.id && (
                                            <div className="absolute bottom-full left-0 mb-2 w-40 bg-[#15181c] border border-gray-800 rounded-xl shadow-2xl z-[150] overflow-hidden animate-in fade-in zoom-in duration-200">
                                                <button 
                                                    onClick={() => handleDeleteForMe(msg.id)}
                                                    className="w-full text-left px-4 py-3 text-[14px] text-white hover:bg-white/5 flex items-center gap-2"
                                                >
                                                    <Trash2 className="w-4 h-4 text-gray-400" /> Delete for me
                                                </button>
                                            </div>
                                        )}
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
        </div>
    );
}
