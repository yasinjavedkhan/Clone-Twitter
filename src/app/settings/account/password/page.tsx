"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Key } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function ChangePassword() {
    const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            alert("New passwords do not match!");
            return;
        }
        alert("Password updated successfully! (Basic simulation)");
    };

    return (
        <div className="flex flex-col min-h-screen border-r border-gray-800">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800 px-4 py-1 flex items-center gap-6 h-[53px]">
                <Link href="/settings/account" className="p-1.5 hover:bg-white/10 rounded-full transition -ml-1">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-xl font-bold">Change your password</h1>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-6">
                <div className="flex flex-col gap-4">
                    <div className="border border-gray-800 rounded-md p-3 focus-within:border-twitter-blue transition text-white">
                        <label className="text-gray-500 text-[13px] block">Current password</label>
                        <input
                            type="password"
                            className="bg-transparent text-white w-full outline-none mt-1"
                            placeholder="Enter current password"
                            value={passwords.current}
                            onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                        />
                    </div>
                    <div className="border border-gray-800 rounded-md p-3 focus-within:border-twitter-blue transition text-white">
                        <label className="text-gray-500 text-[13px] block">New password</label>
                        <input
                            type="password"
                            className="bg-transparent text-white w-full outline-none mt-1"
                            placeholder="Enter new password"
                            value={passwords.new}
                            onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                        />
                    </div>
                    <div className="border border-gray-800 rounded-md p-3 focus-within:border-twitter-blue transition text-white">
                        <label className="text-gray-500 text-[13px] block">Confirm password</label>
                        <input
                            type="password"
                            className="bg-transparent text-white w-full outline-none mt-1"
                            placeholder="Confirm new password"
                            value={passwords.confirm}
                            onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                        />
                    </div>
                </div>

                <div className="mt-4 flex justify-end">
                    <button
                        type="submit"
                        className="bg-white text-black px-6 py-2 rounded-full font-bold hover:bg-[#d7dbdc] transition"
                    >
                        Save
                    </button>
                </div>
            </form>

            <div className="p-8 text-center mt-12">
                <div className="w-16 h-16 rounded-full bg-twitter-blue/10 flex items-center justify-center mx-auto mb-4">
                    <Key className="w-8 h-8 text-twitter-blue" />
                </div>
                <h2 className="text-xl font-bold mb-2">Secure your account</h2>
                <p className="text-gray-500 text-[14px]">Update your password to keep your account safe.</p>
            </div>
        </div>
    );
}
