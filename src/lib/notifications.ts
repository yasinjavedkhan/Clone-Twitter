import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { app } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Your VAPID key from Firebase Console → Project Settings → Cloud Messaging
const VAPID_KEY = (process.env.NEXT_PUBLIC_FCM_VAPID_KEY || "BJ-iGROgllfJWNW-T5chkp1hGw3rhHMAyehMQ5Yb6qFCbbfIgRvrlvR3jdE3zyG4tNNQMXczzY1i3I4ZqyhVrrJQ").replace(/['"]/g, '').trim();

export async function requestNotificationPermission(userId: string): Promise<string | null> {
    try {
        if (typeof window === "undefined" || !("Notification" in window)) {
            return null;
        }

        console.log("FCM: Initializing v23 (Direct String VAPID)");
        if (!VAPID_KEY) {
            console.error("FCM Error: VAPID_KEY is missing.");
        }

        const permission = await window.Notification.requestPermission();
        if (permission !== "granted") {
            console.log("Notification permission denied");
            return null;
        }

        const messaging = getMessaging(app);
        const registration = await window.navigator.serviceWorker.register('/firebase-messaging-sw.js');
        
        if (!registration) return null;
        
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
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
