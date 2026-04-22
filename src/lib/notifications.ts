import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { app } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Your VAPID key from Firebase Console → Project Settings → Cloud Messaging
const VAPID_KEY = "BCcmN4vF9H1SQSK-h9ATcbPyOaab-smwsGOI-d8GSstu1Lwos0DeoGYr_epF3o9pY911wVSLqPM2v33FH2hWLVA";

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
            if (typeof window !== "undefined") window.alert(errorMsg);
            return null;
        }

        console.log(`FCM Debug: Using VAPID: ${VAPID_KEY.substring(0, 10)}...`);
        
        console.log(`FCM Debug: Firebase App is using API KEY: ${app.options.apiKey?.substring(0, 10)}... (Length: ${app.options.apiKey?.length})`);

        const permission = await window.Notification.requestPermission();
        if (permission !== "granted") {
            console.log("FCM: Notification permission denied by user.");
            return null;
        }

        // 1. Force unregister ALL existing service workers
        const registrations = await window.navigator.serviceWorker.getRegistrations();
        for (let reg of registrations) {
            await reg.unregister();
            console.log("FCM: Unregistered stale service worker");
        }

        // 2. Clear Firebase-related IndexedDB to fix "storage error"
        try {
            if (typeof indexedDB !== "undefined") {
                indexedDB.deleteDatabase("firebase-messaging-database");
                console.log("FCM: Cleared messaging database to fix storage errors");
            }
        } catch (dbErr) {
            console.warn("FCM: Could not clear IndexedDB:", dbErr);
        }

        console.log("FCM: Registering fresh service worker...");
        let registration = await window.navigator.serviceWorker.register('/firebase-messaging-sw.js', {
            scope: '/'
        });
        
        await registration.update();

        // Wait for SW to be active if it's currently installing or waiting
        if (registration.installing || registration.waiting) {
            console.log("FCM: Waiting for SW activation...");
            await new Promise<void>((resolve) => {
                const sw = registration!.installing || registration!.waiting;
                sw?.addEventListener('statechange', (e: any) => {
                    if (e.target.state === 'activated') resolve();
                });
                setTimeout(resolve, 2000); // Safety timeout
            });
        }

        console.log("FCM: Requesting token with VAPID key...");
        if (typeof window !== "undefined") window.alert("Step 1: Service Worker Registered. Requesting FCM Token...");
        
        const messaging = getMessaging(app);
        
        // Pass the VAPID key directly to getToken. The SDK handles 
        // Base64URL vs Standard Base64 automatically.
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration,
        });

        if (token) {
            console.log("FCM: Token generated successfully. Length:", token.length);
            if (typeof window !== "undefined") window.alert("Step 2: Token Generated! Now saving to Database...");
            
            // Save token to Firestore
            await updateDoc(doc(db, "users", userId), {
                fcmToken: token,
                fcmTokenUpdated: new Date(),
            });
            console.log("FCM: Token saved to Firestore for user:", userId);
            if (typeof window !== "undefined") window.alert("Step 3: Database Updated! Notification system is READY. ✅");
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
        
        if (typeof window !== "undefined") window.alert(friendlyMsg);
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
