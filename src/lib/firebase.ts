import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBsyrXL6a8_vAh1UKbxRVy7skEjqBI4OZA",
  authDomain: "twitter-clone-app-16eb3.firebaseapp.com",
  projectId: "twitter-clone-app-16eb3",
  storageBucket: "twitter-clone-app-16eb3.firebasestorage.app",
  messagingSenderId: "249903575848",
  appId: "1:249903575848:web:9d1f7443118293a6cf161d"
};

console.log("🔥 Firebase Config Active (Hardcoded):", firebaseConfig.apiKey.substring(0, 10) + "...");

// Initialize Firebase only if there are no existing apps to prevent Hot Module Replacement (HMR) issues in Next.js
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
