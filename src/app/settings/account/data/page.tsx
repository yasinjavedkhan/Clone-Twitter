"use client";

import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from "firebase/firestore";
import { ArrowLeft, Download, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function DownloadData() {
    const { user, userData } = useAuth();
    const [status, setStatus] = useState<"idle" | "loading" | "pending" | "success">("idle");

    useEffect(() => {
        const checkExistingRequest = async () => {
            if (!user) return;
            setStatus("loading");
            try {
                const q = query(
                    collection(db, "dataRequests"),
                    where("userId", "==", user.uid),
                    where("status", "==", "pending"),
                    limit(1)
                );
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    setStatus("pending");
                } else {
                    setStatus("idle");
                }
            } catch (error) {
                console.error("Error checking request:", error);
                setStatus("idle");
            }
        };

        checkExistingRequest();
    }, [user]);

    const handleRequest = async () => {
        if (!user || status !== "idle") return;

        setStatus("loading");
        try {
            // 1. Create Data Request
            await addDoc(collection(db, "dataRequests"), {
                userId: user.uid,
                username: userData?.username,
                email: user.email,
                status: "pending",
                requestedAt: serverTimestamp()
            });

            // 2. Create Notification for User
            await addDoc(collection(db, "notifications"), {
                userId: user.uid,
                type: "system",
                title: "Data Archive Requested",
                message: "We've received your request for a data archive. It will be ready for download within 24 hours.",
                read: false,
                createdAt: serverTimestamp()
            });

            setStatus("pending");
            alert("Request submitted! You will receive a notification when it's ready.");
        } catch (error) {
            console.error("Error submitting request:", error);
            alert("Failed to submit request. Please try again.");
            setStatus("idle");
        }
    };

    return (
        <div className="flex flex-col min-h-screen border-r border-gray-800 text-white">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800 px-4 py-1 flex items-center gap-6 h-[53px]">
                <Link href="/settings/account" className="p-1.5 hover:bg-white/10 rounded-full transition -ml-1">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-xl font-bold">Download your data</h1>
            </div>

            <div className="p-4 flex flex-col gap-6">
                <div className="p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-twitter-blue/10 flex items-center justify-center mx-auto mb-4">
                        {status === "pending" ? (
                            <CheckCircle2 className="w-8 h-8 text-twitter-blue" />
                        ) : (
                            <Download className="w-8 h-8 text-twitter-blue" />
                        )}
                    </div>

                    {status === "pending" ? (
                        <>
                            <h2 className="text-2xl font-bold mb-2">Request Pending</h2>
                            <p className="text-gray-500 text-[15px] max-w-sm mx-auto mb-8">
                                Your request is being processed. We'll notify you via your notifications tab when the archive is ready.
                            </p>
                            <div className="bg-white/5 p-4 rounded-xl inline-block">
                                <span className="text-twitter-blue font-medium">Status: Processing...</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <h2 className="text-2xl font-bold mb-2">Request your archive</h2>
                            <p className="text-gray-500 text-[15px] max-w-sm mx-auto mb-8">
                                Get an archive of your account information, history, and activity on X. We’ll notify you when it’s ready to download.
                            </p>
                            <button
                                onClick={handleRequest}
                                disabled={status === "loading"}
                                className="bg-white text-black px-6 py-2.5 rounded-full font-bold hover:bg-[#d7dbdc] transition disabled:opacity-50 flex items-center gap-2 mx-auto"
                            >
                                {status === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
                                Request archive
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
