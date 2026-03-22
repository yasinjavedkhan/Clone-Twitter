"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Heart, MessageCircle, Repeat2, Share, Trash2, User, Image, List, Smile, Calendar, MapPin, Globe, X, Bookmark } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, deleteDoc, setDoc, updateDoc, increment, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { cn } from "@/lib/utils";
import CommentModal from "./CommentModal";
import { userCache } from "@/lib/cache";
import Avatar from "@/components/ui/Avatar";

interface TweetProps {
    tweet: {
        id: string;
        userId: string;
        content: string;
        mediaUrls?: string[];
        replySetting?: 'everyone' | 'following' | 'mentions' | 'followers';
        likesCount: number;
        commentsCount: number;
        retweetsCount: number;
        viewsCount: number;
        createdAt: any;
        author?: {
            displayName: string;
            username: string;
            profileImage?: string;
        };
    };
}

export default function Tweet({ tweet }: TweetProps) {
    const { user, userData } = useAuth();
    const [author, setAuthor] = useState<any>(null);
    const [hasLiked, setHasLiked] = useState(false);
    const [hasRetweeted, setHasRetweeted] = useState(false);
    const [isLiking, setIsLiking] = useState(false);
    const [isRetweeting, setIsRetweeting] = useState(false);
    const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
    const [hasBookmarked, setHasBookmarked] = useState(false);
    const [isBookmarking, setIsBookmarking] = useState(false);
    const [showBookmarkToast, setShowBookmarkToast] = useState(false);
    const isRestrictive = tweet.replySetting && tweet.replySetting !== 'everyone';
    const isOwner = user?.uid === tweet.userId;
    const [canSee, setCanSee] = useState(!isRestrictive || isOwner);
    const [canReply, setCanReply] = useState(!isRestrictive || isOwner);
    const [replyError, setReplyError] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(isRestrictive && !isOwner);

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
        const shareUrl = `${window.location.origin}/profile/${tweet.userId}`; // Or a specific tweet page if available
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Check out this post!',
                    text: tweet.content,
                    url: shareUrl,
                });
            } catch (error: any) {
                if (error.name !== 'AbortError') {
                    console.error("Error sharing:", error);
                }
                // AbortError means user cancelled sharing, so we do nothing
            }
        } else {
            // Fallback: Copy to clipboard
            navigator.clipboard.writeText(shareUrl);
            alert("Link copied to clipboard!");
        }
    };

    const handleDelete = async () => {
        if (confirm("Are you sure you want to delete this tweet?")) {
            await deleteDoc(doc(db, "tweets", tweet.id));
        }
    };

    if (!isOwner && isRestrictive && isChecking) {
        return null; // Don't show while checking
    }

    if (!canSee) return null;

    return (
        <article className="border-b border-gray-800 p-4 hover:bg-gray-900/50 transition cursor-pointer flex gap-4">
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

                {/* Content */}
                <p className="text-white mt-1 whitespace-pre-wrap break-words">{tweet.content}</p>

                {/* Media */}
                {tweet.mediaUrls && tweet.mediaUrls.length > 0 && (
                    <div className={cn(
                        "mt-3 mr-2 overflow-hidden rounded-2xl border border-gray-800 grid gap-0.5",
                        tweet.mediaUrls.length === 1 ? "grid-cols-1" : "grid-cols-2",
                        tweet.mediaUrls.length === 3 ? "grid-rows-2" : ""
                    )}>
                        {tweet.mediaUrls.map((url, index) => {
                            const isVideo = url.toLowerCase().includes('.mp4') || 
                                           url.toLowerCase().includes('.mov') || 
                                           url.toLowerCase().includes('.webm') ||
                                           url.includes('video'); // Backup check for the way we name files

                            return (
                                <div 
                                    key={index} 
                                    className={cn(
                                        "relative overflow-hidden bg-gray-900",
                                        tweet.mediaUrls!.length === 3 && index === 0 ? "row-span-2" : "aspect-video"
                                    )}
                                >
                                    {isVideo ? (
                                        <video
                                            src={url}
                                            controls
                                            className="w-full h-full object-cover"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <img
                                            src={url}
                                            alt="Tweet media"
                                            className="w-full h-full object-cover hover:opacity-95 transition"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    )}
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

            {showBookmarkToast && (
                <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-[var(--color-twitter-blue)] text-white px-5 py-2.5 rounded-full shadow-lg z-[100] text-[15px] font-bold flex items-center gap-3">
                    Post added to your bookmarks
                    <Link href="/bookmarks" className="underline hover:text-gray-200">View</Link>
                </div>
            )}
        </article>
    );
}
