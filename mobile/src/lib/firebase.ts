import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyDOOlKD6kaX92b805M73jz9Ceodagffqj0",
  authDomain: "twitter-clone-app-16eb3.firebaseapp.com",
  projectId: "twitter-clone-app-16eb3",
  storageBucket: "twitter-clone-app-16eb3.firebasestorage.app",
  messagingSenderId: "249903575848",
  appId: "1:249903575848:web:9d1f7443118293a6cf161d"
};

const app = initializeApp(firebaseConfig);

// Initialize Auth with persistence for React Native
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

const db = getFirestore(app);

export { auth, db };
