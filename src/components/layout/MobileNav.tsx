"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Bell, Mail, Bookmark } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

export default function MobileNav() {
    const pathname = usePathname();
    const { user, signInWithGoogle } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
    const [isNavVisible, setIsNavVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

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

        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            
            // Hide if scrolling down, show if scrolling up
            if (currentScrollY > lastScrollY && currentScrollY > 50) {
                setIsNavVisible(false);
            } else {
                setIsNavVisible(true);
            }
            
            setLastScrollY(currentScrollY);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, [lastScrollY]);

    const items = [
        { icon: Home, href: "/", label: "Home" },
        { icon: Search, href: "/explore", label: "Explore" },
        { icon: Bell, href: "/notifications", label: "Notifications", hasBadge: true },
        { icon: Mail, href: "/messages", label: "Messages" },
        { icon: Bookmark, href: "/bookmarks", label: "Bookmarks" },
    ];

    // If user is NOT logged in, show a sign-in banner instead
    if (!user) {
        return (
            <div className={`sm:hidden fixed left-0 right-0 bg-black border-t border-gray-800 z-50 transition-all duration-300 ${isNavVisible ? 'bottom-0' : '-bottom-20'}`}>
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex flex-col">
                        <span className="text-white font-bold text-[15px]">New to X?</span>
                        <span className="text-gray-500 text-xs">Sign in to start posting</span>
                    </div>
                    <button
                        onClick={signInWithGoogle}
                        className="flex items-center gap-2 bg-white text-black font-bold px-4 py-2 rounded-full text-[14px] hover:bg-gray-200 transition shrink-0"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Sign in with Google
                    </button>
                </div>
            </div>
        );
    }

    return (
        <nav 
            className={`sm:hidden fixed left-0 right-0 bg-black border-t border-gray-800 flex items-center justify-around h-14 z-50 px-2 transition-all duration-300 ${isNavVisible ? 'bottom-0' : '-bottom-16'}`}
        >
            {items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="p-2 relative group"
                    >
                        <Icon
                            className={`w-7 h-7 ${isActive ? 'text-white' : 'text-gray-500'}`}
                            fill={isActive ? "currentColor" : "none"}
                            strokeWidth={isActive ? 2.5 : 2}
                        />
                        {item.hasBadge && unreadCount > 0 && (
                            <div className="absolute top-1 right-1 bg-twitter-blue text-white text-[10px] font-bold min-w-[16px] h-[16px] rounded-full flex items-center justify-center border-2 border-black px-0.5">
                                {unreadCount > 9 ? "9+" : unreadCount}
                            </div>
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}
