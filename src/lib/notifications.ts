import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { app } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Your VAPID key from Firebase Console → Project Settings → Cloud Messaging
const VAPID_KEY = (process.env.NEXT_PUBLIC_FCM_VAPID_KEY || "BJ-iGROgllfJWNW-T5chkp1hGw3rhHMAyehMQ5Yb6qFCbbfIgRvrlvR3jdE3zyG4tNNQMXczzY1i3I4ZqyhVrrJQ").replace(/['"]/g, '').trim();

function urlBase64ToUint8Array(base64String: string) {
    // 1. Ultimate cleaning
    const cleaned = base64String.replace(/\s/g, '').replace(/['"]/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9\+\/]/g, '');
    
    // 2. Manual Base64 Decoding (Bypassing atob for robustness)
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const lookup = new Uint8Array(256);
    for (let i = 0; i < alphabet.length; i++) lookup[alphabet.charCodeAt(i)] = i;

    // Pad to multiple of 4 for the loop
    const padded = cleaned + "A".repeat((4 - (cleaned.length % 4)) % 4);
    const len = padded.length;
    let bufferLength = cleaned.length * 0.75;
    const outputArray = new Uint8Array(bufferLength | 0);

    let p = 0;
    for (let i = 0; i < len; i += 4) {
        const encoded1 = lookup[padded.charCodeAt(i)];
        const encoded2 = lookup[padded.charCodeAt(i + 1)];
        const encoded3 = lookup[padded.charCodeAt(i + 2)];
        const encoded4 = lookup[padded.charCodeAt(i + 3)];

        outputArray[p++] = (encoded1 << 2) | (encoded2 >> 4);
        if (p < outputArray.length) outputArray[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
        if (p < outputArray.length) outputArray[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }

    return outputArray;
}

export async function requestNotificationPermission(userId: string): Promise<string | null> {
    try {
        if (typeof window === "undefined" || !("Notification" in window)) {
            return null;
        }

        console.log("FCM: Initializing v25 (Diagnostic VAPID)");
        if (!VAPID_KEY) {
            console.error("FCM Error: VAPID_KEY is missing.");
            return null;
        }

        console.log(`FCM Debug: VAPID Start: ${VAPID_KEY.substring(0, 5)}... End: ${VAPID_KEY.substring(VAPID_KEY.length - 5)} (Total: ${VAPID_KEY.length})`);

        const permission = await window.Notification.requestPermission();
        if (permission !== "granted") {
            console.log("Notification permission denied");
            return null;
        }

        const messaging = getMessaging(app);
        const registration = await window.navigator.serviceWorker.register('/firebase-messaging-sw.js');
        
        if (!registration) return null;
        
        let vapidKeyArray: any;
        try {
            vapidKeyArray = urlBase64ToUint8Array(VAPID_KEY);
        } catch (err: any) {
            console.error("FCM Critical: VAPID Decoding Failure:", err.message);
            return null;
        }

        const token = await getToken(messaging, {
            vapidKey: vapidKeyArray,
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
