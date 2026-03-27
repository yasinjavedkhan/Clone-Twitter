"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { requestNotificationPermission, sendPushNotification } from "@/lib/notifications";
import { Bell, CheckCircle, AlertTriangle, Shield, Send, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export default function NotificationDiagnostic() {
    const { user, userData } = useAuth();
    const [permission, setPermission] = useState<string>("unknown");
    const [tokenStatus, setTokenStatus] = useState<"missing" | "exists" | "loading">("loading");
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            setPermission(Notification.permission);
        }
    }, []);

    useEffect(() => {
        if (userData?.fcmToken) {
            setTokenStatus("exists");
        } else {
            setTokenStatus("missing");
        }
    }, [userData]);

    const handleRequest = async () => {
        if (!user) return;
        setTokenStatus("loading");
        const token = await requestNotificationPermission(user.uid);
        if (token) {
            setTokenStatus("exists");
            setPermission("granted");
        } else {
            setTokenStatus("missing");
            setPermission(Notification.permission);
        }
    };

    const handleTestNotify = async () => {
        if (!user) return;
        setIsTesting(true);
        setTestResult(null);
        try {
            await sendPushNotification({
                toUserId: user.uid,
                title: "🔔 Test Notification",
                body: "If you see this, your push notifications are working correctly!",
                data: { type: "test" }
            });
            setTestResult({ success: true, message: "Test sent! Check your device/browser alerts." });
        } catch (err: any) {
            setTestResult({ success: false, message: err.message || "Failed to send test" });
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="bg-zinc-900/50 border border-gray-800 rounded-2xl p-6 flex flex-col gap-6">
            <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
                <Bell className="w-6 h-6 text-twitter-blue" />
                <h3 className="text-xl font-bold text-white">Notification Diagnostic</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Permission Status */}
                <div className="bg-black/40 p-4 rounded-xl border border-gray-800/50">
                    <p className="text-gray-400 text-sm mb-1 uppercase tracking-wider font-semibold">Browser Permission</p>
                    <div className="flex items-center gap-2">
                        {permission === "granted" ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : permission === "denied" ? (
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                        ) : (
                            <Shield className="w-5 h-5 text-yellow-500" />
                        )}
                        <span className={cn(
                            "text-lg font-medium capitalize",
                            permission === "granted" ? "text-green-500" : 
                            permission === "denied" ? "text-red-500" : "text-yellow-500"
                        )}>
                            {permission}
                        </span>
                    </div>
                </div>

                {/* Token Status */}
                <div className="bg-black/40 p-4 rounded-xl border border-gray-800/50">
                    <p className="text-gray-400 text-sm mb-1 uppercase tracking-wider font-semibold">Cloud Token Status</p>
                    <div className="flex items-center gap-2">
                        {tokenStatus === "exists" ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : tokenStatus === "loading" ? (
                            <RefreshCw className="w-5 h-5 text-twitter-blue animate-spin" />
                        ) : (
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                        )}
                        <span className={cn(
                            "text-lg font-medium",
                            tokenStatus === "exists" ? "text-green-500" : 
                            tokenStatus === "loading" ? "text-twitter-blue" : "text-red-500"
                        )}>
                            {tokenStatus === "exists" ? "Ready" : tokenStatus === "loading" ? "Updating..." : "Missing from Server"}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <button 
                    onClick={handleRequest}
                    className="flex items-center justify-center gap-2 bg-white text-black font-bold py-3 rounded-full hover:bg-gray-200 transition"
                >
                    <RefreshCw className="w-5 h-5" />
                    Refresh Cloud Token
                </button>

                <button 
                    onClick={handleTestNotify}
                    disabled={isTesting || tokenStatus !== "exists"}
                    className="flex items-center justify-center gap-2 bg-twitter-blue text-white font-bold py-3 rounded-full hover:bg-opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isTesting ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                        <Send className="w-5 h-5" />
                    )}
                    Send Test Notification to Me
                </button>
            </div>

            {testResult && (
                <div className={cn(
                    "p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300",
                    testResult.success ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
                )}>
                    {testResult.success ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                    <p className="text-sm font-medium">{testResult.message}</p>
                </div>
            )}

            <div className="bg-blue-500/5 rounded-xl p-4 border border-blue-500/10">
                <h4 className="text-twitter-blue font-bold text-sm mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Troubleshooting Tips
                </h4>
                <ul className="text-xs text-gray-400 space-y-2 list-disc pl-4">
                    <li>Ensure you are using **HTTPS** (notifications don't work on insecure HTTP).</li>
                    <li>If "Browser Permission" is not Green, click the 🔒 lock icon in your address bar and reset permissions.</li>
                    <li>If "Cloud Token" is missing, click **Refresh Cloud Token** above.</li>
                    <li>If testing fails, check your **OS Notification Settings** (Windows/Mac Focus Mode can block alerts).</li>
                </ul>
            </div>
        </div>
    );
}
