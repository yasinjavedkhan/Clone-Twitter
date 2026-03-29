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
        
        console.log(`FCM Debug: Firebase App is using API KEY: ${app.options.apiKey?.substring(0, 10)}... (Length: ${app.options.apiKey?.length})`);

        const permission = await window.Notification.requestPermission();
        if (permission !== "granted") {
            console.log("FCM: Notification permission denied by user.");
            return null;
        }

        // 1. Ensure Service Worker is registered AND active
        if (typeof window === "undefined" || !("serviceWorker" in window.navigator)) {
            console.warn("FCM: Service workers not supported in this browser.");
            return null;
        }

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
        
        console.log("FCM: Requesting token with VAPID key...");
        
        // Pass the VAPID key directly to getToken. The SDK handles 
        // Base64URL vs Standard Base64 automatically.
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration,
        });

        if (token) {
            console.log("FCM: Token generated successfully. Length:", token.length);
            // Save token to Firestore
            await updateDoc(doc(db, "users", userId), {
                fcmToken: token,
                fcmTokenUpdated: new Date(),
            });
            console.log("FCM: Token saved to Firestore for user:", userId);
            return token;
        }

        console.warn("FCM: getToken returned empty.");
        return null;
    } catch (error: any) {
        console.error("CRITICAL FCM Error:", error);
        
        if (error.code === 'messaging/token-subscribe-failed' || error.message?.includes('401')) {
          console.error("DIAGNOSTIC HINT: 401/Unauthorized usually means:");
          console.error("1. 'Firebase Cloud Messaging API' is NOT enabled in Google Cloud Console.");
          console.error("2. The API key is restricted and doesn't have permissions for FCM.");
          console.error("3. The VAPID key in .env.local doesn't match the current project settings.");
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
