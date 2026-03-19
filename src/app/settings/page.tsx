"use client";

import { useAuth } from "@/contexts/AuthContext";
import { User, LogOut, ChevronRight, Shield, Bell, Eye, Accessibility, HelpCircle } from "lucide-react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";

export default function Settings() {
    const { user, userData, signOut } = useAuth();

    const settingsSections = [
        {
            title: "Your Account",
            icon: <User className="w-5 h-5" />,
            description: "See information about your account, download an archive of your data, or learn about your account deactivation options.",
            href: "/settings/account"
        },
        {
            title: "Security and account access",
            icon: <Shield className="w-5 h-5" />,
            description: "Manage your account's security and keep track of your account's usage including apps that you have connected to your account.",
            href: "/settings/security"
        },
        {
            title: "Notifications",
            icon: <Bell className="w-5 h-5" />,
            description: "Select the kinds of notifications you get about your activities, interests, and recommendations.",
            href: "/settings/notifications"
        },
        {
            title: "Accessibility, display, and languages",
            icon: <Accessibility className="w-5 h-5" />,
            description: "Manage how content is displayed to you.",
            href: "/settings/accessibility"
        },
        {
            title: "Resources",
            icon: <HelpCircle className="w-5 h-5" />,
            description: "Find helpful links to help you use the app.",
            href: "/settings/resources"
        }
    ];

    return (
        <div className="flex flex-col min-h-screen border-r border-gray-800">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800 p-4 flex flex-col">
                <h1 className="text-xl font-bold">Settings</h1>
                <p className="text-[13px] text-gray-500">@{userData?.username || "user"}</p>
            </div>

            {/* Account Info Quick Look */}
            <div className="p-4 border-b border-gray-800 hover:bg-white/5 transition cursor-pointer">
                <div className="flex items-center gap-3">
                    <Avatar
                        src={userData?.profileImage}
                        fallbackText={userData?.displayName || userData?.username}
                        size="lg"
                    />
                    <div className="flex flex-col flex-1">
                        <span className="font-bold text-white text-[15px]">
                            {userData?.displayName || userData?.username || "Loading..."}
                        </span>
                        <span className="text-[#71767b] text-[14px]">Update your public profile and bio</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                </div>
            </div>

            {/* Settings List */}
            <div className="flex flex-col">
                {settingsSections.map((section, index) => (
                    <Link
                        key={index}
                        href={section.href}
                        className="p-4 hover:bg-white/5 transition flex items-start gap-4"
                    >
                        <div className="mt-1 text-gray-500">
                            {section.icon}
                        </div>
                        <div className="flex flex-col flex-1">
                            <span className="text-white text-[15px] font-medium leading-tight mb-1">
                                {section.title}
                            </span>
                            <span className="text-gray-500 text-[13px] leading-tight">
                                {section.description}
                            </span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-500 mt-2" />
                    </Link>
                ))}
            </div>

        </div>
    );
}
