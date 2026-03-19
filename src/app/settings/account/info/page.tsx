"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, User, Mail, Calendar, Smartphone, Globe } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export default function AccountInfo() {
    const { user, userData } = useAuth();

    const joinDate = userData?.createdAt?.toDate
        ? format(userData.createdAt.toDate(), 'MMMM d, yyyy')
        : 'Unknown';

    const infoItems = [
        {
            label: "Username",
            value: `@${userData?.username}`,
            editable: true
        },
        {
            label: "Phone",
            value: "Add a phone number",
            editable: true,
            isPlaceholder: true
        },
        {
            label: "Email",
            value: user?.email || "Add an email address",
            editable: true
        },
        {
            label: "Country",
            value: "India",
            editable: true
        },
        {
            label: "Gender",
            value: "Add your gender",
            editable: true,
            isPlaceholder: true
        },
        {
            label: "Birth date",
            value: "Add your birth date",
            editable: true,
            isPlaceholder: true
        },
        {
            label: "Age",
            value: "Add your age",
            editable: true,
            isPlaceholder: true
        }
    ];

    return (
        <div className="flex flex-col min-h-screen border-r border-gray-800">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800 px-4 py-1 flex items-center gap-6 h-[53px]">
                <Link href="/settings/account" className="p-1.5 hover:bg-white/10 rounded-full transition -ml-1">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex flex-col">
                    <h1 className="text-xl font-bold leading-tight">Account information</h1>
                    <p className="text-[13px] text-gray-500 leading-tight">@{userData?.username}</p>
                </div>
            </div>

            {/* Info List */}
            <div className="flex flex-col">
                {infoItems.map((item, index) => (
                    <div
                        key={index}
                        className="p-4 hover:bg-white/5 transition flex flex-col cursor-pointer border-b border-gray-800"
                    >
                        <span className="text-gray-500 text-[13px] mb-0.5">{item.label}</span>
                        <span className={`text-[15px] ${item.isPlaceholder ? 'text-twitter-blue' : 'text-white'}`}>
                            {item.value}
                        </span>
                    </div>
                ))}

                <div className="p-4 hover:bg-white/5 transition flex flex-col border-b border-gray-800">
                    <span className="text-gray-500 text-[13px] mb-0.5">Account creation</span>
                    <span className="text-white text-[15px]">{joinDate}</span>
                </div>
            </div>

            {/* Footer Note */}
            <div className="p-4">
                <p className="text-[13px] text-gray-500">
                    Some of your account information is private and not visible to others.
                </p>
            </div>
        </div>
    );
}
