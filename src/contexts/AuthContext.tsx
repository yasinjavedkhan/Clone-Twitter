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
    error: string | null;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    clearError: () => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    userData: null,
    loading: true,
    error: null,
    signInWithGoogle: async () => { },
    signOut: async () => { },
    clearError: () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
                            lastSeen: serverTimestamp(),
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
                    setError("Database error: Could not fetch profile.");
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

    // Presence Tracking / Last Seen heartbeat
    useEffect(() => {
        if (!user?.uid) return;

        const updateLastSeen = async () => {
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                lastSeen: serverTimestamp()
            }).catch(err => console.error("Error updating last seen:", err));
        };

        // Initial update
        updateLastSeen();

        // Heartbeat every 60 seconds
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                updateLastSeen();
            }
        }, 60000);

        // Update on focus
        const handleFocus = () => updateLastSeen();
        window.addEventListener('focus', handleFocus);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', handleFocus);
        };
    }, [user?.uid]);

    // Handle redirect result (for mobile sign-in fallback if needed)
    useEffect(() => {
        // Diagnostic: Check if current domain is authorized
        if (typeof window !== 'undefined') {
            const currentDomain = window.location.hostname;
            const authDomain = auth.config.authDomain;
            if (authDomain && !authDomain.includes(currentDomain) && currentDomain !== 'localhost' && !currentDomain.endsWith('.firebaseapp.com')) {
                console.warn(`⚠️ Domain Mismatch: Current domain (${currentDomain}) might not be authorized in Firebase Console. Please add it to "Authorized Domains" in Authentication settings.`);
            }
        }

        getRedirectResult(auth).then((result) => {
            if (result?.user) {
                // redirect sign-in succeeded
            }
        }).catch((err: any) => {
            if (err.code !== 'auth/no-current-user') {
                console.error("Redirect result error:", err);
                let msg = `Login failed: ${err.message} (Code: ${err.code})`;
                if (err.code === 'auth/unauthorized-domain') {
                    msg = "🚫 Domain Permission Denied: Your website is not yet authorized in the Firebase console. Please add 'clone-twitter-fmya.vercel.app' to your Authorized Domains.";
                }
                setError(msg);
                if (typeof window !== 'undefined') window.alert(msg);
            }
        });
    }, []);



    const signInWithGoogle = async () => {
        setLoading(true);
        setError(null);
        console.log("🚀 Starting Google Sign-In (Key:", auth.config.apiKey?.slice(0, 8) + "...)");
        
        const provider = new GoogleAuthProvider();

        try {
            console.log("💻 Attempting sign-in with popup...");
            const result = await signInWithPopup(auth, provider);
            console.log("✅ Sign-in successful for user:", result.user.email);
            return;
        } catch (err: any) {
            console.error("❌ Sign-in error detailed:", {
                code: err.code,
                message: err.message,
                stack: err.stack
            });

            if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
                console.log("ℹ️ Popup closed by user.");
                setLoading(false);
                return;
            }
            
            if (err.code === 'auth/popup-blocked') {
                console.warn("⚠️ Popup blocked, falling back to redirect...");
                try {
                    await signInWithRedirect(auth, provider);
                } catch (redirErr: any) {
                    const msg = `Sign-in failed: ${redirErr.message} (Code: ${redirErr.code})`;
                    setError(msg);
                    window.alert(msg);
                    setLoading(false);
                }
                return;
            }

            let msg = `Login failed: ${err.message} (Code: ${err.code})`;
            if (err.code === 'auth/unauthorized-domain') {
                 msg = "🚫 Domain Permission Denied: Your website is not yet authorized in Firebase. Add 'clone-twitter-fmya.vercel.app' to Authorized Domains in Settings.";
            } else if (err.code === 'auth/operation-not-allowed') {
                 msg = "🚫 Google Sign-In is not enabled in Firebase Authentication Console. Please enable it in 'Sign-in method'.";
            } else if (err.code === 'auth/invalid-api-key') {
                 msg = "🚫 Invalid API Key: The API key used in your configuration is incorrect.";
            }

            setError(msg);
            if (typeof window !== 'undefined') window.alert(msg);
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
        } catch (err) {
            console.error("Error signing out:", err);
        } finally {
            setLoading(false);
        }
    };

    const clearError = () => setError(null);

    return (
        <AuthContext.Provider value={{ user, userData, loading, error, signInWithGoogle, signOut, clearError }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
