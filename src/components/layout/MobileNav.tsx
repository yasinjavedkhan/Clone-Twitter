"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Bell, Mail, Bookmark, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

export default function MobileNav() {
    const pathname = usePathname();
    const { user, signInWithGoogle } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
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

    useEffect(() => {
        const handleScroll = () => {
            // Only apply this behavior on the Home page
            if (pathname !== "/") {
                setIsNavVisible(true);
                return;
            }

            const currentScrollY = window.scrollY;
            
            // Hide if scrolling down, show if scrolling up
            if (currentScrollY > lastScrollY && currentScrollY > 50) {
                setIsNavVisible(false);
            } else {
                setIsNavVisible(true);
            }
            
            if (currentScrollY < 50) {
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
        { icon: Sparkles, href: "/grok", label: "Grok" },
        { icon: Bell, href: "/notifications", label: "Notifications", hasBadge: true, badgeType: 'notifications' },
        { icon: Mail, href: "/messages", label: "Messages", hasBadge: true, badgeType: 'messages' },
    ];


    return (
        <nav 
            className={`sm:hidden fixed left-0 right-0 bg-black/95 backdrop-blur-md border-t border-gray-800 flex items-center justify-around z-50 px-2 transition-transform duration-300 ${isNavVisible ? 'translate-y-0' : 'translate-y-full'} bottom-0 pb-[env(safe-area-inset-bottom)] h-[calc(56px+env(safe-area-inset-bottom))]`}
        >
            {items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="p-1.5 relative group"
                    >
                        <Icon
                            className={`w-6 h-6 ${isActive ? 'text-white' : 'text-gray-500'}`}
                            fill={isActive ? "currentColor" : "none"}
                            strokeWidth={isActive ? 2.5 : 2}
                        />
                        {item.hasBadge && (item.badgeType === 'messages' ? unreadMessagesCount : unreadCount) > 0 && (
                            <div className="absolute top-1 right-1 bg-twitter-blue text-white text-[10px] font-bold min-w-[16px] h-[16px] rounded-full flex items-center justify-center border-2 border-black px-0.5">
                                {(item.badgeType === 'messages' ? unreadMessagesCount : unreadCount) > 9 ? "9+" : (item.badgeType === 'messages' ? unreadMessagesCount : unreadCount)}
                            </div>
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}
