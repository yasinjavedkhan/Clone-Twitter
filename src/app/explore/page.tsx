"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, limit } from "firebase/firestore";
import Tweet from "@/components/tweet/Tweet";
import { Search } from "lucide-react";

export default function Explore() {
    const { user } = useAuth();
    const [tweets, setTweets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const fetchGlobalFeed = async () => {
            try {
                const q = query(
                    collection(db, "tweets"),
                    limit(20)
                );
                const snapshot = await getDocs(q);
                const tweetsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Sort in memory
                const sorted = tweetsData.sort((a: any, b: any) => {
                    const timeA = a.createdAt?.seconds || 0;
                    const timeB = b.createdAt?.seconds || 0;
                    return timeB - timeA;
                });

                setTweets(sorted);
            } catch (error) {
                console.error("Error fetching explore feed:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchGlobalFeed();
    }, []);

    const filteredTweets = tweets.filter(tweet => {
        if (!searchQuery.trim()) return false;
        const query = searchQuery.toLowerCase();
        return (
            tweet.content?.toLowerCase().includes(query) ||
            tweet.authorName?.toLowerCase().includes(query) ||
            tweet.authorUsername?.toLowerCase().includes(query)
        );
    });

    return (
        <div className="flex flex-col min-h-screen border-r border-gray-800">
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800 p-2 sm:p-4">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-4.5 h-4.5" />
                    <input
                        type="text"
                        placeholder="Search Explore"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-[#202327] text-white rounded-full py-2.5 pl-12 pr-4 w-full focus:bg-black focus:border-[var(--color-twitter-blue)] border border-transparent outline-none transition text-[15px] placeholder:text-gray-500"
                    />
                </div>
            </div>

            <div className="flex flex-col">
                {loading ? (
                    <div className="p-8 text-center text-gray-500 italic">Loading...</div>
                ) : !searchQuery.trim() ? (
                    <div className="p-12 text-center text-gray-500">
                        <p className="text-xl font-bold text-white mb-2">Search for content</p>
                        <p className="text-sm text-[#71767b]">Find tweets and users from around the world.</p>
                    </div>
                ) : filteredTweets.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 italic">
                        No results found for "{searchQuery}"
                    </div>
                ) : (
                    filteredTweets.map((tweet) => (
                        <Tweet key={tweet.id} tweet={tweet} />
                    ))
                )}
            </div>
        </div>
    );
}
