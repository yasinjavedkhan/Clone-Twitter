"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, limit, where } from "firebase/firestore";
import { Search } from "lucide-react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";

interface UserData {
    id: string;
    userId: string;
    displayName: string;
    username: string;
    profileImage?: string;
}

export default function Explore() {
    const { user, userData } = useAuth();
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [recentUsers, setRecentUsers] = useState<UserData[]>([]);

    useEffect(() => {
        // Load recents from localStorage
        const saved = localStorage.getItem("recent_searches");
        if (saved) {
            try { setRecentUsers(JSON.parse(saved)); } catch (e) { console.error(e); }
        }

        const fetchGlobalData = async () => {
            try {
                const usersQuery = query(
                    collection(db, "users"),
                    limit(500)
                );
                const usersSnap = await getDocs(usersQuery);
                const usersData = usersSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as UserData[];
                setUsers(usersData);
            } catch (error) {
                console.error("Error fetching explore users:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchGlobalData();
    }, []);

    const addToRecents = (u: UserData) => {
        const newRecents = [u, ...recentUsers.filter(r => r.userId !== u.userId)].slice(0, 10);
        setRecentUsers(newRecents);
        localStorage.setItem("recent_searches", JSON.stringify(newRecents));
    };

    const clearRecents = () => {
        setRecentUsers([]);
        localStorage.removeItem("recent_searches");
    };

    const queryStr = searchQuery.toLowerCase().trim();
    
    // Filter Users
    const filteredUsers = !queryStr ? [] : users.filter(u => 
        u.displayName?.toLowerCase().includes(queryStr) || 
        u.username?.toLowerCase().includes(queryStr)
    );

    return (
        <div className="flex flex-col min-h-screen border-r border-gray-800 text-white">
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800 p-3 flex items-center gap-3">
                {user && (
                    <button 
                        onClick={() => window.dispatchEvent(new CustomEvent("toggleMobileDrawer"))}
                        className="sm:hidden p-0.5 rounded-full active:bg-white/10 transition cursor-pointer shrink-0"
                    >
                        <Avatar
                            src={userData?.profileImage}
                            fallbackText={userData?.displayName || userData?.username}
                            size="md"
                        />
                    </button>
                )}
                <div className="relative flex-grow">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search People"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-[#202327] text-white rounded-full py-2 pl-12 pr-4 w-full focus:bg-black focus:border-twitter-blue border border-transparent outline-none transition text-[15px] placeholder:text-gray-500"
                    />
                </div>
            </div>

            <div className="flex flex-col">
                {loading && users.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 italic">Exploring...</div>
                ) : !queryStr ? (
                    <div className="flex flex-col">
                        {recentUsers.length > 0 ? (
                            <>
                                <div className="p-4 pb-2 flex items-center justify-between">
                                    <h3 className="font-bold text-xl">Recent</h3>
                                    <button 
                                        onClick={clearRecents}
                                        className="text-twitter-blue text-sm hover:underline"
                                    >
                                        Clear all
                                    </button>
                                </div>
                                <div className="flex flex-col divide-y divide-gray-800">
                                    {recentUsers.map(u => (
                                        <Link 
                                            key={`recent-${u.id}`} 
                                            href={`/profile/${u.userId}`}
                                            className="p-4 hover:bg-white/5 transition flex items-center gap-3"
                                        >
                                            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-800 shrink-0">
                                                {u.profileImage ? (
                                                    <img src={u.profileImage} alt={u.displayName} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                                                        <Search className="w-5 h-5 opacity-30" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col flex-grow truncate">
                                                <span className="font-bold text-white truncate">{u.displayName}</span>
                                                <span className="text-gray-500 text-sm truncate">@{u.username}</span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="p-12 text-center text-gray-500">
                                <div className="bg-twitter-blue/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Search className="w-8 h-8 text-twitter-blue" />
                                </div>
                                <h2 className="text-xl font-bold text-white mb-2">Explore the conversation</h2>
                                <p className="text-sm text-gray-500 max-w-xs mx-auto">
                                    Search for people, topics, or keywords to find what you're looking for.
                                </p>
                            </div>
                        )}
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 italic">
                        No users found for "{searchQuery}"
                    </div>
                ) : (
                    <div className="flex flex-col divide-y divide-gray-800">
                        {filteredUsers.map(u => (
                            <Link 
                                key={u.id} 
                                href={`/profile/${u.userId}`}
                                onClick={() => addToRecents(u)}
                                className="p-4 hover:bg-white/5 transition flex items-center gap-3"
                            >
                                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-800 shrink-0">
                                    {u.profileImage ? (
                                        <img src={u.profileImage} alt={u.displayName} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-700">
                                            <Search className="w-5 h-5 opacity-30" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-white hover:underline">{u.displayName}</span>
                                    <span className="text-gray-500 text-sm">@{u.username}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
