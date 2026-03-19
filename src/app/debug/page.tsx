"use client";
import { useEffect, useState } from 'react';

export default function DebugPage() {
    const [config, setConfig] = useState<any>(null);

    useEffect(() => {
        setConfig({
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        });
    }, []);

    if (!config) return <div className="p-10 text-white">Loading...</div>;

    return (
        <div className="p-10 bg-black text-white font-mono text-sm space-y-4">
            <h1 className="text-2xl font-bold mb-4">Debug Config</h1>
            <div className="p-4 border border-gray-800 rounded">
                <p className="text-gray-500">API Key:</p>
                <p className="break-all">{config.apiKey || "MISSING"}</p>
            </div>
            <div className="p-4 border border-gray-800 rounded">
                <p className="text-gray-500">Project ID:</p>
                <p className="break-all">{config.projectId || "MISSING"}</p>
            </div>
            <div className="p-4 border border-gray-800 rounded">
                <p className="text-gray-500">App ID:</p>
                <p className="break-all">{config.appId || "MISSING"}</p>
            </div>
            <div className="mt-8 p-4 bg-red-900/20 border border-red-500/50 rounded text-red-200">
                <p className="font-bold">If any of these say "MISSING", you must restart your terminal and refresh this page.</p>
            </div>
        </div>
    );
}
