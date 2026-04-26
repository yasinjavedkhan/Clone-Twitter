"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "circle" | "rect" | "text";
}

export default function Skeleton({ className, variant = "rect" }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-[#202327]",
        variant === "circle" && "rounded-full",
        variant === "text" && "rounded h-4 w-full",
        variant === "rect" && "rounded-xl",
        className
      )}
    />
  );
}
