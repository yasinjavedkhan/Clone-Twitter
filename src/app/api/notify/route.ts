import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin
function getAdminApp() {
    if (getApps().length > 0) return getApps()[0];
    
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
        const missing = [];
        if (!projectId) missing.push("PROJECT_ID");
        if (!clientEmail) missing.push("CLIENT_EMAIL");
        if (!privateKey) missing.push("PRIVATE_KEY");
        console.error("Missing Firebase Admin environment variables:", missing.join(", "));
        throw new Error(`Missing Firebase Admin credentials: ${missing.join(", ")}`);
    }

    console.log("Firebase Admin: Initializing for project", projectId);
    console.log("Firebase Admin: Client Email", clientEmail);

    let formattedKey = privateKey.trim();
    
    // 1. Remove wrapping quotes
    formattedKey = formattedKey.replace(/^['"]+|['"]+$/g, '');
    
    // 2. Handle double-escaped or literal newlines
    // This turns literal "\n" strings into actual newline characters
    formattedKey = formattedKey.replace(/\\n/g, '\n');
    
    // 3. Robust PEM reconstruction
    // If the key is messy, we extract ONLY the base64 part and re-wrap it
    if (formattedKey.includes("-----BEGIN PRIVATE KEY-----")) {
        const base64Part = formattedKey
            .replace("-----BEGIN PRIVATE KEY-----", "")
            .replace("-----END PRIVATE KEY-----", "")
            .replace(/\s+/g, ""); // Remove ALL whitespace/newlines
        
        // Reconstruct with proper 64-character lines
        formattedKey = `-----BEGIN PRIVATE KEY-----\n${base64Part.match(/.{1,64}/g)?.join("\n")}\n-----END PRIVATE KEY-----`;
    }

    try {
        console.log("Firebase Admin: Attempting initialization with sanitized key...");
        return initializeApp({
            credential: cert({
                projectId,
                clientEmail,
                privateKey: formattedKey,
            }),
            projectId,
        });
    } catch (e) {
        console.error("Firebase Admin: Initialization Error", e);
        throw e;
    }
}

export async function POST(req: NextRequest) {
    try {
        const { toUserId, title, body, data } = await req.json();

        if (!toUserId || !title || !body) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const adminApp = getAdminApp();
        const adminDb = getFirestore(adminApp);

        // Get the user's FCM token from Firestore
        const userDoc = await adminDb.collection("users").doc(toUserId).get();
        
        if (!userDoc.exists) {
            console.error(`FCM Error: User ${toUserId} not found in Firestore.`);
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const userData = userDoc.data();
        const fcmToken = userData?.fcmToken;

        if (!fcmToken) {
            console.warn(`FCM Warning: User ${toUserId} (${userData?.username || 'unknown'}) exists but has no fcmToken. They may need to Allow notifications in their browser.`);
            return NextResponse.json({ message: "User has no FCM token" }, { status: 200 });
        }

        console.log(`FCM Info: Found token for user ${toUserId}. Attempting to send...`);

        const messaging = getMessaging(adminApp);

        try {
            const response = await messaging.send({
                token: fcmToken,
                notification: { title, body },
                data: data || {},
                android: {
                    priority: "high",
                    notification: {
                        sound: "default",
                        channelId: "default",
                    },
                },
                webpush: {
                    headers: { Urgency: "high" },
                    notification: {
                        title,
                        body,
                        requireInteraction: true,
                        vibrate: [200, 100, 200],
                    },
                },
            });

            console.log("FCM Success: Push notification sent successfully. MessageID:", response);
            return NextResponse.json({ success: true, messageId: response });
        } catch (sendError: any) {
            console.error("FCM Send Error: Failed to send to Google services:", sendError.message);
            if (sendError.code === 'messaging/registration-token-not-registered') {
                console.warn("FCM Cleanup: Token is no longer valid. Recommendation: User should refresh their token.");
            }
            throw sendError;
        }
    } catch (error: any) {
        console.error("CRITICAL: Push notification error:", error);
        return NextResponse.json({ 
            error: error.message || "Unknown error",
            code: error.code || "UNKNOWN",
            details: error.stack || "No stack trace",
            hint: "Check Firebase Admin environment variables in Vercel dashboard."
        }, { status: 500 });
    }
}
