import * as admin from 'firebase-admin';

function getAdminDb() {
  if (!admin.apps.length) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          // Replace escaped newlines with actual newline characters safely
          privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
      });
      console.log("Firebase Admin successfully initialized.");
    } catch (error) {
      console.error("Firebase Admin initialization error:", error);
    }
  }
  return admin.firestore();
}

export { getAdminDb };
