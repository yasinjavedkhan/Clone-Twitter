"use client";

import { useState } from "react";
import { User as UserIcon } from "lucide-react";

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  fallbackText?: string;
}

export default function Avatar({ src, alt = "Avatar", size = "md", className = "", fallbackText }: AvatarProps) {
  const [error, setError] = useState(false);

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
    xl: "w-32 h-32",
  };

  const currentSizeClass = sizeClasses[size] || sizeClasses.md;

  if (src && !error) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${currentSizeClass} rounded-full object-cover shrink-0 ${className}`}
        onError={() => setError(true)}
      />
    );
  }

  return (
    <div className={`${currentSizeClass} rounded-full bg-gray-600 flex items-center justify-center shrink-0 font-bold text-white uppercase ${className}`}>
      {fallbackText ? (
        <span>{fallbackText[0]}</span>
      ) : (
        <UserIcon className={`${size === "xl" ? "w-16 h-16" : "w-1/2 h-1/2"} text-gray-400`} />
      )}
    </div>
  );
}
