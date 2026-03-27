import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { app } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Your VAPID key from Firebase Console → Project Settings → Cloud Messaging
const VAPID_KEY = (process.env.NEXT_PUBLIC_FCM_VAPID_KEY || "BJ-iGROgllfJWNW-T5chkp1hGw3rhHMAyehMQ5Yb6qFCbbfIgRvrlvR3jdE3zyG4tNNQMXczzY1i3I4ZqyhVrrJQ").replace(/['"]/g, '').trim();

export async function requestNotificationPermission(userId: string): Promise<string | null> {
    try {
        if (typeof window === "undefined" || !("Notification" in window)) {
            console.warn("FCM: Notifications not supported in this browser.");
            return null;
        }

        console.log("FCM: Initializing v29 (Stable Mode)");
        if (!VAPID_KEY) {
            console.error("FCM Error: NEXT_PUBLIC_FCM_VAPID_KEY is missing from environment variables.");
            return null;
        }

        console.log(`FCM Debug: Using VAPID: ${VAPID_KEY.substring(0, 5)}...${VAPID_KEY.substring(VAPID_KEY.length - 5)} (Length: ${VAPID_KEY.length})`);

        const permission = await window.Notification.requestPermission();
        if (permission !== "granted") {
            console.log("FCM: Notification permission denied by user.");
            return null;
        }

        // 1. Ensure Service Worker is registered AND active
        let registration = await window.navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        
        if (!registration) {
            console.log("FCM: Registering new service worker...");
            registration = await window.navigator.serviceWorker.register('/firebase-messaging-sw.js');
        }

        // Wait for SW to be active if it's currently installing or waiting
        if (registration.installing) {
          console.log("FCM: Waiting for service worker to finish installing...");
          await new Promise<void>((resolve) => {
            registration!.installing!.addEventListener('statechange', (e: any) => {
              if (e.target.state === 'activated') resolve();
            });
          });
        }

        const messaging = getMessaging(app);
        
        // Normalize VAPID key for Firebase SDK expectations
        // The SDK is very sensitive to the Base64 encoding style (URL-safe vs standard)
        const normalizedVapid = VAPID_KEY
            .replace(/-/g, '+')
            .replace(/_/g, '/')
            .trim();
        
        // Ensure padding is a multiple of 4
        const finalVapid = normalizedVapid.length % 4 === 0 
            ? normalizedVapid 
            : normalizedVapid.padEnd(normalizedVapid.length + (4 - (normalizedVapid.length % 4)), '=');

        console.log("FCM: Requesting token with normalized VAPID...");

        const token = await getToken(messaging, {
            vapidKey: finalVapid,
            serviceWorkerRegistration: registration,
        });

        if (token) {
            // Save token to Firestore
            await updateDoc(doc(db, "users", userId), {
                fcmToken: token,
                fcmTokenUpdated: new Date(),
            });
            console.log("FCM: Token generated and saved successfully.");
            return token;
        }

        console.warn("FCM: getToken returned empty.");
        return null;
    } catch (error: any) {
        console.error("CRITICAL FCM Error:", error);
        
        if (error.code === 'messaging/token-subscribe-failed') {
          console.error("HINT: This usually means the Domain is not authorized in Firebase Console OR the VAPID key is invalid for this project.");
        }
        
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
