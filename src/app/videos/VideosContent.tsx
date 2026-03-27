"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, doc, getDoc, updateDoc, setDoc, deleteDoc, increment, serverTimestamp, where, limit } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { userCache } from "@/lib/cache";
import { cn } from "@/lib/utils";
import { sendPushNotification } from "@/lib/notifications";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import { ArrowLeft, Heart, MessageCircle, Repeat2, Bookmark, Share, Volume2, VolumeX, X, ChevronLeft, ChevronRight } from "lucide-react";

interface VideoItem {
    tweetId: string;
    videoUrl: string;
    userId: string;
    content: string;
    likesCount: number;
    commentsCount: number;
    retweetsCount: number;
    author?: { displayName: string; username: string; profileImage?: string };
}

export default function VideosContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const startUrl = searchParams.get("url");
    const { user } = useAuth();

    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [muted, setMuted] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [likes, setLikes] = useState<Record<string, boolean>>({});
    const [bookmarks, setBookmarks] = useState<Record<string, boolean>>({});
    const [retweets, setRetweets] = useState<Record<string, boolean>>({});
    const [isFollowing, setIsFollowing] = useState<Record<string, boolean>>({});
    const [isFollowLoading, setIsFollowLoading] = useState<Record<string, boolean>>({});
    const [counts, setCounts] = useState<Record<string, { likes: number; retweets: number; comments: number }>>({});

    const containerRef = useRef<HTMLDivElement>(null);
    const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Fetch all videos from tweets
    useEffect(() => {
        const fetchVideos = async () => {
            setLoading(true);
            try {
                // Limit scan to 50 latest tweets to find videos quickly
                const snap = await getDocs(query(collection(db, "tweets"), orderBy("createdAt", "desc"), limit(50)));
                const items: VideoItem[] = [];

                for (const docSnap of snap.docs) {
                    const data = docSnap.data();
                    const urls = (data.mediaUrls || []) as string[];
                    for (const url of urls) {
                        const isVid = url.toLowerCase().includes('.mp4') ||
                            url.toLowerCase().includes('.mov') ||
                            url.toLowerCase().includes('.webm') ||
                            url.includes('video');
                        if (isVid) {
                            items.push({
                                tweetId: docSnap.id,
                                videoUrl: url,
                                userId: data.userId,
                                content: data.content || "",
                                likesCount: data.likesCount || 0,
                                commentsCount: data.commentsCount || 0,
                                retweetsCount: data.retweetsCount || 0,
                            });
                        }
                    }
                }

                // Fetch authors for all videos
                const withAuthors = await Promise.all(items.map(async item => {
                    const author = await userCache.fetchUser(item.userId);
                    return { ...item, author };
                }));

                // ✅ Place the clicked video first
                if (startUrl) {
                    const idx = withAuthors.findIndex(v => v.videoUrl === startUrl);
                    if (idx > 0) {
                        const [clicked] = withAuthors.splice(idx, 1);
                        withAuthors.unshift(clicked);
                    }
                }

                setVideos(withAuthors);

                // Initial counts state
                const c: Record<string, { likes: number; retweets: number; comments: number }> = {};
                withAuthors.forEach(v => {
                    c[v.tweetId] = { likes: v.likesCount, retweets: v.retweetsCount, comments: v.commentsCount };
                });
                setCounts(c);
            } catch (err) {
                console.error("Error fetching videos:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchVideos();
    }, [startUrl]);

    // Check interaction states (Like, Bookmark, Retweet, Follow)
    useEffect(() => {
        if (!user || videos.length === 0) return;
        const checkInteractions = async () => {
            const lMap: Record<string, boolean> = {};
            const bMap: Record<string, boolean> = {};
            const rMap: Record<string, boolean> = {};
            const fMap: Record<string, boolean> = {};
            
            const uniqueTweetIds = [...new Set(videos.map(v => v.tweetId))];
            const uniqueUserIds = [...new Set(videos.map(v => v.userId))];

            await Promise.all([
                ...uniqueTweetIds.map(async (tid) => {
                    const [l, b, r] = await Promise.all([
                        getDoc(doc(db, "likes", `${user.uid}_${tid}`)),
                        getDoc(doc(db, "bookmarks", `${user.uid}_${tid}`)),
                        getDoc(doc(db, "retweets", `${user.uid}_${tid}`))
                    ]);
                    lMap[tid] = l.exists();
                    bMap[tid] = b.exists();
                    rMap[tid] = r.exists();
                }),
                ...uniqueUserIds.map(async (uid) => {
                    if (uid === user.uid) return;
                    const f = await getDoc(doc(db, "follows", `${user.uid}_${uid}`));
                    fMap[uid] = f.exists();
                })
            ]);

            setLikes(lMap);
            setBookmarks(bMap);
            setRetweets(rMap);
            setIsFollowing(fMap);
        };
        checkInteractions();
    }, [user, videos]);

    // IntersectionObserver to auto-play the video in view
    useEffect(() => {
        if (videos.length === 0) return;
        observerRef.current?.disconnect();
        observerRef.current = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const video = entry.target as HTMLVideoElement;
                if (entry.isIntersecting) {
                    video.play().catch(() => {});
                    const idx = videoRefs.current.indexOf(video);
                    if (idx >= 0) setCurrentIndex(idx);
                } else {
                    video.pause();
                }
            });
        }, { threshold: 0.7 });

        videoRefs.current.forEach(v => { if (v) observerRef.current?.observe(v); });

        // Auto play first video
        const timer = setTimeout(() => {
            videoRefs.current[0]?.play().catch(() => {});
        }, 300);

        return () => {
            observerRef.current?.disconnect();
            clearTimeout(timer);
        };
    }, [videos]);

    const handleLike = async (tweetId: string) => {
        if (!user) return;
        const likeRef = doc(db, "likes", `${user.uid}_${tweetId}`);
        const tweetRef = doc(db, "tweets", tweetId);
        try {
            if (likes[tweetId]) {
                await deleteDoc(likeRef);
                await updateDoc(tweetRef, { likesCount: increment(-1) });
                setLikes(p => ({ ...p, [tweetId]: false }));
                setCounts(p => ({ ...p, [tweetId]: { ...p[tweetId], likes: (p[tweetId]?.likes || 1) - 1 } }));
            } else {
                await setDoc(likeRef, { userId: user.uid, tweetId, createdAt: serverTimestamp() });
                await updateDoc(tweetRef, { likesCount: increment(1) });
                setLikes(p => ({ ...p, [tweetId]: true }));
                setCounts(p => ({ ...p, [tweetId]: { ...p[tweetId], likes: (p[tweetId]?.likes || 0) + 1 } }));
            }
        } catch (err) { console.error(err); }
    };

    const handleRetweet = async (tweetId: string) => {
        if (!user) return;
        const ref = doc(db, "retweets", `${user.uid}_${tweetId}`);
        const tweetRef = doc(db, "tweets", tweetId);
        try {
            if (retweets[tweetId]) {
                await deleteDoc(ref);
                await updateDoc(tweetRef, { retweetsCount: increment(-1) });
                setRetweets(p => ({ ...p, [tweetId]: false }));
                setCounts(p => ({ ...p, [tweetId]: { ...p[tweetId], retweets: (p[tweetId]?.retweets || 1) - 1 } }));
            } else {
                await setDoc(ref, { userId: user.uid, tweetId, createdAt: serverTimestamp() });
                await updateDoc(tweetRef, { retweetsCount: increment(1) });
                setRetweets(p => ({ ...p, [tweetId]: true }));
                setCounts(p => ({ ...p, [tweetId]: { ...p[tweetId], retweets: (p[tweetId]?.retweets || 0) + 1 } }));
            }
        } catch (err) { console.error(err); }
    };

    const handleBookmark = async (tweetId: string) => {
        if (!user) return;
        const ref = doc(db, "bookmarks", `${user.uid}_${tweetId}`);
        try {
            if (bookmarks[tweetId]) {
                await deleteDoc(ref);
                setBookmarks(p => ({ ...p, [tweetId]: false }));
            } else {
                await setDoc(ref, { userId: user.uid, tweetId, createdAt: serverTimestamp() });
                setBookmarks(p => ({ ...p, [tweetId]: true }));
            }
        } catch (err) { console.error(err); }
    };

    const handleFollow = async (authorId: string) => {
        if (!user || isFollowLoading[authorId]) return;
        setIsFollowLoading(p => ({ ...p, [authorId]: true }));
        const followId = `${user.uid}_${authorId}`;
        const followRef = doc(db, "follows", followId);
        try {
            if (isFollowing[authorId]) {
                await deleteDoc(followRef);
                await updateDoc(doc(db, "users", user.uid), { followingCount: increment(-1) });
                await updateDoc(doc(db, "users", authorId), { followersCount: increment(-1) });
                setIsFollowing(p => ({ ...p, [authorId]: false }));
            } else {
                await setDoc(followRef, { followerId: user.uid, followingId: authorId, createdAt: new Date().toISOString() });
                await updateDoc(doc(db, "users", user.uid), { followingCount: increment(1) });
                await updateDoc(doc(db, "users", authorId), { followersCount: increment(1) });
                setIsFollowing(p => ({ ...p, [authorId]: true }));
                
                // Send push notification
                const senderName = user.displayName || user.email?.split('@')[0] || 'Someone';
                sendPushNotification({
                    toUserId: authorId,
                    title: "👋 New Follower",
                    body: `${senderName} started following you from the video feed!`,
                    data: {
                        type: 'follow',
                        followerId: user.uid,
                        url: `/profile/${user.uid}`
                    }
                }).catch(console.error);
            }
        } catch (err) {
            console.error("Follow error:", err);
        } finally {
            setIsFollowLoading(p => ({ ...p, [authorId]: false }));
        }
    };

    const handleShare = async (video: VideoItem) => {
        if (typeof window === 'undefined') return;
        const origin = window.location.origin;
        const shareUrl = `${origin}/videos?url=${encodeURIComponent(video.videoUrl)}`;
        if (window.navigator.share) {
            try { await window.navigator.share({ title: 'Check out this video!', text: video.content, url: shareUrl }); }
            catch (e) { console.error(e); }
        } else {
            window.navigator.clipboard.writeText(shareUrl);
            alert("Link copied to clipboard!");
        }
    };

    if (loading) return (
        <div className="fixed inset-0 bg-black flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-2 border-white border-t-transparent animate-spin" />
        </div>
    );

    if (videos.length === 0) return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white gap-4">
            <p className="text-xl font-bold">No videos found</p>
            <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition underline">Return</button>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black overflow-hidden select-none">
            
            {/* ── SNAP SCROLL FEED ── */}
            <div 
                ref={containerRef}
                className="h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth" 
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
            >
                {videos.map((video, idx) => (
                    <div key={`${video.tweetId}-${idx}`} className="relative h-full w-full snap-start flex items-center justify-center bg-black overflow-hidden">
                        
                        {/* ── TOP BAR ( Profile + Follow + X ) ── */}
                        <div className="absolute top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 py-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                            <div className="flex items-center gap-3 pointer-events-auto">
                                <Link href={`/profile/${video.userId}`} className="flex items-center gap-3 group">
                                    <Avatar 
                                        src={video.author?.profileImage} 
                                        fallbackText={video.author?.username || "U"} 
                                        size="md" 
                                        className="border border-white/10"
                                    />
                                    <div className="min-w-0">
                                        <p className="text-white font-bold text-[15px] leading-tight truncate drop-shadow-lg">
                                            {video.author?.displayName || video.author?.username}
                                        </p>
                                        <p className="text-gray-400 text-[13px] leading-tight truncate">@{video.author?.username}</p>
                                    </div>
                                </Link>

                                {user && user.uid !== video.userId && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleFollow(video.userId); }}
                                        disabled={isFollowLoading[video.userId]}
                                        className={cn(
                                            "ml-2 text-[13px] font-bold px-4 py-1.5 rounded-full transition-all duration-200 border-2 active:scale-95",
                                            isFollowing[video.userId]
                                                ? "border-gray-600 text-white hover:border-red-500 hover:text-red-500 hover:bg-red-500/10"
                                                : "bg-white text-black border-white hover:bg-gray-200"
                                        )}
                                    >
                                        {isFollowing[video.userId] ? "Following" : "Follow"}
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-4 pointer-events-auto">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}
                                    className="p-2.5 bg-black/40 hover:bg-black/60 rounded-full text-white transition backdrop-blur-md"
                                >
                                    {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); router.push('/'); }}
                                    className="p-2.5 bg-black/40 hover:bg-black/60 rounded-full text-white transition backdrop-blur-md cursor-pointer"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>


                        {/* THE VIDEO */}
                        <video
                            ref={el => { videoRefs.current[idx] = el; }}
                            src={video.videoUrl}
                            className="h-full w-full object-contain"
                            loop playsInline muted={muted}
                            onClick={() => {
                                const v = videoRefs.current[idx];
                                if (v) v.paused ? v.play() : v.pause();
                            }}
                        />

                        {/* ── BOTTOM CAPTION (Hidden if no content) ── */}
                        {video.content && (
                            <div className="absolute bottom-24 left-0 right-0 px-6 py-4 z-[70] bg-gradient-to-t from-black/60 to-transparent pointer-events-none text-center">
                                <p className="text-white text-[15px] leading-relaxed drop-shadow mx-auto max-w-[85vw] line-clamp-2">
                                    {video.content}
                                </p>
                            </div>
                        )}

                        {/* ── BOTTOM ACTION PILL ── */}
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-1 bg-black/70 backdrop-blur-xl rounded-full px-5 py-2.5 text-gray-300 border border-white/10 shadow-2xl pointer-events-auto">
                            
                            {/* Comment */}
                            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition hover:text-blue-400 hover:bg-blue-500/10">
                                <MessageCircle className="w-5 h-5" />
                                <span className="text-sm font-bold">{counts[video.tweetId]?.comments || 0}</span>
                            </button>

                            <div className="w-px h-5 bg-white/10" />

                            {/* Retweet */}
                            <button 
                                onClick={() => handleRetweet(video.tweetId)}
                                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full transition hover:text-green-400 hover:bg-green-500/10", retweets[video.tweetId] && "text-green-400")}
                            >
                                <Repeat2 className="w-5 h-5" />
                                <span className="text-sm font-bold">{counts[video.tweetId]?.retweets || 0}</span>
                            </button>

                            <div className="w-px h-5 bg-white/10" />

                            {/* Like */}
                            <button 
                                onClick={() => handleLike(video.tweetId)}
                                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full transition hover:text-pink-400 hover:bg-pink-500/10", likes[video.tweetId] && "text-pink-400")}
                            >
                                <Heart className={cn("w-5 h-5", likes[video.tweetId] && "fill-pink-500")} />
                                <span className="text-sm font-bold">{counts[video.tweetId]?.likes || 0}</span>
                            </button>

                            <div className="w-px h-5 bg-white/10" />

                            {/* Bookmark */}
                            <button 
                                onClick={() => handleBookmark(video.tweetId)}
                                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full transition hover:text-blue-400 hover:bg-blue-500/10", bookmarks[video.tweetId] && "text-blue-400")}
                            >
                                <Bookmark className={cn("w-5 h-5", bookmarks[video.tweetId] && "fill-blue-500")} />
                            </button>

                            <div className="w-px h-5 bg-white/10" />

                            {/* Share */}
                            <button 
                                onClick={() => handleShare(video)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition hover:text-blue-400 hover:bg-blue-500/10"
                            >
                                <Share className="w-5 h-5" />
                            </button>
                        </div>

                    </div>
                ))}
            </div>
        </div>
    );
}
