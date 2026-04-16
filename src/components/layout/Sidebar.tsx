"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    Home,
    Search,
    Bell,
    Mail,
    Bookmark,
    User,
    Settings, 
    Hash,
    X,
    Sparkles,
    MoonStar,
    Tv
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
    { label: "Home", href: "/", icon: Home, activeIcon: Home },
    { label: "Explore", href: "/explore", icon: Search, activeIcon: Search },
    { label: "Notifications", href: "/notifications", icon: Bell, activeIcon: Bell, hasBadge: true, badgeType: "notifications" },
    { label: "Messages", href: "/messages", icon: Mail, activeIcon: Mail, hasBadge: true, badgeType: "messages" },
    { label: "Grok", href: "/grok", icon: Sparkles, activeIcon: Sparkles },
    { label: "Live News", href: "/live-news", icon: Tv, activeIcon: Tv },
    { label: "Bookmarks", href: "/bookmarks", icon: Bookmark, activeIcon: Bookmark },
    { label: "Profile", href: "/profile", icon: User, activeIcon: User },
    { label: "Settings", href: "/settings", icon: Settings, activeIcon: Settings },
];

interface SidebarProps {
    onOpenCompose?: () => void;
}

export default function Sidebar({ onOpenCompose }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, userData, loading, error, signInWithGoogle, signOut, clearError } = useAuth();
    const { toggleTheme } = useTheme();
    const [unreadCount, setUnreadCount] = useState(0);
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, "notifications"),
            where("userId", "==", user.uid),
            where("read", "==", false)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setUnreadCount(snapshot.size);
        });

        const qMessages = query(
            collection(db, "conversations"),
            where("participants", "array-contains", user.uid)
        );

        const unsubscribeMessages = onSnapshot(qMessages, (snapshot) => {
            let count = 0;
            snapshot.docs.forEach((doc) => {
                const data = doc.data();
                if (data.unreadCount && data.unreadCount[user.uid]) {
                    count += data.unreadCount[user.uid];
                }
            });
            setUnreadMessagesCount(count);
        });

        return () => {
            unsubscribe();
            unsubscribeMessages();
        };
    }, [user]);

    return (
        <aside className="fixed left-0 top-0 h-screen w-20 xl:w-64 border-r border-[var(--tw-border-main)] hidden sm:flex flex-col items-center xl:items-stretch px-2 xl:px-4 py-4 z-50 bg-[var(--tw-bg-main)]">
            <Link href="/" className="flex items-center justify-center xl:justify-start p-3 w-fit rounded-full hover:bg-[var(--tw-text-main)]/10 transition mb-4">
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-[var(--tw-text-main)] fill-current">
                    <path d="M23.643 4.937c-.835.37-1.732.62-2.675.733.962-.576 1.7-1.49 2.048-2.578-.9.534-1.897.922-2.958 1.13-.85-.904-2.06-1.47-3.4-1.47-2.572 0-4.658 2.086-4.658 4.66 0 .364.042.718.12 1.06-3.873-.195-7.304-2.05-9.602-4.868-.4.69-.63 1.49-.63 2.342 0 1.616.823 3.043 2.072 3.878-.764-.025-1.482-.234-2.11-.583v.06c0 2.257 1.605 4.14 3.737 4.568-.392.106-.803.162-1.227.162-.3 0-.593-.028-.877-.082.593 1.85 2.313 3.198 4.352 3.234-1.595 1.25-3.604 1.995-5.786 1.995-.376 0-.747-.022-1.112-.065 2.062 1.323 4.51 2.093 7.14 2.093 8.57 0 13.255-7.098 13.255-13.254 0-.2-.005-.402-.014-.602.91-.658 1.7-1.477 2.323-2.41z"></path>
                </svg>
            </Link>

            <nav className="flex flex-col gap-2 w-full flex-grow">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = isActive ? item.activeIcon : item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-4 p-3 rounded-full hover:bg-[var(--tw-text-main)]/10 transition w-fit xl:w-full ${isActive ? 'font-bold' : ''}`}
                        >
                            <div className="relative">
                                <Icon className={`w-7 h-7 shrink-0 ${isActive ? 'fill-current' : ''}`} fill={isActive ? "currentColor" : "none"} strokeWidth={isActive ? 2.5 : 2} />
                                {item.hasBadge && (item.badgeType === 'messages' ? unreadMessagesCount : unreadCount) > 0 && (
                                    <div className="absolute -top-1 -right-1 bg-twitter-blue text-white text-[11px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 border-[var(--tw-bg-main)] px-1">
                                        {(item.badgeType === 'messages' ? unreadMessagesCount : unreadCount) > 9 ? "9+" : (item.badgeType === 'messages' ? unreadMessagesCount : unreadCount)}
                                    </div>
                                )}
                            </div>
                            <span className="hidden xl:inline text-xl">{item.label}</span>
                        </Link>
                    );
                })}

                {user ? (
                    <>
                        <button onClick={() => router.push('/compose/post')} className="twitter-button twitter-button-primary py-3.5 px-4 mt-4 text-[17px] w-full hidden xl:flex">
                            Post
                        </button>
                        <button onClick={() => router.push('/compose/post')} className="w-12 h-12 bg-[var(--tw-text-main)] text-[var(--tw-bg-main)] rounded-full flex items-center justify-center hover:opacity-90 transition mt-2 mx-auto xl:hidden shadow-md">
                            <span className="text-2xl font-bold leading-none -mt-1">+</span>
                        </button>
                    </>
                ) : null}

            </nav>

            {loading ? (
                <div className="mt-auto w-full p-4 flex justify-center items-center">
                    <div className="w-8 h-8 rounded-full border-2 border-[var(--color-twitter-blue)] border-t-transparent animate-spin"></div>
                </div>
            ) : user ? (
                <div className="mt-auto flex items-center justify-between w-full hover:bg-[var(--tw-text-main)]/10 p-3 rounded-full cursor-pointer transition group relative">
                    <Link href={`/profile/${user.uid}`} className="flex items-center gap-3 overflow-hidden flex-grow min-w-0">
                        <Avatar
                            src={userData?.profileImage}
                            fallbackText={userData?.displayName || userData?.username}
                        />
                        <div className="hidden xl:flex flex-col truncate">
                            <span className="font-bold text-[15px] truncate text-[var(--tw-text-main)]">{userData?.displayName || userData?.username}</span>
                            <span className="text-gray-500 text-[15px] truncate">@{userData?.username}</span>
                        </div>
                    </Link>
                    <div className="hidden xl:block shrink-0">
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleTheme();
                            }}
                            className="p-2 hover:bg-[var(--tw-text-main)]/10 rounded-full transition text-[var(--tw-text-muted)] hover:text-[var(--tw-text-main)]"
                            title="Display"
                        >
                            <MoonStar className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="mt-auto w-full group">
                    <div 
                        onClick={signInWithGoogle} 
                        className="flex items-center justify-between w-full hover:bg-white/10 p-3 rounded-full cursor-pointer transition border border-transparent hover:border-gray-800"
                        title="Sign in with Google"
                    >
                        <div className="flex items-center gap-3 overflow-hidden flex-grow min-w-0">
                            <Avatar
                                src=""
                                fallbackText="Guest"
                            />
                            <div className="hidden xl:flex flex-col truncate">
                                <span className="font-bold text-[15px] truncate text-white">Guest User</span>
                                <span className="text-gray-500 text-[13px] truncate">Sign in to post</span>
                            </div>
                        </div>
                    </div>
                    {error && (
                        <div className="mt-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl flex flex-col gap-1.5 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-red-500 uppercase tracking-wider">Auth Error</span>
                                <button onClick={clearError} className="text-gray-500 hover:text-white transition">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                            <p className="text-[12px] text-gray-300 leading-tight pr-2">
                                {error}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </aside>
    );
}
