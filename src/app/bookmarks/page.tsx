"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, orderBy } from "firebase/firestore";
import Tweet from "@/components/tweet/Tweet";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";

export default function Bookmarks() {
    const { user, userData } = useAuth();
    const [bookmarks, setBookmarks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBookmarks = async () => {
            if (!user) {
                setLoading(false);
                return;
            }

            try {
                const bookmarksQuery = query(
                    collection(db, "bookmarks"),
                    where("userId", "==", user.uid)
                );

                const snapshot = await getDocs(bookmarksQuery);
                const tweetPromises = snapshot.docs.map(async (bookmarkDoc) => {
                    const data = bookmarkDoc.data();
                    const tweetId = data.tweetId;
                    const tweetDoc = await getDoc(doc(db, "tweets", tweetId));
                    if (tweetDoc.exists()) {
                        return { 
                            id: tweetDoc.id, 
                            ...tweetDoc.data(),
                            bookmarkCreatedAt: data.createdAt 
                        };
                    }
                    return null;
                });

                const tweets = await Promise.all(tweetPromises);
                const validTweets = tweets.filter(t => t !== null);
                
                // Sort in memory
                const sortedTweets = validTweets.sort((a: any, b: any) => {
                    const timeA = a.bookmarkCreatedAt?.seconds || 0;
                    const timeB = b.bookmarkCreatedAt?.seconds || 0;
                    return timeB - timeA;
                });

                setBookmarks(sortedTweets);
            } catch (error) {
                console.error("Error fetching bookmarks:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchBookmarks();
    }, [user]);

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-gray-500 h-[80vh]">
                <h2 className="text-2xl font-bold text-white mb-2">Save Tweets for later</h2>
                <p className="text-gray-500 mb-6 max-w-sm text-center">
                    Don’t let the good stuff get away! Mastermind your bookmarks to keep important Tweets handy.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen border-r border-gray-800">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800 p-4 flex items-center gap-4">
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
                <div className="flex flex-col">
                    <h1 className="text-xl font-bold leading-tight">Bookmarks</h1>
                    <p className="text-sm text-gray-500 leading-tight">@{userData?.username || user.email?.split("@")[0]}</p>
                </div>
            </div>

            {/* Feed */}
            <div className="flex flex-col">
                {loading ? (
                    <div className="p-8 text-center text-gray-500 italic">Finding your bookmarks...</div>
                ) : bookmarks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                        <h2 className="text-3xl font-bold text-white mb-2">Save Tweets for later</h2>
                        <p className="text-gray-500 max-w-sm">
                            Don’t let the good stuff get away! Bookmark Tweets to easily find them again in the future.
                        </p>
                    </div>
                ) : (
                    bookmarks.map((tweet) => (
                        <Tweet key={tweet.id} tweet={tweet} />
                    ))
                )}
            </div>
        </div>
    );
}
