"use client";

import Skeleton from "@/components/ui/Skeleton";

export default function TweetSkeleton() {
  return (
    <div className="border-b border-[var(--tw-border-main)] p-3 sm:p-4 flex gap-3 sm:gap-4">
      {/* Avatar Skeleton */}
      <Skeleton variant="circle" className="w-12 h-12 shrink-0" />

      <div className="flex-grow space-y-3">
        {/* Header Skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton variant="text" className="w-24 h-4" />
          <Skeleton variant="text" className="w-20 h-4 opacity-50" />
        </div>

        {/* Content Skeleton */}
        <div className="space-y-2">
          <Skeleton variant="text" className="w-full h-4" />
          <Skeleton variant="text" className="w-[85%] h-4" />
        </div>

        {/* Action Buttons Skeleton */}
        <div className="flex justify-between max-w-md pt-2">
          <Skeleton variant="circle" className="w-8 h-8" />
          <Skeleton variant="circle" className="w-8 h-8" />
          <Skeleton variant="circle" className="w-8 h-8" />
          <Skeleton variant="circle" className="w-8 h-8" />
        </div>
      </div>
    </div>
  );
}
