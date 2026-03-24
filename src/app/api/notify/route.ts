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
    
    // Remove wrapping quotes if present
    if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
        formattedKey = formattedKey.slice(1, -1);
    } else if (formattedKey.startsWith("'") && formattedKey.endsWith("'")) {
        formattedKey = formattedKey.slice(1, -1);
    }
    
    // Aggressively handle literal \n and actual newlines
    formattedKey = formattedKey.replace(/\\n/g, '\n');
    
    // Ensure the key has proper BEGIN/END markers if they got stripped
    if (!formattedKey.includes("-----BEGIN PRIVATE KEY-----")) {
        console.warn("Firebase Admin: Private key missing BEGIN marker, fixing format.");
        // If it's just the raw base64, wrap it
        formattedKey = `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----`;
    }

    // Use Application Default Credentials or service account
    try {
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
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const fcmToken = userDoc.data()?.fcmToken;

        if (!fcmToken) {
            // User hasn't enabled notifications yet
            return NextResponse.json({ message: "User has no FCM token" }, { status: 200 });
        }

        const messaging = getMessaging(adminApp);

        const response = await messaging.send({
            token: fcmToken,
            notification: { title, body },
            data: data || {},
            android: {
                priority: "high",
                notification: {
                    sound: "default",
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

        console.log("Push notification sent successfully:", response);
        return NextResponse.json({ success: true, messageId: response });
    } catch (error: any) {
        console.error("CRITICAL: Push notification error:", error);
        return NextResponse.json({ 
            error: error.message,
            code: error.code,
            details: error.stack
        }, { status: 500 });
    }
}
