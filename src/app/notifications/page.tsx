"use client";

import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Bell, Info, Shield, CheckCircle2, MoreHorizontal, User, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import NotificationDiagnostic from "@/components/settings/NotificationDiagnostic";
import Avatar from "@/components/ui/Avatar";

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: any;
}

export default function Notifications() {
    const { user, userData } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, "notifications"),
            where("userId", "==", user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            try {
                const notifs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Notification[];
                
                // Sort in memory to avoid missing index errors
                const sortedNotifs = notifs.sort((a, b) => {
                    const timeA = a.createdAt?.seconds || 0;
                    const timeB = b.createdAt?.seconds || 0;
                    return timeB - timeA;
                });
                
                setNotifications(sortedNotifs);
            } catch (error) {
                console.error("Error processing notifications:", error);
            } finally {
                setLoading(false);
            }
        }, (error) => {
            console.error("Error fetching notifications:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const markAsRead = async (id: string) => {
        try {
            await updateDoc(doc(db, "notifications", id), { read: true });
        } catch (error) {
            console.error("Error marking as read:", error);
        }
    };

    return (
        <div className="flex flex-col min-h-screen border-r border-[var(--tw-border-main)] bg-[var(--tw-bg-main)]">
            {/* Header */}
            <div className="sticky top-0 z-20 glass-card px-4 h-[60px] flex items-center gap-4 transition-all duration-300">
                {user && (
                    <button 
                        onClick={() => window.dispatchEvent(new CustomEvent("toggleMobileDrawer"))}
                        className="sm:hidden p-0.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                    >
                        <Avatar
                            src={userData?.profileImage}
                            fallbackText={userData?.displayName || userData?.username}
                            size="md"
                        />
                    </button>
                )}
                <h1 className="text-xl font-extrabold tracking-tight text-[var(--tw-text-main)]">Notifications</h1>
            </div>

            <div className="hidden p-4 border-b border-[var(--tw-border-main)]">
                <NotificationDiagnostic />
            </div>

            <main className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-20 gap-4">
                        <div className="w-10 h-10 border-4 border-twitter-blue border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-[var(--tw-text-muted)] font-medium animate-pulse">Filtering your highlights...</p>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center max-w-sm mx-auto mt-20 animate-in fade-in zoom-in duration-500">
                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mb-6 shadow-inner">
                            <Bell className="w-10 h-10 text-twitter-blue" />
                        </div>
                        <h2 className="text-3xl font-black mb-3 text-[var(--tw-text-main)]">Nothing to see here — yet</h2>
                        <p className="text-[var(--tw-text-muted)] text-[15px] leading-relaxed">
                            From likes to Retweets and a whole lot more, this is where all the action happens. Keep exploring!
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col divide-y divide-[var(--tw-border-main)]">
                        {notifications.map((notif, index) => (
                            <div
                                key={notif.id}
                                onClick={() => !notif.read && markAsRead(notif.id)}
                                style={{ animationDelay: `${index * 50}ms` }}
                                className={`group p-4 transition-all duration-300 cursor-pointer flex gap-4 animate-in slide-in-from-bottom-2 fade-in
                                    ${!notif.read 
                                        ? 'bg-gradient-to-r from-twitter-blue/10 to-transparent border-l-4 border-l-twitter-blue' 
                                        : 'hover:bg-[var(--tw-bg-card)]/50'
                                    }`}
                            >
                                <div className="shrink-0 mt-1 relative">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110 
                                        ${notif.type === 'system' ? 'bg-indigo-500/10 text-indigo-500' : 
                                          notif.type === 'announcement' ? 'bg-yellow-500/10 text-yellow-500' :
                                          notif.type === 'security' ? 'bg-orange-500/10 text-orange-500' :
                                          notif.type === 'success' ? 'bg-green-500/10 text-green-500' :
                                          notif.type === 'follow' ? 'bg-blue-500/10 text-blue-500' :
                                          'bg-gray-500/10 text-gray-400'}`}
                                    >
                                        {notif.type === 'system' && <Info className="w-6 h-6" />}
                                        {notif.type === 'announcement' && <Bell className="w-6 h-6 fill-current/20" />}
                                        {notif.type === 'security' && <Shield className="w-6 h-6" />}
                                        {notif.type === 'success' && <CheckCircle2 className="w-6 h-6" />}
                                        {notif.type === 'follow' && <User className="w-6 h-6" />}
                                        {notif.type === 'post' && <FileText className="w-6 h-6" />}
                                    </div>
                                    {!notif.read && (
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-twitter-blue rounded-full ring-2 ring-[var(--tw-bg-main)]"></div>
                                    )}
                                </div>
                                
                                <div className="flex flex-col flex-1 min-w-0">
                                    <div className="flex justify-between items-start gap-2">
                                        <span className={`font-bold text-[16px] truncate ${!notif.read ? 'text-[var(--tw-text-main)]' : 'text-[var(--tw-text-muted)]'}`}>
                                            {notif.title}
                                        </span>
                                        <span className="text-[var(--tw-text-muted)] text-[12px] whitespace-nowrap font-medium mt-0.5">
                                            {notif.createdAt?.toDate ? formatDistanceToNow(notif.createdAt.toDate()) : 'Now'}
                                        </span>
                                    </div>
                                    <p className={`text-[14px] leading-snug mt-1 transition-colors
                                        ${!notif.read ? 'text-[var(--tw-text-main)]' : 'text-[var(--tw-text-muted)]'}`}>
                                        {notif.message}
                                    </p>
                                </div>
                                
                                <div className="shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-2 hover:bg-white/10 rounded-full text-[var(--tw-text-muted)]">
                                        <MoreHorizontal className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
