"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import ReactDOM from "react-dom";
import { formatDistanceToNow } from "date-fns";
import { Heart, MessageCircle, Repeat2, Share, Trash2, User, Image, List, Smile, Calendar, MapPin, Globe, X, Bookmark, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, deleteDoc, setDoc, updateDoc, increment, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { sendPushNotification } from "@/lib/notifications";
import CommentModal from "./CommentModal";
import { userCache } from "@/lib/cache";
import Avatar from "@/components/ui/Avatar";

interface TweetProps {
    tweet: any;
}

const VideoItem = ({ url }: { url: string }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(true);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        // Force muted for guaranteed mobile autoplay without user click
                        video.muted = true; 
                        setIsMuted(true);
                        
                        const playPromise = video.play();
                        if (playPromise !== undefined) {
                            playPromise.catch((error) => {
                                console.log("Force-autoplay fallback error:", error);
                                // Retry one more time with explicit attributes
                                video.muted = true;
                                video.play();
                            });
                        }
                    } else {
                        video.pause();
                    }
                });
            },
            { threshold: 0.1 } // Extremely aggressive for instant start
        );

        observer.observe(video);
        return () => observer.disconnect();
    }, []);

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            const newMuted = !videoRef.current.muted;
            videoRef.current.muted = newMuted;
            setIsMuted(newMuted);
            // After unmuting, ensure it's playing
            videoRef.current.play().catch(() => {});
        }
    };

    return (
        <div className="relative w-full h-full group/video bg-black" onClick={toggleMute}>
            <video
                ref={videoRef}
                src={url}
                className="w-full h-full object-contain"
                loop
                playsInline
                muted={true}
                preload="auto"
                autoPlay
            />
            {/* Mute/Unmute Indicator */}
            <div className="absolute bottom-3 right-3 bg-black/60 p-2 rounded-full text-white backdrop-blur-sm transition-all duration-300">
                {isMuted ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-twitter-blue" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.5c-1.105 0-2 .895-2 2v5c0 1.105.895 2 2 2h2.44l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06zM15.5 12c0-1.66-1-3.07-2.43-3.69v7.38c1.43-.62 2.43-2.03 2.43-3.69z" />
                        <path d="M13.07 1.64v2.09c3.08.77 5.43 3.55 5.43 6.27s-2.35 5.5-5.43 6.27v2.09c4.23-.82 7.43-4.51 7.43-8.36s-3.2-7.54-7.43-8.36z" />
                    </svg>
                )}
            </div>
        </div>
    );
};

