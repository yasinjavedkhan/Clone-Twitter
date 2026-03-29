"use client";

import { useState, useEffect, use } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc, updateDoc, increment, serverTimestamp, addDoc, getCountFromServer } from "firebase/firestore";
import Link from "next/link";
import { ArrowLeft, CalendarDays, User as UserIcon, Mail, Camera, X } from "lucide-react";
import { format } from "date-fns";
import Tweet from "@/components/tweet/Tweet";
import EditProfileModal from "@/components/profile/EditProfileModal";
import { useRouter } from "next/navigation";
import { userCache } from "@/lib/cache";
import Avatar from "@/components/ui/Avatar";
import { sendPushNotification } from "@/lib/notifications";

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id: profileId } = use(params);
    const { user: currentUser, signOut } = useAuth();
    const router = useRouter();

    const [profileData, setProfileData] = useState<any>(null);
    const [tweets, setTweets] = useState<any[]>([]);
    const [likedTweets, setLikedTweets] = useState<any[]>([]);
    const [followCounts, setFollowCounts] = useState({ following: 0, followers: 0 });
    const [isFollowing, setIsFollowing] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isTabLoading, setIsTabLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("Posts");
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [viewingImage, setViewingImage] = useState<string | null>(null);

    const isOwnProfile = currentUser?.uid === profileId;

    // 1. Fetch Profile Header Info (Only when profileId or user changes)
    useEffect(() => {
        const fetchHeaderData = async () => {
            if (!profileId) return;
            
            try {
                // Fetch User Info using cache
                const data = await userCache.fetchUser(profileId);
                if (data) {
                    setProfileData(data);
                    
                    // Fetch REAL-TIME Counts from follows collection
                    const followersQuery = query(collection(db, "follows"), where("followingId", "==", profileId));
                    const followingQuery = query(collection(db, "follows"), where("followerId", "==", profileId));
                    
                    const [followersSnap, followingSnap] = await Promise.all([
                        getCountFromServer(followersQuery),
                        getCountFromServer(followingQuery)
                    ]);
                    
                    setFollowCounts({
                        followers: followersSnap.data().count,
                        following: followingSnap.data().count
                    });
                }

                // Fetch Follow Status (if not own profile)
                if (currentUser && !isOwnProfile) {
                    const followRef = doc(db, "follows", `${currentUser.uid}_${profileId}`);
                    const followDoc = await getDoc(followRef);
                    setIsFollowing(followDoc.exists());
                }
            } catch (error) {
                console.error("Error fetching header data:", error);
            } finally {
                setIsInitialLoading(false);
            }
        };

        fetchHeaderData();
    }, [profileId, currentUser, isOwnProfile]);

    // 2. Fetch Tab Content (When activeTab or profileId changes)
    useEffect(() => {
        const fetchTabContent = async () => {
            if (!profileId) return;
            setIsTabLoading(true);

            try {
                if (activeTab === "Posts") {
                    const tweetsQuery = query(
                        collection(db, "tweets"),
                        where("userId", "==", profileId)
                    );
                    const tweetsSnap = await getDocs(tweetsQuery);
                    const sortedTweets = tweetsSnap.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                    setTweets(sortedTweets);
                } else if (activeTab === "Likes") {
                    const likesQuery = query(collection(db, "likes"), where("userId", "==", profileId));
                    const likesSnap = await getDocs(likesQuery);
                    const tweetIds = likesSnap.docs.map(doc => doc.data().tweetId);

                    if (tweetIds.length === 0) {
                        setLikedTweets([]);
                    } else {
                        const likedData = await Promise.all(
                            tweetIds.map(async (tid) => {
                                const tDoc = await getDoc(doc(db, "tweets", tid));
                                return tDoc.exists() ? { id: tDoc.id, ...tDoc.data() } : null;
                            })
                        );
                        setLikedTweets(likedData.filter(t => t !== null));
                    }
                }
            } catch (error) {
                console.error("Error fetching tab content:", error);
            } finally {
                setIsTabLoading(false);
            }
        };

        fetchTabContent();
    }, [profileId, activeTab]);

    const handleFollowToggle = async () => {
        if (!currentUser) return;

        const followId = `${currentUser.uid}_${profileId}`;
        const followRef = doc(db, "follows", followId);
        const followerRef = doc(db, "users", currentUser.uid);
        const targetRef = doc(db, "users", profileId);

        try {
            if (isFollowing) {
                await deleteDoc(followRef);
                await updateDoc(followerRef, { followingCount: increment(-1) });
                await updateDoc(targetRef, { followersCount: increment(-1) });
                setIsFollowing(false);
                setFollowCounts(prev => ({ ...prev, followers: prev.followers - 1 }));
            } else {
                await setDoc(followRef, {
                    followerId: currentUser.uid,
                    followingId: profileId,
                    createdAt: new Date().toISOString()
                });
                await updateDoc(followerRef, { followingCount: increment(1) });
                await updateDoc(targetRef, { followersCount: increment(1) });
                setIsFollowing(true);
                setFollowCounts(prev => ({ ...prev, followers: prev.followers + 1 }));

                // Notify target user
                try {
                    // Create in-app notification
                    await addDoc(collection(db, "notifications"), {
                        userId: profileId,
                        type: "follow",
                        title: "New Follower",
                        message: `${currentUser?.displayName || currentUser?.email || 'Someone'} started following you`,
                        followerId: currentUser.uid,
                        read: false,
                        createdAt: serverTimestamp(),
                    });

                    // Send push notification
                    await sendPushNotification({
                        toUserId: profileId,
                        title: "New Follower",
                        body: `${currentUser?.displayName || currentUser?.email || 'Someone'} started following you`,
                        data: {
                            type: "follow",
                            followerId: currentUser.uid,
                        }
                    });
                } catch (notifyError) {
                    console.error("Error sending follow notification:", notifyError);
                }
            }
        } catch (error) {
            console.error("Error toggling follow:", error);
        }
    };

    const handleMessage = async () => {
        if (!currentUser) return;

        // Deterministic ID (sort by UID string to ensure consistency)
        const ids = [currentUser.uid, profileId].sort();
        const conversationId = ids.join("_");
        const convRef = doc(db, "conversations", conversationId);

        try {
            const convDoc = await getDoc(convRef);
            if (!convDoc.exists()) {
                await setDoc(convRef, {
                    participants: [currentUser.uid, profileId],
                    lastMessage: "",
                    lastTimestamp: serverTimestamp(),
                    createdAt: serverTimestamp(),
                });
            }
            router.push(`/messages/${conversationId}`);
        } catch (error) {
            console.error("Error starting conversation:", error);
        }
    };

    if (isInitialLoading) return <div className="p-8 text-center text-gray-500">Loading profile...</div>;

    if (!profileData) return <div className="p-8 text-center text-gray-500">User not found.</div>;

    const joinDate = profileData.createdAt?.toDate ? format(profileData.createdAt.toDate(), 'MMMM yyyy') : 'Unknown';

    const handleProfileUpdate = async () => {
        // Re-fetch from cache (which was just updated by the modal)
        const updatedData = await userCache.fetchUser(profileId);
        if (updatedData) {
            setProfileData(updatedData);
        }
    };

    return (
        <div className="flex flex-col relative pb-20">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md px-4 py-1 flex items-center gap-6 h-[53px]">
                <Link href="/" className="p-1.5 hover:bg-white/10 rounded-full transition -ml-1">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex flex-col min-w-0 truncate">
                    <h1 className="text-[20px] font-extrabold truncate leading-tight">
                        {profileData.displayName || profileData.username}
                    </h1>
                    <p className="text-[13px] text-[#71767b] leading-tight">{tweets.length} posts</p>
                </div>
            </div>

            {/* Profile Content */}
            {/* ... */}

            {/* Cover / Profile Images */}
            <div className="relative group/cover">
                <div
                    className="h-48 bg-[#333639] w-full relative cursor-pointer"
                    onClick={() => {
                        if (profileData.coverImage) {
                            setViewingImage(profileData.coverImage);
                        } else if (isOwnProfile) {
                            setIsEditModalOpen(true);
                        }
                    }}
                >
                    {profileData.coverImage && (
                        <img src={profileData.coverImage} className="w-full h-full object-cover" alt="Cover" />
                    )}
                    {isOwnProfile && (
                        <div className="absolute inset-0 bg-black/0 group-hover/cover:bg-black/20 transition flex items-center justify-center">
                            <div className="p-3 bg-black/40 rounded-full opacity-0 group-hover/cover:opacity-100 transition shadow-lg">
                                <Camera className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    )}
                </div>
                <div 
                    className="absolute -bottom-16 left-4 border-[4px] border-black rounded-full overflow-hidden w-32 h-32 bg-[#16181c] cursor-pointer"
                    onClick={() => {
                        if (profileData.profileImage) {
                            setViewingImage(profileData.profileImage);
                        } else if (isOwnProfile) {
                            setIsEditModalOpen(true);
                        }
                    }}
                >
                    <Avatar
                        src={profileData.profileImage}
                        fallbackText={profileData.displayName || profileData.username}
                        size="xl"
                        className="border-none"
                    />
                </div>
            </div>

            {/* Action Buttons Area */}
            <div className="flex justify-end p-4 h-[72px] items-start gap-2">
                {!isOwnProfile && (
                    <button
                        onClick={handleMessage}
                        className="p-2 border border-[#536471] rounded-full hover:bg-white/10 transition"
                    >
                        <Mail className="w-5 h-5 text-white" />
                    </button>
                )}
                {isOwnProfile ? (
                    <div className="flex gap-2">
                        <button
                            onClick={() => signOut()}
                            className="px-4 py-1.5 border border-red-500/30 text-red-500 hover:bg-red-500/10 rounded-full font-bold text-[15px] transition"
                        >
                            Log out
                        </button>
                        <button
                            onClick={() => setIsEditModalOpen(true)}
                            className="px-4 py-1.5 border border-[#536471] hover:bg-[#eff3f4]/10 rounded-full font-bold text-[15px] transition"
                        >
                            Edit profile
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleFollowToggle}
                        className={`${isFollowing
                            ? "border border-gray-600 text-white hover:border-red-600 hover:text-red-500 hover:after:content-['Unfollow'] after:content-['Following']"
                            : "bg-[#eff3f4] text-black hover:bg-[#d7dbdc]"
                            } font-bold text-[15px] px-6 py-1.5 rounded-full transition min-w-[100px]`}
                    >
                        {!isFollowing && "Follow"}
                    </button>
                )}
            </div>

            {/* Profile Info */}
            <div className="px-4 pb-4">
                <div className="flex flex-col mb-3">
                    <h2 className="text-[20px] font-extrabold leading-tight truncate">
                        {profileData.displayName || profileData.username}
                    </h2>
                    <p className="text-[#71767b] text-[15px] leading-tight">@{profileData.username}</p>
                </div>

                {profileData.bio && <p className="text-[15px] text-white leading-normal mb-3 whitespace-pre-wrap">{profileData.bio}</p>}

                <div className="flex items-center gap-3 text-[#71767b] text-[15px] mb-3">
                    <div className="flex items-center gap-1.5">
                        <CalendarDays className="w-[18px] h-[18px]" />
                        <span>Joined {joinDate}</span>
                    </div>
                </div>

                <div className="flex gap-4 text-[14px]">
                    <Link href={`/profile/${profileId}/following`} className="hover:underline">
                        <span className="font-bold text-white">{followCounts.following}</span>
                        <span className="text-[#71767b] ml-1">Following</span>
                    </Link>
                    <Link href={`/profile/${profileId}/followers`} className="hover:underline">
                        <span className="font-bold text-white">{followCounts.followers}</span>
                        <span className="text-[#71767b] ml-1">Followers</span>
                    </Link>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#2f3336] mt-1 overflow-x-auto hidden-scrollbar">
                {["Posts", "Replies", "Highlights", "Articles", "Media", "Likes"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 flex justify-center hover:bg-white/10 transition px-2 min-w-[100px] sm:min-w-0`}
                    >
                        <div className={`py-4 relative text-[15px] ${activeTab === tab ? 'font-bold text-white' : 'font-medium text-[#71767b]'}`}>
                            {tab}
                            {activeTab === tab && (
                                <div className="absolute bottom-0 left-0 right-0 h-[4px] bg-[var(--color-twitter-blue)] rounded-full"></div>
                            )}
                        </div>
                    </button>
                ))}
            </div>

            {/* Feed */}
            <div className="flex flex-col relative min-h-[200px]">
                {isTabLoading && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] z-10 flex justify-center pt-12">
                        <div className="w-8 h-8 rounded-full border-2 border-[var(--color-twitter-blue)] border-t-transparent animate-spin"></div>
                    </div>
                )}
                
                {!isTabLoading && (
                    <>
                        {activeTab === "Posts" ? (
                            tweets.length === 0 ? (
                                <div className="p-12 text-center text-gray-500">No posts yet.</div>
                            ) : (
                                tweets.map((tweet) => <Tweet key={tweet.id} tweet={tweet} />)
                            )
                        ) : activeTab === "Likes" ? (
                            likedTweets.length === 0 ? (
                                <div className="p-12 text-center text-gray-500">No likes yet.</div>
                            ) : (
                                likedTweets.map((tweet) => <Tweet key={tweet.id} tweet={tweet} />)
                            )
                        ) : (
                            <div className="p-12 text-center text-gray-500">Empty.</div>
                        )}
                    </>
                )}
            </div>

            <EditProfileModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSave={handleProfileUpdate}
            />

            {/* Full Screen Image Viewer */}
            {viewingImage && (
                <div 
                    className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm cursor-pointer animate-fade-in"
                    onClick={() => setViewingImage(null)}
                >
                    <button 
                        className="absolute top-4 left-4 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white transition backdrop-blur-md"
                        onClick={(e) => { e.stopPropagation(); setViewingImage(null); }}
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <img 
                        src={viewingImage} 
                        className="max-w-full max-h-full object-contain cursor-default select-none" 
                        alt="Full screen view" 
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
