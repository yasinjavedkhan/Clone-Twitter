import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { app } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Your VAPID key from Firebase Console → Project Settings → Cloud Messaging
const VAPID_KEY = "BJ_fGROgIFJWNW_T5dhkp1hGw3rhHMAyehMQ5Yb6qFCbbfIgRvrlvR3jdE3zyG4tNNQMXczzY1i3I4ZqyhVrrJQ";

export async function requestNotificationPermission(userId: string): Promise<string | null> {
    try {
        if (typeof window === "undefined" || !("Notification" in window)) {
            console.warn("FCM: Notifications not supported in this browser.");
            return null;
        }

        console.log("FCM: Initializing v30 (Ultra Stable Mode)");
        if (!VAPID_KEY || VAPID_KEY.length < 20) {
            const errorMsg = "FCM Error: VAPID Key is invalid or missing. Please check your .env.local file.";
            console.error(errorMsg);
            return null;
        }

        console.log(`FCM Debug: Using VAPID: ${VAPID_KEY.substring(0, 10)}...`);
        
        console.log(`FCM Debug: Firebase App is using API KEY: ${app.options.apiKey?.substring(0, 10)}... (Length: ${app.options.apiKey?.length})`);

        const permission = await window.Notification.requestPermission();
        if (permission !== "granted") {
            console.log("FCM: Notification permission denied by user.");
            return null;
        }

        // 1. Check for existing registration or register new one
        let registration = await window.navigator.serviceWorker.getRegistration();
        
        if (!registration) {
            console.log("FCM: Registering new service worker...");
            registration = await window.navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                scope: '/'
            });
        }

        // 2. Wait for the service worker to be fully READY
        console.log("FCM: Waiting for service worker to be ready...");
        registration = await window.navigator.serviceWorker.ready;
        
        // Force update just in case the file changed
        await registration.update();

        console.log("FCM: Service worker is ready and active.");
        
        const messaging = getMessaging(app);
        
        // Simplified getToken: let the SDK find the /firebase-messaging-sw.js automatically
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY
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
        
        let friendlyMsg = `Notification Error: ${error.message}`;
        
        if (error.code === 'messaging/token-subscribe-failed' || error.message?.includes('401') || error.message?.includes('403')) {
          friendlyMsg = "🚫 FCM Setup Blocked: Please ensure 'Firebase Cloud Messaging API' is enabled in Google Cloud Console and your domain is authorized.";
          console.error("DIAGNOSTIC HINT: https://console.cloud.google.com/apis/library/fcmregistrations.googleapis.com");
        } else if (error.code === 'messaging/permission-blocked') {
          friendlyMsg = "🚫 Notifications Blocked: Please click the lock icon 🔒 in your browser and Allow notifications.";
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
