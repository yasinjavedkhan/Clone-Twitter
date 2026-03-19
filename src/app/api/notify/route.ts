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
        console.error("Missing Firebase Admin environment variables:", { 
            projectId: !!projectId, 
            clientEmail: !!clientEmail, 
            privateKey: !!privateKey 
        });
        throw new Error("Missing Firebase Admin credentials");
    }

    // Use Application Default Credentials or service account
    return initializeApp({
        credential: cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
        projectId,
    });
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

        await messaging.send({
            token: fcmToken,
            notification: { title, body },
            data: data || {},
            android: {
                priority: "high",
                notification: {
                    sound: "default",
                    clickAction: "FLUTTER_NOTIFICATION_CLICK",
                },
            },
            webpush: {
                headers: { Urgency: "high" },
                notification: {
                    title,
                    body,
                    icon: "/icon-192.png",
                    badge: "/icon-192.png",
                    requireInteraction: true,
                    vibrate: [200, 100, 200],
                },
                fcmOptions: {
                    link: data?.url || "/",
                },
            },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Push notification error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
