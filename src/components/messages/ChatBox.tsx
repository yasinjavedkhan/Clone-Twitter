"use client";

import { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Send, Image, User } from "lucide-react";
import { format } from "date-fns";
import { sendPushNotification } from "@/lib/notifications";

export default function ChatBox({ conversationId }: { conversationId: string }) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [otherUser, setOtherUser] = useState<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

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
                            setOtherUser(userDoc.data());
                        }
                    }
                }
            } catch (error) {
                console.error("Error fetching other user:", error);
            }
        };
        fetchOtherUser();
    }, [conversationId, user]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user) return;

        const text = newMessage.trim();
        setNewMessage("");

        try {
            // 1. Add message
            await addDoc(collection(db, "conversations", conversationId, "messages"), {
                senderId: user.uid,
                text,
                read: false,
                createdAt: serverTimestamp(),
            });

            // 2. Update conversation last message
            const otherId = conversationId.replace(user.uid, "").replace("_", "");
            await updateDoc(doc(db, "conversations", conversationId), {
                lastMessage: text,
                lastTimestamp: serverTimestamp(),
                [`unreadCount.${otherId}`]: increment(1)
            });

            // 3. Send push notification to the other user
            if (otherUser?.userId) {
                const senderName = (user as any).displayName || user.email?.split('@')[0] || 'Someone';
                await sendPushNotification({
                    toUserId: otherUser.userId,
                    title: `💬 ${senderName}`,
                    body: text.length > 80 ? text.substring(0, 80) + '...' : text,
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
        }
    };

    return (
        <div className="flex flex-col h-screen flex-grow border-r border-gray-800 bg-black">
            {/* Header */}
            <div className="p-4 border-b border-gray-800 flex items-center gap-4 bg-black/80 backdrop-blur sticky top-0 z-10">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0 font-bold text-white uppercase overflow-hidden text-lg">
                    {otherUser?.profileImage ? (
                        <img src={otherUser.profileImage} className="w-full h-full rounded-full object-cover" alt="Avatar" />
                    ) : (
                        (otherUser?.displayName || otherUser?.username || "?")[0]
                    )}
                </div>
                <div className="flex flex-col min-w-0">
                    <h2 className="font-bold text-white text-[17px] leading-tight truncate">
                        {otherUser?.displayName || otherUser?.username || (conversationId ? "..." : "Select a chat")}
                    </h2>
                    {otherUser?.username && (
                        <p className="text-gray-500 text-[13px] truncate">@{otherUser.username}</p>
                    )}
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-3">
                {messages.map((msg) => {
                    const isMe = msg.senderId === user?.uid;
                    return (
                        <div
                            key={msg.id}
                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                            <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-[15px] ${isMe
                                ? 'bg-twitter-blue text-black rounded-br-none'
                                : 'bg-[#2f3336] text-white rounded-bl-none'
                                }`}>
                                {msg.text}
                            </div>
                            <span className="text-gray-500 text-[11px] mt-1 px-1 flex items-center">
                                {msg.createdAt?.toDate ? format(msg.createdAt.toDate(), 'p') : '...'}
                                {isMe && (
                                    <span className={`font-bold ml-1.5 flex items-center gap-0.5 ${msg.read ? 'text-twitter-blue' : 'text-gray-500'}`}>
                                        <div className={`w-1 h-1 rounded-full ${msg.read ? 'bg-twitter-blue' : 'bg-gray-500'}`}></div>
                                        {msg.read ? 'Seen' : 'Sent'}
                                    </span>
                                )}
                            </span>
                        </div>
                    );
                })}
                <div ref={scrollRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-800 flex items-center gap-2 sticky bottom-0 bg-black">
                <button type="button" className="p-2 hover:bg-twitter-blue/10 rounded-full text-twitter-blue transition">
                    <Image className="w-5 h-5" />
                </button>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Start a new message"
                    className="flex-grow bg-[#202327] rounded-2xl py-2 px-4 outline-none focus:ring-1 focus:ring-twitter-blue transition text-[15px]"
                />
                <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="p-2 hover:bg-twitter-blue/10 rounded-full text-twitter-blue transition disabled:opacity-50"
                >
                    <Send className="w-5 h-5" />
                </button>
            </form>
        </div>
    );
}
