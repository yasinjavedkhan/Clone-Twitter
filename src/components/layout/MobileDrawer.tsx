"use client";

import React from "react";
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
    MoonStar
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getCountFromServer } from "firebase/firestore";

const NAV_ITEMS = [
    { label: "Home", href: "/", icon: Home },
    { label: "Explore", href: "/explore", icon: Search },
    { label: "Notifications", href: "/notifications", icon: Bell },
    { label: "Messages", href: "/messages", icon: Mail },
    { label: "Grok", href: "/grok", icon: Sparkles },
    { label: "Bookmarks", href: "/bookmarks", icon: Bookmark },
    { label: "Profile", href: "/profile", icon: User },
    { label: "Settings", href: "/settings", icon: Settings },
    { label: "Install App", href: "/settings/install", icon: Smartphone },
];

interface MobileDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, userData, signOut } = useAuth();
    const { toggleTheme } = useTheme();
    const [counts, setCounts] = React.useState({ following: 0, followers: 0 });

    React.useEffect(() => {
        if (!user?.uid || !isOpen) return;

        const fetchCounts = async () => {
            try {
                const followingQuery = query(collection(db, "follows"), where("followerId", "==", user.uid));
                const followersQuery = query(collection(db, "follows"), where("followingId", "==", user.uid));
                
                const [followingSnap, followersSnap] = await Promise.all([
                    getCountFromServer(followingQuery),
                    getCountFromServer(followersQuery)
                ]);

                setCounts({
                    following: followingSnap.data().count,
                    followers: followersSnap.data().count
                });
            } catch (error) {
                console.error("Error fetching drawer counts:", error);
            }
        };

        fetchCounts();
    }, [user?.uid, isOpen]);

    if (!user) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60] sm:hidden"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: "-100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "-100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed top-0 left-0 h-full w-[280px] bg-[var(--tw-bg-main)] border-r border-[var(--tw-border-main)] z-[70] sm:hidden flex flex-col shadow-2xl transition-colors"
                    >
                        {/* User Profile Header Section */}
                        <div className="p-6 border-b border-[var(--tw-border-main)]">
                            <div className="flex flex-col gap-3">
                                <Link href={`/profile/${user.uid}`} onClick={onClose}>
                                    <Avatar
                                        src={userData?.profileImage}
                                        fallbackText={userData?.displayName || userData?.username}
                                        size="lg"
                                    />
                                </Link>
                                <div className="flex flex-col min-w-0 mt-1">
                                    <span className="font-extrabold text-[var(--tw-text-main)] text-[18px] leading-tight truncate">
                                        {userData?.displayName || userData?.username}
                                    </span>
                                    <span className="text-[var(--tw-text-muted)] text-[15px] truncate">
                                        @{userData?.username}
                                    </span>
                                </div>
                                <div className="flex gap-4 mt-1">
                                    <div className="flex items-center gap-1 hover:underline cursor-pointer" onClick={() => { onClose(); router.push(`/profile/${user.uid}`); }}>
                                        <span className="font-bold text-[var(--tw-text-main)] text-[14px]">{counts.following}</span>
                                        <span className="text-[var(--tw-text-muted)] text-[14px]">Following</span>
                                    </div>
                                    <div className="flex items-center gap-1 hover:underline cursor-pointer" onClick={() => { onClose(); router.push(`/profile/${user.uid}`); }}>
                                        <span className="font-bold text-[var(--tw-text-main)] text-[14px]">{counts.followers}</span>
                                        <span className="text-[var(--tw-text-muted)] text-[14px]">Followers</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Navigation Items */}
                        <div className="flex-grow overflow-y-auto py-2">
                            <nav className="flex flex-col">
                                {NAV_ITEMS.map((item) => {
                                    const isActive = pathname === item.href;
                                    const Icon = item.icon;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={onClose}
                                            className={`flex items-center gap-5 px-6 py-4 hover:bg-[var(--tw-text-main)]/10 transition ${
                                                isActive ? "font-bold text-[var(--tw-text-main)] bg-[var(--tw-text-main)]/5" : "text-[var(--tw-text-main)]"
                                            }`}
                                        >
                                            <Icon className={`w-6 h-6 ${isActive ? "text-[var(--tw-text-main)]" : "text-[var(--tw-text-muted)]"}`} />
                                            <span className="text-[19px]">{item.label}</span>
                                        </Link>
                                    );
                                })}
                            </nav>

                            {/* Mobile Post Button as seen in screenshot */}
                            <div className="px-6 mt-6">
                                <button 
                                    onClick={() => {
                                        onClose();
                                        router.push('/compose/post');
                                    }}
                                    className="w-full bg-[#1d9bf0] text-white font-bold py-3.5 rounded-full shadow-lg active:scale-95 transition text-[17px]"
                                >
                                    Post
                                </button>
                            </div>
                        </div>

                        {/* Footer / User Profile section */}
                        <div className="p-4 border-t border-[var(--tw-border-main)]">
                             <div className="flex items-center justify-between w-full hover:bg-[var(--tw-text-main)]/10 p-2 rounded-full transition group cursor-pointer">
                                <Link href={`/profile/${user.uid}`} onClick={onClose} className="flex items-center gap-3 flex-grow overflow-hidden">
                                    <Avatar
                                        src={userData?.profileImage}
                                        fallbackText={userData?.displayName || userData?.username}
                                        size="md"
                                    />
                                    <div className="flex flex-col truncate">
                                        <span className="font-bold text-[15px] truncate text-[var(--tw-text-main)]">
                                            {userData?.displayName || userData?.username}
                                        </span>
                                        <span className="text-[var(--tw-text-muted)] text-[13px] truncate">
                                            @{userData?.username}
                                        </span>
                                    </div>
                                </Link>
                                <button
                                    onClick={() => {
                                        toggleTheme();
                                    }}
                                    className="p-2 hover:bg-[var(--tw-text-main)]/10 rounded-full transition text-[var(--tw-text-muted)] hover:text-[var(--tw-text-main)]"
                                    title="Display"
                                >
                                    <MoonStar className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
