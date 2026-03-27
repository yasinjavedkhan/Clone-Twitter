"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, limit, where } from "firebase/firestore";
import { Search } from "lucide-react";
import Link from "next/link";

interface UserData {
    id: string;
    userId: string;
    displayName: string;
    username: string;
    profileImage?: string;
}

export default function Explore() {
    const { user } = useAuth();
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const fetchGlobalData = async () => {
            try {
                // Fetch Users only (Top 500 for fast local filtering)
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

    const queryStr = searchQuery.toLowerCase().trim();
    
    // Filter Users
    const filteredUsers = !queryStr ? [] : users.filter(u => 
        u.displayName?.toLowerCase().includes(queryStr) || 
        u.username?.toLowerCase().includes(queryStr)
    );

    return (
        <div className="flex flex-col min-h-screen border-r border-gray-800 text-white">
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800 p-4">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-4.5 h-4.5" />
                    <input
                        type="text"
                        placeholder="Search People (v3)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-[#202327] text-white rounded-full py-2.5 pl-12 pr-4 w-full focus:bg-black focus:border-twitter-blue border border-transparent outline-none transition text-[15px] placeholder:text-gray-500"
                    />
                </div>
            </div>

            <div className="flex flex-col">
                {loading ? (
                    <div className="p-8 text-center text-gray-500 italic">Finding the best content for you...</div>
                ) : !queryStr ? (
                    <div className="p-12 text-center text-gray-500">
                        <div className="bg-twitter-blue/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-8 h-8 text-twitter-blue" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Explore the conversation</h2>
                        <p className="text-sm text-gray-500 max-w-xs mx-auto">
                            Search for people, topics, or keywords to find what you're looking for.
                        </p>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 italic">
                        No users found for "{searchQuery}"
                    </div>
                ) : (
                    <div className="flex flex-col divide-y divide-gray-800">
                        {/* User Results */}
                        {filteredUsers.map(u => (
                            <Link 
                                key={u.id} 
                                href={`/profile/${u.userId}`}
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
