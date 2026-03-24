import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { app } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Your VAPID key from Firebase Console → Project Settings → Cloud Messaging
const VAPID_KEY = (process.env.NEXT_PUBLIC_FCM_VAPID_KEY || "BJ-iGROgllfJWNW-T5chkp1hGw3rhHMAyehMQ5Yb6qFCbbfIgRvrlvR3jdE3zyG4tNNQMXczzY1i3I4ZqyhVrrJQ").replace(/['"]/g, '').trim();

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    try {
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    } catch (e) {
        console.error("VAPID Key Decoding Error:", e);
        console.error("Malformed Base64 string:", base64);
        throw e;
    }
}

export async function requestNotificationPermission(userId: string): Promise<string | null> {
    try {
        if (typeof window === "undefined" || !("Notification" in window)) {
            return null;
        }

        console.log("Twitter Calling System - v22 (Initializing FCM)");
        if (!VAPID_KEY) {
            console.error("FCM Error: VAPID_KEY is missing or undefined in environment variables.");
        } else {
            console.log("FCM Info: VAPID_KEY detected (Length: " + VAPID_KEY.length + ")");
        }

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            console.log("Notification permission denied");
            return null;
        }

        const messaging = getMessaging(app);

        // Register service worker if not already handled
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        
        const vapidKeyArray = VAPID_KEY ? urlBase64ToUint8Array(VAPID_KEY) : undefined;

        const token = await getToken(messaging, {
            vapidKey: vapidKeyArray as any, // Using the binary array for maximum compatibility
            serviceWorkerRegistration: registration,
        });

        if (token) {
            // Save token to Firestore under user's document
            await updateDoc(doc(db, "users", userId), {
                fcmToken: token,
                fcmTokenUpdated: new Date(),
            });
            console.log("FCM Token saved:", token.substring(0, 20) + "...");
            return token;
        }

        return null;
    } catch (error) {
        console.error("Error getting FCM token:", error);
        return null;
    }
}

export function onForegroundMessage(callback: (payload: any) => void) {
    if (typeof window === "undefined") return () => {};
    try {
        const messaging = getMessaging(app);
        return onMessage(messaging, callback);
    } catch (error) {
        console.error("Error setting up foreground message handler:", error);
        return () => {};
    }
}

export async function sendPushNotification({
    toUserId,
    title,
    body,
    data,
}: {
    toUserId: string;
    title: string;
    body: string;
    data?: Record<string, string>;
}) {
    try {
        await fetch("/api/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toUserId, title, body, data }),
        });
    } catch (error) {
        console.error("Error sending push notification:", error);
    }
}
