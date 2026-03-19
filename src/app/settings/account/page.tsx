"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, User, Mail, Shield, Smartphone, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function AccountSettings() {
    const { user, userData } = useAuth();

    const accountOptions = [
        {
            title: "Account information",
            description: "See your account information like your phone number and email address.",
            icon: <User className="w-5 h-5" />,
            value: `@${userData?.username}`,
            href: "/settings/account/info"
        },
        {
            title: "Change your password",
            description: "Change your password at any time.",
            icon: <Shield className="w-5 h-5" />,
            href: "/settings/account/password"
        },
        {
            title: "Download an archive of your data",
            description: "Get insights into the type of information stored for your account.",
            icon: <Smartphone className="w-5 h-5" />,
            href: "/settings/account/data"
        },
        {
            title: "Deactivate your account",
            description: "Find out how you can deactivate your account.",
            icon: <span className="text-red-500 font-bold ml-1">X</span>,
            isCritical: true,
            href: "/settings/account/deactivate"
        }
    ];

    return (
        <div className="flex flex-col min-h-screen border-r border-gray-800">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800 px-4 py-1 flex items-center gap-6 h-[53px]">
                <Link href="/settings" className="p-1.5 hover:bg-white/10 rounded-full transition -ml-1">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-xl font-bold">Your Account</h1>
            </div>

            {/* Description */}
            <div className="px-4 py-6 border-b border-gray-800">
                <p className="text-[13px] text-gray-500 leading-tight">
                    See information about your account, download an archive of your data, or learn about your account deactivation options.
                </p>
            </div>

            {/* Options List */}
            <div className="flex flex-col">
                {accountOptions.map((opt, index) => (
                    <Link
                        key={index}
                        href={opt.href}
                        className="p-4 hover:bg-white/5 transition flex items-center gap-4 cursor-pointer"
                    >
                        <div className="text-gray-500">
                            {opt.icon}
                        </div>
                        <div className="flex flex-col flex-1">
                            <span className={`text-[15px] font-medium leading-tight ${opt.isCritical ? 'text-red-500' : 'text-white'}`}>
                                {opt.title}
                            </span>
                            <span className="text-gray-500 text-[13px] leading-tight mt-1">
                                {opt.description}
                            </span>
                        </div>
                        {opt.value && <span className="text-gray-500 text-[14px] mr-2">{opt.value}</span>}
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                    </Link>
                ))}
            </div>

            {/* Private Details Section */}
            <div className="mt-6">
                <h2 className="px-4 py-3 text-xl font-bold border-b border-gray-800">Account details</h2>
                <div className="p-4 flex flex-col gap-4">
                    <div className="flex flex-col">
                        <span className="text-gray-500 text-[13px]">Email</span>
                        <span className="text-white text-[15px]">{user?.email || "No email linked"}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-gray-500 text-[13px]">Username</span>
                        <span className="text-white text-[15px]">@{userData?.username}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
