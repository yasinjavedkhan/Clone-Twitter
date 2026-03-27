"use client";

import { Suspense } from "react";
import VideosPage from "./VideosContent";

export default function Page() {
    return (
        <Suspense fallback={
            <div className="fixed inset-0 bg-black flex items-center justify-center">
                <div className="w-10 h-10 rounded-full border-2 border-white border-t-transparent animate-spin" />
            </div>
        }>
            <VideosPage />
        </Suspense>
    );
}
