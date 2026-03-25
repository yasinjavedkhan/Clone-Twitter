"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
    onAuthStateChanged,
    User,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signOut as firebaseSignOut,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, updateDoc } from "firebase/firestore";
import { requestNotificationPermission, onForegroundMessage } from "@/lib/notifications";

interface AuthContextType {
    user: User | null;
    userData: any | null; // Detailed Firestore user data
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    userData: null,
    loading: true,
    signInWithGoogle: async () => { },
    signOut: async () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeUser: (() => void) | null = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            
            // Clean up any existing user listener if the auth state changed
            if (unsubscribeUser) {
                unsubscribeUser();
                unsubscribeUser = null;
            }

            if (currentUser) {
                const userDocRef = doc(db, "users", currentUser.uid);
                
                // Real-time listener for user document in Firestore
                unsubscribeUser = onSnapshot(userDocRef, async (userDoc) => {
                    if (!userDoc.exists()) {
                        const newUser = {
                            userId: currentUser.uid,
                            username: currentUser.email?.split("@")[0] || currentUser.uid,
                            email: currentUser.email,
                            displayName: currentUser.displayName || "",
                            bio: "",
                            profileImage: currentUser.photoURL || "",
                            coverImage: "",
                            followersCount: 0,
                            followingCount: 0,
                            tweetCount: 0,
                            createdAt: serverTimestamp(),
                        };
                        await setDoc(userDocRef, newUser);
                        setUserData(newUser);
                    } else {
                        const data = userDoc.data();
                        setUserData(data);

                        if (!data.profileImage && currentUser.photoURL) {
                            await updateDoc(userDocRef, {
                                profileImage: currentUser.photoURL
                            });
                        }
                    }
                    setLoading(false);
                    
                    // Request notification permission after login
                    if (currentUser) {
                        setTimeout(() => {
                            requestNotificationPermission(currentUser.uid).catch(console.error);
                        }, 3000);
                    }
                }, (error) => {
                    console.error("User snapshot error:", error);
                    setLoading(false);
                });
            } else {
                setUserData(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeUser) unsubscribeUser();
        };
    }, []);

    // Handle redirect result (for mobile sign-in)
    useEffect(() => {
        getRedirectResult(auth).then((result) => {
            if (result?.user) {
                // redirect sign-in succeeded, auth state will update via onAuthStateChanged
            }
        }).catch((error) => {
            if (error.code !== 'auth/no-current-user') {
                console.error("Redirect result error:", error);
            }
        });
    }, []);



    const signInWithGoogle = async () => {
        setLoading(true);
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            // IF successful, DO NOT set loading to false here.
            // The onAuthStateChanged listener will fetch Firestore data and then set loading to false.
            return;
        } catch (error: any) {
            if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
                setLoading(false);
                return;
            }
            console.error("Error signing in with Google:", error);
            setLoading(false);
        }
    };

    const signOut = async () => {
        setLoading(true);
        try {
            await firebaseSignOut(auth);
            if (typeof window !== 'undefined') {
                window.location.href = "/";
            }
        } catch (error) {
            console.error("Error signing out:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthContext.Provider value={{ user, userData, loading, signInWithGoogle, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
