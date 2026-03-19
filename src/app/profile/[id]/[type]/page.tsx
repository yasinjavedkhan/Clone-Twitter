"use client";

import { useState, useEffect, use } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc, updateDoc, increment } from "firebase/firestore";
import Link from "next/link";
import { ArrowLeft, User, Search } from "lucide-react";

export default function FollowPage({ params }: { params: Promise<{ id: string, type: string }> }) {
    const { id: profileId, type } = use(params);
    const { user: currentUser } = useAuth();

    const [profileUser, setProfileUser] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);

    const isFollowingPage = type === "following";

    useEffect(() => {
        const fetchProfileAndList = async () => {
            if (!profileId) return;
            setLoading(true);

            try {
                // 1. Fetch Profile User details for header
                const pDoc = await getDoc(doc(db, "users", profileId));
                if (pDoc.exists()) {
                    setProfileUser(pDoc.data());
                }

                // 2. Fetch Follow Relationship IDs for this profile
                const followsRef = collection(db, "follows");
                const q = isFollowingPage
                    ? query(followsRef, where("followerId", "==", profileId))
                    : query(followsRef, where("followingId", "==", profileId));

                const followsSnap = await getDocs(q);
                const userIds = followsSnap.docs.map(doc =>
                    isFollowingPage ? doc.data().followingId : doc.data().followerId
                );

                if (userIds.length === 0) {
                    setUsers([]);
                } else {
                    // 3. Fetch User Details for those IDs
                    const usersData = await Promise.all(
                        userIds.map(async (uid) => {
                            const userDoc = await getDoc(doc(db, "users", uid));
                            return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null;
                        })
                    );
                    setUsers(usersData.filter(u => u !== null));
                }

                // 4. Fetch current user's following status for these users to show Correct Buttons
                if (currentUser) {
                    const myFollowsQ = query(followsRef, where("followerId", "==", currentUser.uid));
                    const myFollowsSnap = await getDocs(myFollowsQ);
                    const fMap: Record<string, boolean> = {};
                    myFollowsSnap.forEach(doc => {
                        fMap[doc.data().followingId] = true;
                    });
                    setFollowingMap(fMap);
                }

            } catch (error) {
                console.error("Error fetching follow list:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfileAndList();
    }, [profileId, type, isFollowingPage, currentUser]);

    const handleFollow = async (targetId: string) => {
        if (!currentUser) return;

        const followId = `${currentUser.uid}_${targetId}`;
        const followRef = doc(db, "follows", followId);
        const followerRef = doc(db, "users", currentUser.uid);
        const targetRef = doc(db, "users", targetId);

        try {
            if (followingMap[targetId]) {
                await deleteDoc(followRef);
                await updateDoc(followerRef, { followingCount: increment(-1) });
                await updateDoc(targetRef, { followersCount: increment(-1) });
                setFollowingMap(prev => ({ ...prev, [targetId]: false }));
            } else {
                await setDoc(followRef, {
                    followerId: currentUser.uid,
                    followingId: targetId,
                    createdAt: new Date().toISOString()
                });
                await updateDoc(followerRef, { followingCount: increment(1) });
                await updateDoc(targetRef, { followersCount: increment(1) });
                setFollowingMap(prev => ({ ...prev, [targetId]: true }));
            }
        } catch (error) {
            console.error("Error toggling follow:", error);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
    if (!profileUser) return <div className="p-8 text-center text-gray-500">User not found.</div>;

    return (
        <div className="flex flex-col min-h-screen">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md px-4 py-1 flex items-center gap-6 h-[53px] border-b border-gray-800">
                <Link href={`/profile/${profileId}`} className="p-1.5 hover:bg-white/10 rounded-full transition -ml-1">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex flex-col min-w-0 truncate">
                    <h1 className="text-[20px] font-extrabold truncate leading-tight">
                        {profileUser.displayName || profileUser.username}
                    </h1>
                    <p className="text-[13px] text-[#71767b] leading-tight">@{profileUser.username}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800">
                <Link
                    href={`/profile/${profileId}/followers`}
                    className={`flex-1 flex justify-center hover:bg-white/10 transition px-2 min-w-[100px]`}
                >
                    <div className={`py-4 relative text-[15px] ${!isFollowingPage ? 'font-bold text-white' : 'font-medium text-[#71767b]'}`}>
                        Followers
                        {!isFollowingPage && (
                            <div className="absolute bottom-0 left-0 right-0 h-[4px] bg-[var(--color-twitter-blue)] rounded-full"></div>
                        )}
                    </div>
                </Link>
                <Link
                    href={`/profile/${profileId}/following`}
                    className={`flex-1 flex justify-center hover:bg-white/10 transition px-2 min-w-[100px]`}
                >
                    <div className={`py-4 relative text-[15px] ${isFollowingPage ? 'font-bold text-white' : 'font-medium text-[#71767b]'}`}>
                        Following
                        {isFollowingPage && (
                            <div className="absolute bottom-0 left-0 right-0 h-[4px] bg-[var(--color-twitter-blue)] rounded-full"></div>
                        )}
                    </div>
                </Link>
            </div>

            {/* List */}
            <div className="flex flex-col">
                {users.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        {isFollowingPage ? "No one followed yet." : "No followers yet."}
                    </div>
                ) : (
                    users.map((u) => (
                        <div key={u.id} className="flex items-center justify-between hover:bg-white/5 px-4 py-3 cursor-pointer transition">
                            <Link href={`/profile/${u.id}`} className="flex items-center gap-3 overflow-hidden flex-grow">
                                {u.profileImage ? (
                                    <img src={u.profileImage} alt={u.displayName} className="w-10 h-10 rounded-full shrink-0 object-cover" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-gray-700 shrink-0 flex items-center justify-center">
                                        <User className="w-6 h-6 text-gray-500" />
                                    </div>
                                )}
                                <div className="flex flex-col truncate">
                                    <p className="font-bold text-white text-[15px] truncate hover:underline">{u.displayName || u.username}</p>
                                    <p className="text-[#71767b] text-[15px] truncate">@{u.username}</p>
                                </div>
                            </Link>
                            {u.id !== currentUser?.uid && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleFollow(u.id);
                                    }}
                                    className={`${followingMap[u.id]
                                        ? "border border-gray-600 text-white hover:border-red-600 hover:text-red-500 hover:after:content-['Unfollow'] after:content-['Following']"
                                        : "bg-[#eff3f4] text-black hover:bg-[#d7dbdc]"
                                        } font-bold text-[14px] px-4 py-1.5 rounded-full transition shrink-0 min-w-[80px] ml-4`}
                                >
                                    {!followingMap[u.id] && "Follow"}
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
