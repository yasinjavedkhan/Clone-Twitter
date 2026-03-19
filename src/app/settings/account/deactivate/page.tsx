"use client";

import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, deleteDoc } from "firebase/firestore";
import { ArrowLeft, User } from "lucide-react";
import Link from "next/link";

export default function DeactivateAccount() {
    const { user, userData, signOut } = useAuth();

    const handleDeactivate = async () => {
        if (!userData || !user) return;

        const confirmResult = window.confirm("Are you absolutely sure you want to deactivate? This will delete your profile data.");
        if (confirmResult) {
            try {
                // In a real app we'd also delete tweets etc, but for now we delete user doc
                await deleteDoc(doc(db, "users", user.uid));
                await signOut();
                window.location.href = "/";
            } catch (error) {
                console.error("Error deactivating:", error);
                alert("Failed to deactivate. Please try again.");
            }
        }
    };

    return (
        <div className="flex flex-col min-h-screen border-r border-gray-800">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800 px-4 py-1 flex items-center gap-6 h-[53px]">
                <Link href="/settings/account" className="p-1.5 hover:bg-white/10 rounded-full transition -ml-1">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex flex-col">
                    <h1 className="text-xl font-bold leading-tight">Deactivate account</h1>
                    <p className="text-[13px] text-gray-500 leading-tight">@{userData?.username}</p>
                </div>
            </div>

            {/* Profile Brief */}
            <div className="p-4 flex items-center gap-3 border-b border-gray-800">
                <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                    {userData?.profileImage ? (
                        <img src={userData.profileImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <User className="w-7 h-7 text-gray-500" />
                    )}
                </div>
                <div className="flex flex-col">
                    <span className="font-bold text-white text-[15px]">{userData?.displayName || userData?.username}</span>
                    <span className="text-gray-500 text-[14px]">@{userData?.username}</span>
                </div>
            </div>

            {/* Deactivation Info */}
            <div className="p-4 flex flex-col gap-6">
                <div>
                    <h2 className="text-white text-xl font-bold mb-4">This will deactivate your account</h2>
                    <p className="text-[#71767b] text-[15px] leading-normal mb-4">
                        You're about to start the process of deactivating your X account. Your display name, @username, and public profile will no longer be viewable on X.com, X for iOS, or X for Android.
                    </p>
                </div>

                <div className="flex flex-col gap-4">
                    <h3 className="text-white font-bold text-[15px]">What else you should know</h3>
                    <ul className="list-disc pl-5 text-[#71767b] text-[14px] flex flex-col gap-3">
                        <li>You can restore your X account if it was accidentally or wrongfully deactivated for up to 30 days after deactivation.</li>
                        <li>Some account information may still be available in search engines like Google or Bing.</li>
                    </ul>
                </div>
            </div>

            {/* Deactivate Button Area */}
            <div className="mt-8 border-t border-gray-800 p-4 flex justify-center">
                <button
                    onClick={handleDeactivate}
                    className="text-red-500 hover:bg-red-500/10 transition px-6 py-3 rounded-full font-bold text-[15px]"
                >
                    Deactivate
                </button>
            </div>
        </div>
    );
}
