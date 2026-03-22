"use client";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, getDoc, doc, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { Search, Edit, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { userCache } from "@/lib/cache";
import Avatar from "@/components/ui/Avatar";

export default function ConversationList({ activeId }: { activeId?: string }) {
    const { user } = useAuth();
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearch, setShowSearch] = useState(false);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, "conversations"),
            where("participants", "array-contains", user.uid)
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            try {
                const convs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                const convsWithUsers = await Promise.all(convs.map(async (conv: any) => {
                    const otherId = conv.participants.find((p: string) => p !== user.uid);
                    if (otherId) {
                        const otherUser = await userCache.fetchUser(otherId);
                        return { ...conv, otherUser };
                    }
                    return { ...conv, otherUser: null };
                }));

                const sorted = convsWithUsers.sort((a, b) => {
                    const timeA = a.lastTimestamp?.seconds || 0;
                    const timeB = b.lastTimestamp?.seconds || 0;
                    return timeB - timeA;
                });

                setConversations(sorted);
            } catch (error) {
                console.error("Conversation list error:", error);
            } finally {
                setLoading(false);
            }
        }, (error) => {
            console.error("Conversation list snapshot error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        const searchUsers = async () => {
            if (!searchTerm.trim()) {
                setSearchResults([]);
                return;
            }
            setIsSearching(true);
            try {
                const q = query(
                    collection(db, "users"),
                    where("username", ">=", searchTerm.toLowerCase()),
                    where("username", "<=", searchTerm.toLowerCase() + "\uf8ff")
                );
                const snapshot = await getDocs(q);
                const users = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(u => u.id !== user?.uid);
                setSearchResults(users);
            } catch (error) {
                console.error("Search error:", error);
            } finally {
                setIsSearching(false);
            }
        };

        const timeoutId = setTimeout(searchUsers, 300);
        return () => clearTimeout(timeoutId);
    }, [searchTerm, user]);

    const handleStartChat = async (targetUserId: string) => {
        if (!user) return;
        const ids = [user.uid, targetUserId].sort();
        const conversationId = ids.join("_");
        const convRef = doc(db, "conversations", conversationId);

        try {
            const convDoc = await getDoc(convRef);
            if (!convDoc.exists()) {
                await setDoc(convRef, {
                    participants: [user.uid, targetUserId],
                    lastMessage: "",
                    lastTimestamp: serverTimestamp(),
                    createdAt: serverTimestamp(),
                    unreadCount: {
                        [user.uid]: 0,
                        [targetUserId]: 0
                    }
                });
            }
            setSearchTerm("");
            setSearchResults([]);
            setShowSearch(false);
        } catch (error) {
            console.error("Error starting chat:", error);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-black">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-black/90 backdrop-blur-md border-b border-gray-800">
                {showSearch ? (
                    <div className="flex items-center gap-3 p-3 px-4">
                        <button onClick={() => { setShowSearch(false); setSearchTerm(""); }} className="p-1 hover:bg-white/10 rounded-full transition">
                            <ArrowLeft className="w-5 h-5 text-white" />
                        </button>
                        <div className="flex-grow relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                autoFocus
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search people..."
                                className="w-full bg-[#202327] rounded-full py-2 pl-10 pr-4 outline-none focus:ring-1 focus:ring-[var(--color-twitter-blue)] transition text-white text-[15px]"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-between px-4 py-3 h-[53px]">
                        <h1 className="text-xl font-extrabold text-white">Messages</h1>
                        <button
                            onClick={() => setShowSearch(true)}
                            className="p-2 hover:bg-white/10 rounded-full transition text-[var(--color-twitter-blue)]"
                            title="New message"
                        >
                            <Edit className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Search bar (always visible below) */}
            {!showSearch && (
                <div className="px-4 py-2 bg-black border-b border-gray-800/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); if (!showSearch) setShowSearch(true); }}
                            onFocus={() => setShowSearch(true)}
                            placeholder="Search Direct Messages"
                            className="w-full bg-[#202327] rounded-full py-2 pl-10 pr-4 outline-none focus:ring-1 focus:ring-[var(--color-twitter-blue)] transition text-white text-sm"
                        />
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="flex-grow overflow-y-auto">
                {showSearch && searchTerm.trim() ? (
                    <div>
                        {isSearching ? (
                            <div className="p-8 text-center">
                                <div className="w-6 h-6 rounded-full border-2 border-[var(--color-twitter-blue)] border-t-transparent animate-spin mx-auto"></div>
                            </div>
                        ) : searchResults.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <p className="font-bold text-white text-lg mb-1">No results for "{searchTerm}"</p>
                                <p className="text-sm">Try searching for a different username.</p>
                            </div>
                        ) : (
                            searchResults.map((u: any) => {
                                const ids = [user?.uid, u.id].sort();
                                const conversationId = ids.join("_");
                                return (
                                    <Link
                                        key={u.id}
                                        href={`/messages/${conversationId}`}
                                        onClick={() => handleStartChat(u.id)}
                                        className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition"
                                    >
                                        <Avatar src={u.profileImage} fallbackText={u.displayName || u.username} size="lg" />
                                        <div className="flex flex-col truncate min-w-0">
                                            <span className="font-bold text-white truncate text-[15px]">{u.displayName || u.username}</span>
                                            <span className="text-gray-500 text-sm truncate">@{u.username}</span>
                                        </div>
                                    </Link>
                                );
                            })
                        )}
                    </div>
                ) : loading ? (
                    <div className="p-8 text-center">
                        <div className="w-6 h-6 rounded-full border-2 border-[var(--color-twitter-blue)] border-t-transparent animate-spin mx-auto"></div>
                    </div>
                ) : conversations.length === 0 ? (
                    <div className="p-10 text-center flex flex-col items-center gap-3 mt-8">
                        <p className="text-2xl font-extrabold text-white">Welcome to your inbox!</p>
                        <p className="text-gray-500 text-[15px] max-w-[250px] leading-relaxed">
                            Drop a line, share posts and more with private conversations between you and others.
                        </p>
                        <button
                            onClick={() => setShowSearch(true)}
                            className="mt-2 px-5 py-2.5 bg-[var(--color-twitter-blue)] hover:bg-[#1a8cd8] text-white font-bold rounded-full transition text-[15px]"
                        >
                            Start a conversation
                        </button>
                    </div>
                ) : (
                    conversations.map((conv) => {
                        const otherUser = conv.otherUser;
                        const isActive = activeId === conv.id;
                        return (
                            <Link
                                key={conv.id}
                                href={`/messages/${conv.id}`}
                                className={`flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition border-l-2 ${isActive ? 'border-[var(--color-twitter-blue)] bg-[var(--color-twitter-blue)]/5' : 'border-transparent'}`}
                            >
                                <div className="shrink-0">
                                    <Avatar src={otherUser?.profileImage} fallbackText={otherUser?.displayName || otherUser?.username} size="lg" />
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <div className="flex justify-between items-baseline gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className={`font-bold truncate text-[15px] ${isActive ? 'text-white' : 'text-white'}`}>
                                                {otherUser?.displayName || otherUser?.username || "Unknown"}
                                            </span>
                                            {user && conv.unreadCount && conv.unreadCount[user.uid] > 0 && (
                                                <div className="w-2 h-2 rounded-full bg-[var(--color-twitter-blue)] shrink-0"></div>
                                            )}
                                        </div>
                                        <span className="text-gray-500 text-[13px] shrink-0">
                                            {conv.lastTimestamp?.toDate ? formatDistanceToNow(conv.lastTimestamp.toDate(), { addSuffix: false }) : 'now'}
                                        </span>
                                    </div>
                                    <p className="text-gray-500 text-[14px] truncate leading-tight">
                                        {conv.lastMessage || <span className="italic">No messages yet</span>}
                                    </p>
                                </div>
                            </Link>
                        );
                    })
                )}
            </div>
        </div>
    );
}
