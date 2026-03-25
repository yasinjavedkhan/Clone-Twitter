"use client";

import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Bell, Info, Shield, CheckCircle2, MoreHorizontal, User, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: any;
}

export default function Notifications() {
    const { user } = useAuth();
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
        <div className="flex flex-col min-h-screen border-r border-gray-800 text-white">
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800 p-4">
                <h1 className="text-xl font-bold">Notifications</h1>
            </div>

            {loading ? (
                <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
                <div className="p-12 text-center max-w-sm mx-auto mt-12">
                    <h2 className="text-3xl font-bold mb-2">Nothing to see here — yet</h2>
                    <p className="text-gray-500 text-[15px]">
                        From likes to Retweets and a whole lot more, this is where all the action happens.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col">
                    {notifications.map((notif) => (
                        <div
                            key={notif.id}
                            onClick={() => !notif.read && markAsRead(notif.id)}
                            className={`p-4 border-b border-gray-800 hover:bg-white/5 transition cursor-pointer flex gap-4 ${!notif.read ? 'bg-twitter-blue/5' : ''}`}
                        >
                            <div className="shrink-0 mt-1">
                                {notif.type === 'system' && <Info className="w-5 h-5 text-twitter-blue" />}
                                {notif.type === 'security' && <Shield className="w-5 h-5 text-yellow-500" />}
                                {notif.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                                {notif.type === 'follow' && <User className="w-5 h-5 text-twitter-blue" />}
                                {notif.type === 'post' && <FileText className="w-5 h-5 text-twitter-blue" />}
                            </div>
                            <div className="flex flex-col flex-1 gap-1">
                                <div className="flex justify-between items-start">
                                    <span className="font-bold text-[15px]">{notif.title}</span>
                                    <span className="text-gray-500 text-[13px]">
                                        {notif.createdAt?.toDate ? formatDistanceToNow(notif.createdAt.toDate()) : 'Now'}
                                    </span>
                                </div>
                                <p className="text-gray-300 text-[14px] leading-tight mt-1">{notif.message}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
