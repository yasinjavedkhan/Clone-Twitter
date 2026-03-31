"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";

export default function BroadcastPage() {
    const { user } = useAuth();
    const [status, setStatus] = useState("Waiting for JD...");
    const [progress, setProgress] = useState(0);
    const [total, setTotal] = useState(0);

    const startBroadcast = async () => {
        setStatus("Fetching users for JD...");
        try {
            const usersSnap = await getDocs(collection(db, "users"));
            const users = usersSnap.docs;
            setTotal(users.length);
            setStatus(`JD is sending to ${users.length} users...`);

            // Detailed message for JD's owner announcement
            const broadcastMessage = "Hello! 📢 This is an announcement from JD (Javed Khan), the owner of this app. If there are any features or updates you'd like to see, please let me know and I will update it. My team and I are working hard to make this the best experience for you. Use it well and stay tuned! 🚀";

            for (let i = 0; i < users.length; i++) {
                const targetUserId = users[i].id;
                
                await addDoc(collection(db, "notifications"), {
                    userId: targetUserId,
                    type: "announcement",
                    title: "👑 Message from the Owner (JD)",
                    message: broadcastMessage,
                    read: false,
                    createdAt: serverTimestamp(),
                    from: "JD (Javed Khan)"
                });

                setProgress(i + 1);
            }

            setStatus("✅ Owner Broadcast Done! You can now close this page.");
        } catch (error: any) {
            console.error("JD Broadcast error:", error);
            setStatus(`❌ Error: ${error.message}`);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 text-center">
            <h1 className="text-3xl font-bold mb-8">JD (Owner) Broadcast 👑</h1>
            <div className="bg-gray-900 p-8 rounded-2xl border border-gray-800 w-full max-w-md shadow-2xl">
                <p className="text-xl mb-4">{status}</p>
                {total > 0 && (
                    <div className="w-full bg-gray-800 rounded-full h-4 mb-4 overflow-hidden">
                        <div 
                            className="bg-twitter-blue h-full transition-all duration-300"
                            style={{ width: `${(progress / total) * 100}%` }}
                        />
                    </div>
                )}
                <p className="text-gray-500 mb-8">
                    {progress} / {total} users notified
                </p>
                <button 
                    onClick={startBroadcast}
                    disabled={status.startsWith("JD is sending") || status.startsWith("✅")}
                    className="w-full bg-twitter-blue hover:bg-twitter-blue/90 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-full transition-all scale-110 active:scale-95 shadow-lg shadow-twitter-blue/20"
                >
                    🚀 Launch JD's Announcement
                </button>
            </div>
            <p className="mt-8 text-gray-400 text-sm">
                This will send your owner's message to EVERY platform user.
            </p>
        </div>
    );
}
