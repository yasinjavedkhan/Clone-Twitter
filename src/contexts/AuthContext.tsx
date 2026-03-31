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
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, updateDoc, query, collection, where, getDocs, addDoc, deleteDoc } from "firebase/firestore";
import { requestNotificationPermission, onForegroundMessage } from "@/lib/notifications";
import { registerFingerprint, authenticateFingerprint, isBiometricsSupported } from "@/lib/biometrics";

interface AuthContextType {
    user: User | null;
    userData: any | null; // Detailed Firestore user data
    loading: boolean;
    error: string | null;
    isMobile: boolean;
    challengeData: { id: string, numbers: number[] } | null;
    signInWithGoogle: () => Promise<void>;
    setupChallenge: (phoneNumber: string) => Promise<void>;
    verifyChallenge: (selectedNumber: number) => Promise<void>;
    signInWithBiometrics: () => Promise<void>;
    registerBiometrics: () => Promise<void>;
    signOut: () => Promise<void>;
    clearError: () => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    userData: null,
    loading: true,
    error: null,
    isMobile: false,
    challengeData: null,
    signInWithGoogle: async () => { },
    setupChallenge: async () => { },
    verifyChallenge: async () => { },
    signInWithBiometrics: async () => { },
    registerBiometrics: async () => { },
    signOut: async () => { },
    clearError: () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [challengeData, setChallengeData] = useState<{ id: string, numbers: number[] } | null>(null);
    const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);

    // Device Detection
    useEffect(() => {
        const checkDevice = () => {
            const ua = navigator.userAgent;
            const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
            setIsMobile(mobile);
        };
        checkDevice();
    }, []);

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

        // Heartbeat every 3 seconds for real-time presence
        const interval = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                updateLastSeen();
            }
        }, 3000); 

        // Update on focus
        const handleFocus = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                updateLastSeen();
            }
        };
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

    const setupChallenge = async (phoneNumber: string) => {
        setLoading(true);
        setError(null);
        try {
            // 1. Generate 4 random numbers (10-99)
            const numbers = Array.from({ length: 4 }, () => Math.floor(Math.random() * 90) + 10);
            const correctIndex = Math.floor(Math.random() * 4);
            const correctNumber = numbers[correctIndex];

            // 2. Store the challenge in Firestore
            const challengeRef = await addDoc(collection(db, "auth_challenges"), {
                phoneNumber,
                numbers,
                correctNumber,
                createdAt: serverTimestamp(),
                resolved: false,
            });

            setChallengeData({ id: challengeRef.id, numbers });
            setActiveChallengeId(challengeRef.id);

            // 3. Find user and send notification
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("phoneNumber", "==", phoneNumber));
            const userSnapshot = await getDocs(q);
            
            if (!userSnapshot.empty) {
                const targetUser = userSnapshot.docs[0];
                const userId = targetUser.id;
                
                // Trigger Push Notification via API
                // For this demo, I will trigger it and it will contain the correctNumber
                await fetch("/api/notify", {
                    method: "POST",
                    body: JSON.stringify({
                        toUserId: userId,
                        title: "Security Challenge",
                        body: `Select number ${correctNumber} on your screen to verify login.`,
                        data: { challengeId: challengeRef.id, number: correctNumber.toString() }
                    })
                }).catch(err => console.warn("Failed to send push notification, user may be new:", err));
            } else {
                console.log("Mocking for first-time user: Number is", correctNumber);
                // Simulation: Display number for testing/first-time users
                window.alert(`[TEST MOCK] Select ${correctNumber} on the screen.`);
            }

            setLoading(false);
        } catch (err: any) {
            console.error("Challenge Setup Error:", err);
            setError(err.message);
            setLoading(false);
        }
    };

    const verifyChallenge = async (selectedNumber: number) => {
        setLoading(true);
        setError(null);
        if (!activeChallengeId) {
            setError("No active challenge found.");
            setLoading(false);
            return;
        }

        try {
            const challengeRef = doc(db, "auth_challenges", activeChallengeId);
            const challengeSnap = await getDoc(challengeRef);

            if (!challengeSnap.exists()) {
                throw new Error("Challenge expired or invalid.");
            }

            const data = challengeSnap.data();
            if (data.resolved) throw new Error("This challenge has already been used.");

            if (data.correctNumber === selectedNumber) {
                // SUCCESS: Find or Create User
                const usersRef = collection(db, "users");
                const q = query(usersRef, where("phoneNumber", "==", data.phoneNumber));
                const userSnapshot = await getDocs(q);

                if (!userSnapshot.empty) {
                    // Sign-in existing user via Firebase custom token (Simulation)
                    // For this generic app, we'll manually sign them in or link
                    // Actually, for a fully secure system we'd use custom tokens from a backend
                    console.log("User verified via Number Selection:", data.phoneNumber);
                    // IMPORTANT: In a production Firebase environment, you'd call a server-side verify endpoint 
                    // which returns a Custom Token for firebase.auth().signInWithCustomToken()
                } else {
                    // Create new user (Simulation)
                    console.log("New user detected, please sign in with Google first then link.");
                }
                
                await updateDoc(challengeRef, { resolved: true });
                setChallengeData(null);
                setActiveChallengeId(null);
                setLoading(false);
            } else {
                throw new Error("Incorrect number selection. Please try again.");
            }
        } catch (err: any) {
            console.error("Challenge Verification Error:", err);
            setError(err.message);
            setLoading(false);
            throw err;
        }
    };

    const registerBiometrics = async () => {
        if (!user || !userData) return;
        setLoading(true);
        try {
            const credential = await registerFingerprint(user.uid, userData.username);
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                biometricCredential: {
                    credentialId: credential.credentialId,
                    publicKey: credential.publicKey,
                    registeredAt: serverTimestamp(),
                }
            });
            setLoading(false);
            window.alert("Fingerprint registered successfully!");
        } catch (err: any) {
            console.error("Biometric Registration Error:", err);
            setError(err.message);
            setLoading(false);
        }
    };

    const signInWithBiometrics = async () => {
        setLoading(true);
        setError(null);
        try {
            // Check if user is mobile
            if (!isMobile) throw new Error("Biometric login only available on mobile.");

            // Since we don't have the user yet during login, we need to ask for a username/phone or search
            // For simplicity in this demo flow, we'll ask for username first or search by device?
            // Actually, WebAuthn 'get' needs to know which credential IDs are allowed.
            // We'll search Firestore for all biometric credentials and try them? 
            // Better: User enters their email/phone, then we fetch THEIR credential ID.
            
            // For now, let's assume we implement a flow where user enters phone, then we check if biometrics exist.
            throw new Error("Please use OTP to sign in first, then enable Fingerprint.");
        } catch (err: any) {
            setError(err.message);
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
        <AuthContext.Provider value={{ 
            user, 
            userData, 
            loading, 
            error, 
            isMobile,
            challengeData,
            signInWithGoogle, 
            setupChallenge,
            verifyChallenge,
            signInWithBiometrics,
            registerBiometrics,
            signOut, 
            clearError 
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
