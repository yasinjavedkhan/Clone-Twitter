"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, setDoc, deleteDoc, getDoc, collection, query, where, getDocs, updateDoc, increment, limit } from "firebase/firestore";
import { userCache } from "@/lib/cache";
import Avatar from "@/components/ui/Avatar";

export default function RightSidebar() {
    const { user } = useAuth();
    const pathname = usePathname();
    const [searchQuery, setSearchQuery] = useState("");
    const [following, setFollowing] = useState<Record<string, boolean>>({});
    const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;

            // Fetch following status
            const followsRef = collection(db, "follows");
            const qFollows = query(followsRef, where("followerId", "==", user.uid));
            const followSnapshot = await getDocs(qFollows);
            const followingMap: Record<string, boolean> = {};
            followSnapshot.forEach(doc => {
                followingMap[doc.data().followingId] = true;
            });
            setFollowing(followingMap);

            // Fetch some real users - added limit for performance
            const usersRef = collection(db, "users");
            const qUsers = query(usersRef, limit(10));
            const userSnapshot = await getDocs(qUsers);
            const users = userSnapshot.docs.map(doc => {
                const data = doc.data();
                userCache.set(doc.id, data); // Prime cache
                return { id: doc.id, ...data };
            });
            setSuggestedUsers(users);
        };
        fetchData();
    }, [user]);

    const handleFollow = async (targetId: string) => {
        if (!user) {
            alert("Please login to follow users!");
            return;
        }

        const followId = `${user.uid}_${targetId}`;
        const followRef = doc(db, "follows", followId);
        const followerRef = doc(db, "users", user.uid);
        const followingRef = doc(db, "users", targetId);

        try {
            if (following[targetId]) {
                await deleteDoc(followRef);
                await updateDoc(followerRef, { followingCount: increment(-1) });
                await updateDoc(followingRef, { followersCount: increment(-1) });
                setFollowing(prev => ({ ...prev, [targetId]: false }));
            } else {
                await setDoc(followRef, {
                    followerId: user.uid,
                    followingId: targetId,
                    createdAt: new Date().toISOString()
                });
                await updateDoc(followerRef, { followingCount: increment(1) });
                await updateDoc(followingRef, { followersCount: increment(1) });
                setFollowing(prev => ({ ...prev, [targetId]: true }));
            }
        } catch (error) {
            console.error("Error toggling follow:", error);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            alert(`Searching for: ${searchQuery}`);
        }
    };
    return (
        <aside className="hidden lg:block w-[350px] pl-8 py-3 sticky top-0 h-screen overflow-y-auto hidden-scrollbar">
            {pathname !== "/" && (
                <>
                    {/* Search Bar */}
                    <form onSubmit={handleSearch} className="relative mb-3 sticky top-0 bg-[var(--tw-bg-main)] py-1 z-10 transition-colors">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[var(--tw-text-muted)] w-4.5 h-4.5" />
                        <input
                            type="text"
                            placeholder="Search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-[var(--tw-input-bg)] text-[var(--tw-text-main)] rounded-full py-2.5 pl-12 pr-4 w-full focus:bg-[var(--tw-bg-main)] focus:border-[var(--color-twitter-blue)] border border-[var(--tw-border-main)] outline-none transition text-[15px] placeholder:text-[var(--tw-text-muted)]"
                        />
                    </form>

                    {/* Trending Box - Only show if there's any content (customizable later) */}
                    <div className="bg-[var(--tw-bg-card)] rounded-2xl overflow-hidden mb-4 p-4 border border-[var(--tw-border-main)]">
                        <h2 className="font-extrabold text-xl mb-4 text-[var(--tw-text-main)]">What's happening</h2>
                        <p className="text-[var(--tw-text-muted)] text-[15px]">No trending topics right now. Check back later!</p>
                    </div>

                    {/* Who to follow */}
                    {suggestedUsers.length > 0 && (
                        <div className="bg-[var(--tw-bg-card)] rounded-2xl overflow-hidden border border-[var(--tw-border-main)]">
                            <h2 className="font-extrabold text-xl px-4 py-3 text-[var(--tw-text-main)]">Who to follow</h2>

                            {suggestedUsers.filter(u => {
                                const isQuery = searchQuery.trim().toLowerCase();
                                if (!u) return false;
                                const nameMatch = (u.displayName || u.username || "").toLowerCase().includes(isQuery);

                                // If searching, show everyone who matches
                                if (isQuery) return nameMatch;

                                // If not searching, show 3 random users (not including self)
                                return u.id !== user?.uid;
                            }).slice(0, searchQuery ? 10 : 3).map((u) => (
                                <div key={u.id} className="flex items-center justify-between hover:bg-[var(--tw-text-main)]/5 px-4 py-3 cursor-pointer transition border-b border-[var(--tw-border-main)] last:border-0">
                                    <Link href={`/profile/${u.id}`} className="flex items-center gap-3 overflow-hidden flex-grow">
                                        <Avatar
                                            src={u.profileImage}
                                            fallbackText={u.displayName || u.username}
                                        />
                                        <div className="flex flex-col truncate">
                                            <p className="font-bold text-[var(--tw-text-main)] text-[15px] truncate hover:underline">{u.displayName || u.username}</p>
                                            <p className="text-[var(--tw-text-muted)] text-[15px] truncate">@{u.username || u.handle}</p>
                                        </div>
                                    </Link>
                                    {u.id !== user?.uid && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleFollow(u.id);
                                            }}
                                            className={`${following[u.id]
                                                ? "border border-[var(--tw-border-main)] text-[var(--tw-text-main)] hover:border-red-600 hover:text-red-500 hover:after:content-['Unfollow'] after:content-['Following']"
                                                : "bg-[var(--tw-text-main)] text-[var(--tw-bg-main)] hover:opacity-90"
                                                } font-bold text-[14px] px-4 py-1.5 rounded-full transition shrink-0 min-w-[80px] ml-4`}
                                        >
                                            {!following[u.id] && "Follow"}
                                        </button>
                                    )}
                                </div>
                            ))}

                            <button className="text-[var(--color-twitter-blue)] px-4 py-4 hover:bg-white/5 w-full text-left transition text-[15px]">
                                Show more
                            </button>
                        </div>
                    )}

                    <div className="text-[#71767b] text-[13px] mt-4 flex gap-x-3 gap-y-1 flex-wrap px-4 pb-8 leading-tight">
                        <a href="#" className="hover:underline">Terms of Service</a>
                        <a href="#" className="hover:underline">Privacy Policy</a>
                        <a href="#" className="hover:underline">Ads info</a>
                        <a href="#" className="hover:underline">Accessibility</a>
                        <span>© 2025 X Corp.</span>
                    </div>
                </>
            )}
        </aside>
    );
}
