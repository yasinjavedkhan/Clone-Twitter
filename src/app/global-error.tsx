"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Auto-reload on ChunkLoadError (stale deployment cache)
    if (error?.name === "ChunkLoadError" || error?.message?.includes("Failed to load chunk")) {
      console.log("ChunkLoadError detected - reloading page to fetch fresh chunks...");
      window.location.reload();
    }
  }, [error]);

  return (
    <html>
      <body className="bg-black text-white flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold">Something went wrong</h2>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-blue-500 rounded-full text-sm font-bold hover:bg-blue-600 transition"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