const Tweet = memo(({ tweet }: TweetProps) => {
    const { user, userData } = useAuth();
    const router = useRouter();
    const [author, setAuthor] = useState<any>(null);
    const [hasLiked, setHasLiked] = useState(false);
    const [hasRetweeted, setHasRetweeted] = useState(false);
    const [isLiking, setIsLiking] = useState(false);
    const [isRetweeting, setIsRetweeting] = useState(false);
    const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    const [isFollowing, setIsFollowing] = useState(false);
    const [isFollowingTweet, setIsFollowingTweet] = useState(false);
    const [hasBookmarked, setHasBookmarked] = useState(false);
    const [isBookmarking, setIsBookmarking] = useState(false);
    const [showBookmarkToast, setShowBookmarkToast] = useState(false);
    const isRestrictive = tweet.replySetting && tweet.replySetting !== 'everyone';
    const isOwner = user?.uid === tweet.userId;
    const [canSee, setCanSee] = useState(!isRestrictive || isOwner);
    const [canReply, setCanReply] = useState(!isRestrictive || isOwner);
    const [replyError, setReplyError] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(isRestrictive && !isOwner);
    const tapCount = useRef(0);
    const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleTap = () => {
        tapCount.current += 1;
        if (tapTimer.current) clearTimeout(tapTimer.current);
        tapTimer.current = setTimeout(() => {
            if (tapCount.current === 2) handleLike();
            if (tapCount.current >= 3 && canReply) setIsCommentModalOpen(true);
            tapCount.current = 0;
        }, 400);
    };

    const openLightbox = useCallback((e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        setLightboxIndex(index);
    }, []);

    const closeLightbox = useCallback(() => setLightboxIndex(null), []);

    const lightboxPrev = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setLightboxIndex(prev => (prev !== null && prev > 0 ? prev - 1 : prev));
    }, []);

    const lightboxNext = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setLightboxIndex(prev => (
            prev !== null && tweet.mediaUrls && prev < tweet.mediaUrls.length - 1 ? prev + 1 : prev
        ));
    }, [tweet.mediaUrls]);

    // Check follow status when lightbox opens
    useEffect(() => {
        if (lightboxIndex === null || !user || user.uid === tweet.userId) return;
        const checkFollow = async () => {
            const fDoc = await getDoc(doc(db, "follows", `${user.uid}_${tweet.userId}`));
            setIsFollowing(fDoc.exists());
        };
        checkFollow();
    }, [lightboxIndex, user, tweet.userId]);

    const handleLightboxFollow = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user || isFollowingTweet) return;
        setIsFollowingTweet(true);
        const followId = `${user.uid}_${tweet.userId}`;
        const followRef = doc(db, "follows", followId);
        try {
            if (isFollowing) {
                await deleteDoc(followRef);
                await updateDoc(doc(db, "users", user.uid), { followingCount: increment(-1) });
                await updateDoc(doc(db, "users", tweet.userId), { followersCount: increment(-1) });
                setIsFollowing(false);
            } else {
                await setDoc(followRef, {
                    followerId: user.uid,
                    followingId: tweet.userId,
                    createdAt: new Date().toISOString()
                });
                await updateDoc(doc(db, "users", user.uid), { followingCount: increment(1) });
                await updateDoc(doc(db, "users", tweet.userId), { followersCount: increment(1) });
                setIsFollowing(true);
            }
        } catch (err) {
            console.error("Follow error:", err);
        } finally {
            setIsFollowingTweet(false);
        }
    };

    useEffect(() => {
        if (lightboxIndex === null) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft' && lightboxIndex > 0) setLightboxIndex(i => (i !== null ? i - 1 : i));
            if (e.key === 'ArrowRight' && tweet.mediaUrls && lightboxIndex < tweet.mediaUrls.length - 1)
                setLightboxIndex(i => (i !== null ? i + 1 : i));
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [lightboxIndex, closeLightbox, tweet.mediaUrls]);


    useEffect(() => {
        if (!tweet.replySetting || tweet.replySetting === 'everyone') {
            setCanReply(true);
            return;
        }

        if (isOwner) {
            setCanReply(true);
            return;
        }

        if (!user) {
            setCanReply(false);
            return;
        }

        const checkPermissions = async () => {
            if (isOwner) {
                setCanReply(true);
                setCanSee(true);
                return;
            }

            if (!tweet.replySetting || tweet.replySetting === 'everyone') {
                setCanReply(true);
                setCanSee(true);
                return;
            }

            setIsChecking(true);
            try {
                if (tweet.replySetting === 'following') {
                    // Check 1: Does Author follow Current User?
                    const q1 = query(
                        collection(db, "follows"), 
                        where("followerId", "==", tweet.userId),
                        where("followingId", "==", user?.uid || "")
                    );
                    
                    // Check 2: Does Current User follow Author? (Follow Back)
                    const q2 = query(
                        collection(db, "follows"),
                        where("followerId", "==", user?.uid || ""),
                        where("followingId", "==", tweet.userId)
                    );

                    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
                    const authorFollowsMe = !snap1.empty;
                    const iFollowAuthor = !snap2.empty;
                    
                    setCanSee(authorFollowsMe || iFollowAuthor);
                    setCanReply(authorFollowsMe);
                    if (!authorFollowsMe) {
                        setReplyError("You can't reply to this post. The author only allows people they follow to reply.");
                    }
                } else if (tweet.replySetting === 'followers') {
                    // Check: Do I follow the Author?
                    const q = query(
                        collection(db, "follows"),
                        where("followerId", "==", user?.uid || ""),
                        where("followingId", "==", tweet.userId)
                    );
                    const snap = await getDocs(q);
                    const iFollowAuthor = !snap.empty;
                    
                    setCanSee(iFollowAuthor);
                    setCanReply(iFollowAuthor);
                    if (!iFollowAuthor) {
                        setReplyError("You can't reply to this post. Only followers of the author can reply.");
                    }
                } else if (tweet.replySetting === 'mentions') {
                    if (userData?.username) {
                        const username = userData.username.toLowerCase();
                        const content = tweet.content.toLowerCase();
                        const mentionRegex = new RegExp(`@${username}\\b`);
                        const isMentioned = mentionRegex.test(content);
                        setCanReply(isMentioned);
                        setCanSee(isMentioned); // For mentions, usually only mentioned can see/reply if restricted
                        if (!isMentioned) {
                            setReplyError("You can't reply to this post. Only people mentioned by the author can reply.");
                        }
                    } else {
                        setCanReply(false);
                        setCanSee(false);
                    }
                }
            } catch (err) {
                console.error("Permission check error:", err);
                // On error, default to private if restrictive
                setCanSee(false);
            } finally {
                setIsChecking(false);
            }
        };
        checkPermissions();
    }, [tweet.replySetting, isOwner, user, userData?.username, tweet.userId, tweet.content]);

    useEffect(() => {
        if (tweet.author) {
            setAuthor(tweet.author);
            return;
        }
        const fetchAuthor = async () => {
            if (!tweet.userId) return;
            const data = await userCache.fetchUser(tweet.userId);
            if (data) setAuthor(data);
        };
        fetchAuthor();
    }, [tweet.userId, tweet.author]);

    useEffect(() => {
        const checkStatus = async () => {
            if (!user) return;
            const [likeDoc, retweetDoc, bookmarkDoc] = await Promise.all([
                getDoc(doc(db, "likes", `${user.uid}_${tweet.id}`)),
                getDoc(doc(db, "retweets", `${user.uid}_${tweet.id}`)),
                getDoc(doc(db, "bookmarks", `${user.uid}_${tweet.id}`))
            ]);
            setHasLiked(likeDoc.exists());
            setHasRetweeted(retweetDoc.exists());
            setHasBookmarked(bookmarkDoc.exists());
        };
        checkStatus();
    }, [user, tweet.id]);

    const handleLike = async () => {
        if (!user || isLiking) return;
        setIsLiking(true);

        const likeRef = doc(db, "likes", `${user.uid}_${tweet.id}`);
        const tweetRef = doc(db, "tweets", tweet.id);

        try {
            if (hasLiked) {
                await deleteDoc(likeRef);
                await updateDoc(tweetRef, { likesCount: increment(-1) });
                setHasLiked(false);
            } else {
                await setDoc(likeRef, {
                    userId: user.uid,
                    tweetId: tweet.id,
                    createdAt: serverTimestamp()
                });
                await updateDoc(tweetRef, { likesCount: increment(1) });
                setHasLiked(true);

                // Send push notification to tweet author
                if (tweet.userId !== user.uid) {
                    const senderName = userData?.displayName || user.displayName || user.email?.split('@')[0] || 'Someone';
                    sendPushNotification({
                        toUserId: tweet.userId,
                        title: "❤️ New Like",
                        body: `${senderName} liked your post: "${tweet.content.substring(0, 50)}${tweet.content.length > 50 ? '...' : ''}"`,
                        data: {
                            type: 'like',
                            tweetId: tweet.id,
                            url: `/` // ideally link to specific tweet
                        }
                    }).catch(console.error);
                }
            }
        } catch (error) {
            console.error("Error toggling like:", error);
        } finally {
            setIsLiking(false);
        }
    };

    const handleRetweet = async () => {
        if (!user || isRetweeting) return;
        setIsRetweeting(true);

        const retweetRef = doc(db, "retweets", `${user.uid}_${tweet.id}`);
        const tweetRef = doc(db, "tweets", tweet.id);

        try {
            if (hasRetweeted) {
                await deleteDoc(retweetRef);
                await updateDoc(tweetRef, { retweetsCount: increment(-1) });
                setHasRetweeted(false);
            } else {
                await setDoc(retweetRef, {
                    userId: user.uid,
                    tweetId: tweet.id,
                    createdAt: serverTimestamp()
                });
                await updateDoc(tweetRef, { retweetsCount: increment(1) });
                setHasRetweeted(true);

                // Send push notification to tweet author
                if (tweet.userId !== user.uid) {
                    const senderName = userData?.displayName || user.displayName || user.email?.split('@')[0] || 'Someone';
                    sendPushNotification({
                        toUserId: tweet.userId,
                        title: "🔁 New Retweet",
                        body: `${senderName} retweeted your post!`,
                        data: {
                            type: 'retweet',
                            tweetId: tweet.id,
                            url: `/`
                        }
                    }).catch(console.error);
                }
            }
        } catch (error) {
            console.error("Error toggling retweet:", error);
        } finally {
            setIsRetweeting(false);
        }
    };

    const handleBookmark = async () => {
        if (!user || isBookmarking) return;
        setIsBookmarking(true);

        const bookmarkRef = doc(db, "bookmarks", `${user.uid}_${tweet.id}`);

        try {
            if (hasBookmarked) {
                await deleteDoc(bookmarkRef);
                setHasBookmarked(false);
            } else {
                await setDoc(bookmarkRef, {
                    userId: user.uid,
                    tweetId: tweet.id,
                    createdAt: serverTimestamp()
                });
                setHasBookmarked(true);
                setShowBookmarkToast(true);
                setTimeout(() => setShowBookmarkToast(false), 3000);
            }
        } catch (error: any) {
            console.error("Error toggling bookmark:", error);
            alert("Error bookmarking: " + error.message);
        } finally {
            setIsBookmarking(false);
        }
    };

    const handleShare = async () => {
        if (typeof window === 'undefined') return;
        const origin = window.location.origin;
        const shareUrl = `${origin}/profile/${tweet.userId}`; 
        
        if (window.navigator.share) {
            try {
                await window.navigator.share({
                    title: 'Check out this post!',
                    text: tweet.content,
                    url: shareUrl,
                });
            } catch (error: any) {
                if (error.name !== 'AbortError') {
                    console.error("Error sharing:", error);
                }
            }
        } else {
            // Fallback: Copy to clipboard
            window.navigator.clipboard.writeText(shareUrl);
            alert("Link copied to clipboard!");
        }
    };

    const handleDelete = async () => {
        if (typeof window !== 'undefined' && window.confirm("Are you sure you want to delete this tweet?")) {
            await deleteDoc(doc(db, "tweets", tweet.id));
        }
    };

    if (!isOwner && isRestrictive && isChecking) {
        return null; // Don't show while checking
    }

    if (!canSee) return null;

    return (
        <article 
            className="border-b border-gray-800 p-4 hover:bg-gray-900/50 transition cursor-pointer flex gap-4"
            onClick={handleTap}
        >
            {/* Avatar */}
            <Link href={`/profile/${tweet.userId}`} onClick={(e) => e.stopPropagation()} className="shrink-0">
                <Avatar
                    src={author?.profileImage}
                    fallbackText={author?.displayName || author?.username}
                    size="lg"
                />
            </Link>

            <div className="flex-grow min-w-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[15px] min-w-0">
                        <Link
                            href={`/profile/${tweet.userId}`}
                            className="font-bold text-white hover:underline truncate"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {author?.displayName || author?.username || "Loading..."}
                        </Link>
                        <span className="text-gray-500 truncate ml-0.5">@{author?.username}</span>
                        <span className="text-gray-500 mx-1">·</span>
                        <span className="text-gray-500 hover:underline">
                            {tweet.createdAt?.toDate ? formatDistanceToNow(tweet.createdAt.toDate(), { addSuffix: true })
                                .replace('about ', '')
                                .replace('less than a minute ago', 'just now')
                                .replace(' minutes ago', 'm')
                                .replace(' minute ago', 'm')
                                .replace(' hours ago', 'h')
                                .replace(' hour ago', 'h')
                                : 'just now'}
                        </span>
                    </div>

                    {isOwner && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                            className="text-gray-500 hover:text-red-500 p-2 rounded-full hover:bg-red-500/10 transition"
                            title="Delete tweet"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Content - double tap to like, triple tap for comments */}
                <p 
                    className="text-white mt-1 whitespace-pre-wrap break-words"
                >{tweet.content}</p>

                {/* Media - double tap to like, triple tap for comments */}
                {tweet.mediaUrls && tweet.mediaUrls.length > 0 && (
                    <div 
                        className={cn(
                            "mt-3 mr-2 overflow-hidden rounded-2xl border border-gray-800 grid gap-0.5",
                            tweet.mediaUrls.length === 1 ? "grid-cols-1" : "grid-cols-2",
                            tweet.mediaUrls.length === 3 ? "grid-rows-2" : ""
                        )}
                    >
                        {tweet.mediaUrls.map((url, index) => {
                            const isVideo = url.toLowerCase().includes('.mp4') || 
                                           url.toLowerCase().includes('.mov') || 
                                           url.toLowerCase().includes('.webm') ||
                                           url.includes('video');

                            return (
                                <div 
                                    key={index} 
                                    className={cn(
                                        "relative overflow-hidden bg-gray-900 cursor-pointer group",
                                        tweet.mediaUrls!.length === 3 && index === 0 ? "row-span-2" : "aspect-video"
                                    )}
                                    onClick={(e) => {
                                        if (isVideo) {
                                            e.stopPropagation();
                                            router.push(`/videos?url=${encodeURIComponent(url)}`);
                                        } else {
                                            openLightbox(e, index);
                                        }
                                    }}
                                >
                                    {isVideo ? (
                                        <VideoItem url={url} />
                                    ) : (
                                        <img
                                            src={url}
                                            alt="Tweet media"
                                            className="w-full h-full object-cover group-hover:opacity-90 transition duration-200"
                                        />
                                    )}
                                    {/* Expand/play hint on hover */}
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200 pointer-events-none">
                                        <div className="bg-black/50 rounded-full p-3">
                                            {isVideo ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white fill-white" viewBox="0 0 24 24">
                                                    <path d="M8 5v14l11-7z"/>
                                                </svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                                                </svg>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between text-gray-500 mt-3 -ml-2 w-full max-w-md pr-4">
                    <button
                        className={cn("flex items-center gap-1 transition group", canReply ? 'hover:text-blue-500 cursor-pointer' : 'opacity-50 cursor-not-allowed')}
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if (canReply) {
                                setIsCommentModalOpen(true); 
                            } else {
                                alert(replyError || "You do not have permission to reply to this post.");
                            }
                        }}
                        title={canReply ? "Reply" : "You can't reply to this tweet"}
                    >
                        <div className={cn("p-2 rounded-full transition", canReply && 'group-hover:bg-blue-500/10')}>
                            <MessageCircle className="w-[18.75px] h-[18.75px]" />
                        </div>
                        <span className="text-[13px]">{tweet.commentsCount || 0}</span>
                    </button>

                    <button
                        className="flex items-center gap-1 hover:text-green-500 transition group"
                        onClick={(e) => { e.stopPropagation(); handleRetweet(); }}
                        disabled={isRetweeting}
                    >
                        <div className="p-2 rounded-full group-hover:bg-green-500/10 transition">
                            <Repeat2 className={cn("w-[18.75px] h-[18.75px]", { "text-green-500": hasRetweeted })} />
                        </div>
                        <span className={cn("text-[13px]", { "text-green-500": hasRetweeted })}>{tweet.retweetsCount || 0}</span>
                    </button>

                    <button
                        className="flex items-center gap-1 hover:text-pink-500 transition group"
                        onClick={(e) => { e.stopPropagation(); handleLike(); }}
                        disabled={isLiking}
                    >
                        <div className="p-2 rounded-full group-hover:bg-pink-500/10 transition">
                            <Heart className={cn("w-[18.75px] h-[18.75px]", { "fill-pink-500 text-pink-500": hasLiked })} />
                        </div>
                        <span className={cn("text-[13px]", { "text-pink-500": hasLiked })}>{tweet.likesCount || 0}</span>
                    </button>

                    <button
                        className="flex items-center gap-1 hover:text-blue-500 transition group"
                        onClick={(e) => { e.stopPropagation(); handleBookmark(); }}
                        disabled={isBookmarking}
                    >
                        <div className="p-2 rounded-full group-hover:bg-blue-500/10 transition">
                            <Bookmark className={cn("w-[18.75px] h-[18.75px]", { "fill-blue-500 text-blue-500": hasBookmarked })} />
                        </div>
                    </button>

                    <button
                        className="flex items-center gap-1 hover:text-blue-500 transition group"
                        onClick={(e) => { e.stopPropagation(); handleShare(); }}
                    >
                        <div className="p-2 rounded-full group-hover:bg-blue-500/10 transition">
                            <Share className="w-[18.75px] h-[18.75px]" />
                        </div>
                    </button>
                </div>
            </div>

            <CommentModal
                tweet={tweet}
                author={author}
                isOpen={isCommentModalOpen}
                onClose={() => setIsCommentModalOpen(false)}
            />

            {/* Fullscreen Media Lightbox — rendered via portal to avoid bubbling into article */}
            {mounted && lightboxIndex !== null && tweet.mediaUrls && ReactDOM.createPortal(
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-sm"
                    onClick={closeLightbox}
                >
                    {/* Top bar: author info + close */}
                    <div
                        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Author info */}
                        <Link
                            href={`/profile/${tweet.userId}`}
                            className="flex items-center gap-3 min-w-0"
                            onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
                        >
                            <Avatar
                                src={author?.profileImage}
                                fallbackText={author?.displayName || author?.username}
                                size="md"
                            />
                            <div className="min-w-0">
                                <p className="text-white font-bold text-[15px] leading-tight truncate">{author?.displayName || author?.username || 'Loading...'}</p>
                                <p className="text-gray-400 text-[13px] leading-tight truncate">@{author?.username}</p>
                            </div>
                        </Link>

                        <div className="flex items-center gap-2 shrink-0">
                            {/* Follow button — only show if not own post */}
                            {user && user.uid !== tweet.userId && (
                                <button
                                    onClick={handleLightboxFollow}
                                    disabled={isFollowingTweet}
                                    className={cn(
                                        "text-[14px] font-bold px-4 py-1 rounded-full transition",
                                        isFollowing
                                            ? "border border-gray-500 text-white hover:border-red-500 hover:text-red-500"
                                            : "bg-white text-black hover:bg-gray-200"
                                    )}
                                >
                                    {isFollowing ? "Following" : "Follow"}
                                </button>
                            )}

                            {/* Close */}
                            <button
                                className="bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition"
                                onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Counter */}
                    {tweet.mediaUrls.length > 1 && (
                        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
                            {lightboxIndex + 1} / {tweet.mediaUrls.length}
                        </div>
                    )}

                    {/* Prev Button */}
                    {lightboxIndex > 0 && (
                        <button
                            className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition"
                            onClick={lightboxPrev}
                        >
                            <ChevronLeft className="w-7 h-7" />
                        </button>
                    )}

                    {/* Next Button */}
                    {lightboxIndex < tweet.mediaUrls.length - 1 && (
                        <button
                            className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition"
                            onClick={lightboxNext}
                        >
                            <ChevronRight className="w-7 h-7" />
                        </button>
                    )}

                    {/* Media */}
                    <div
                        className="max-w-[95vw] max-h-[80vh] flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {(() => {
                            const url = tweet.mediaUrls![lightboxIndex];
                            const isVideo = url.toLowerCase().includes('.mp4') ||
                                url.toLowerCase().includes('.mov') ||
                                url.toLowerCase().includes('.webm') ||
                                url.includes('video');
                            return isVideo ? (
                                <video
                                    key={url}
                                    src={url}
                                    controls
                                    autoPlay
                                    className="max-w-[95vw] max-h-[80vh] rounded-xl object-contain"
                                />
                            ) : (
                                <img
                                    key={url}
                                    src={url}
                                    alt="Media"
                                    className="max-w-[95vw] max-h-[80vh] rounded-xl object-contain select-none"
                                />
                            );
                        })()}
                    </div>

                    {/* Bottom bar: actions + dot indicators */}
                    <div
                        className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Action buttons */}
                        <div className="flex items-center gap-1 bg-black/70 backdrop-blur-md rounded-full px-4 py-2 text-gray-300 border border-white/10 shadow-xl">
                            {/* Comment */}
                            <button
                                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full transition hover:text-blue-400 hover:bg-blue-500/10", !canReply && "opacity-40 cursor-not-allowed")}
                                onClick={(e) => { e.stopPropagation(); if (canReply) setIsCommentModalOpen(true); }}
                                title="Reply"
                            >
                                <MessageCircle className="w-5 h-5" />
                                <span className="text-sm">{tweet.commentsCount || 0}</span>
                            </button>

                            <div className="w-px h-5 bg-white/10" />

                            {/* Retweet */}
                            <button
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition hover:text-green-400 hover:bg-green-500/10"
                                onClick={(e) => { e.stopPropagation(); handleRetweet(); }}
                                disabled={isRetweeting}
                                title="Retweet"
                            >
                                <Repeat2 className={cn("w-5 h-5", hasRetweeted && "text-green-400")} />
                                <span className={cn("text-sm", hasRetweeted && "text-green-400")}>{tweet.retweetsCount || 0}</span>
                            </button>

                            <div className="w-px h-5 bg-white/10" />

                            {/* Like */}
                            <button
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition hover:text-pink-400 hover:bg-pink-500/10"
                                onClick={(e) => { e.stopPropagation(); handleLike(); }}
                                disabled={isLiking}
                                title="Like"
                            >
                                <Heart className={cn("w-5 h-5", hasLiked && "fill-pink-500 text-pink-500")} />
                                <span className={cn("text-sm", hasLiked && "text-pink-500")}>{tweet.likesCount || 0}</span>
                            </button>

                            <div className="w-px h-5 bg-white/10" />

                            {/* Bookmark */}
                            <button
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition hover:text-blue-400 hover:bg-blue-500/10"
                                onClick={(e) => { e.stopPropagation(); handleBookmark(); }}
                                disabled={isBookmarking}
                                title="Bookmark"
                            >
                                <Bookmark className={cn("w-5 h-5", hasBookmarked && "fill-blue-500 text-blue-500")} />
                            </button>

                            <div className="w-px h-5 bg-white/10" />

                            {/* Share */}
                            <button
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition hover:text-blue-400 hover:bg-blue-500/10"
                                onClick={(e) => { e.stopPropagation(); handleShare(); }}
                                title="Share"
                            >
                                <Share className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Dot indicators for multi-media */}
                        {tweet.mediaUrls.length > 1 && (
                            <div className="flex gap-2">
                                {tweet.mediaUrls.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                                        className={cn(
                                            "w-2 h-2 rounded-full transition",
                                            i === lightboxIndex ? "bg-white" : "bg-white/40"
                                        )}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {showBookmarkToast && (
                <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-[var(--color-twitter-blue)] text-white px-5 py-2.5 rounded-full shadow-lg z-[100] text-[15px] font-bold flex items-center gap-3">
                    Post added to your bookmarks
                    <Link href="/bookmarks" className="underline hover:text-gray-200">View</Link>
                </div>
            )}
        </article>
    );
});

export default Tweet;
