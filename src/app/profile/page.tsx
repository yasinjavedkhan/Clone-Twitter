"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function ProfileRedirect() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (user) {
            router.push(`/profile/${user.uid}`);
        } else {
            router.push("/");
        }
    }, [user, router]);

    return (
        <div className="p-8 text-center text-gray-500">
            Redirecting to profile...
        </div>
    );
}
