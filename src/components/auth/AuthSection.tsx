"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Phone, Lock, Fingerprint, RefreshCcw, Smartphone, Laptop } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AuthSection() {
    const { 
        isMobile, 
        setupChallenge, 
        verifyChallenge, 
        challengeData,
        loading, 
        error, 
        user, 
        userData,
        registerBiometrics,
        signInWithBiometrics,
        clearError 
    } = useAuth();

    const [phoneNumber, setPhoneNumber] = useState("");
    const [step, setStep] = useState<"phone" | "challenge">("phone");
    const [timer, setTimer] = useState(0);
    const recaptchaRef = useRef<HTMLDivElement>(null);

    // Resend Timer logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (timer > 0) {
            interval = setInterval(() => setTimer(t => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [timer]);

    const handleSendChallenge = async () => {
        if (!phoneNumber || phoneNumber.length < 10) {
            alert("Please enter a valid phone number with country code.");
            return;
        }
        try {
            await setupChallenge(phoneNumber);
            setStep("challenge");
            setTimer(60); // 60 seconds cooldown
        } catch (err: any) {
            // Error handled in context
        }
    };

    const handleSelectNumber = async (num: number) => {
        try {
            await verifyChallenge(num);
        } catch (err: any) {
            // Error handled in context
        }
    };

    const handleBiometricLogin = async () => {
        try {
            await signInWithBiometrics();
        } catch (err: any) {
            // Fallback to OTP is implicit as the Phone UI is still there
            console.log("Biometric failed, continuing with OTP option.");
        }
    };

    if (user) {
        return (
            <div className="flex flex-col items-center gap-4 p-6 bg-gray-900/50 rounded-2xl border border-gray-800">
                <div className="text-center">
                    <p className="text-gray-400 text-sm">Signed in as</p>
                    <p className="font-bold text-white">{userData?.displayName || userData?.username || user.phoneNumber}</p>
                </div>
                
                {isMobile && !userData?.biometricCredential && (
                    <Button 
                        onClick={registerBiometrics}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 h-12 rounded-full font-bold"
                    >
                        <Fingerprint className="w-5 h-5" />
                        Enable Fingerprint Login
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="w-full max-w-sm mx-auto space-y-6">
            {/* Header: Device Detection Badge */}
            <div className="flex justify-center">
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-800/50 rounded-full border border-gray-700 text-xs text-gray-400">
                    {isMobile ? (
                        <>
                            <Smartphone className="w-3 h-3 text-blue-400" />
                            <span>Mobile Session (Fingerprint Enabled)</span>
                        </>
                    ) : (
                        <>
                            <Laptop className="w-3 h-3 text-yellow-400" />
                            <span>Desktop Session (OTP Only)</span>
                        </>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                {step === "phone" ? (
                    <>
                        <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <input
                                type="tel"
                                placeholder="+1234567890"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="w-full bg-black border border-gray-800 rounded-xl py-4 pl-12 pr-4 text-white focus:border-blue-500 outline-none transition-colors"
                            />
                        </div>
                        <Button
                            onClick={handleSendChallenge}
                            disabled={loading || !phoneNumber}
                            className="w-full twitter-button-primary h-12 text-[15px] font-bold rounded-full"
                        >
                            {loading ? "Sending..." : "Send Verification Challenge"}
                        </Button>
                    </>
                ) : (
                    <>
                        <div className="text-center py-2">
                            <p className="text-white font-bold text-lg">Select the number shown on your phone</p>
                            <p className="text-gray-500 text-sm mt-1">Check your notifications or the mock alert.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {challengeData?.numbers.map((num, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSelectNumber(num)}
                                    className="h-20 bg-gray-900 border border-gray-800 rounded-2xl flex items-center justify-center text-2xl font-black text-white hover:bg-gray-800 hover:border-blue-500 transition-all active:scale-95"
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                        <div className="flex justify-between items-center px-1">
                            <button 
                                onClick={() => setStep("phone")}
                                className="text-sm text-gray-500 hover:text-white transition"
                            >
                                Change Number
                            </button>
                            <button 
                                onClick={handleSendChallenge}
                                disabled={timer > 0}
                                className={cn("text-sm flex items-center gap-1", timer > 0 ? "text-gray-600 cursor-not-allowed" : "text-blue-400 hover:text-blue-300")}
                            >
                                <RefreshCcw className={cn("w-3 h-3", timer > 0 && "animate-spin")} />
                                {timer > 0 ? `Resend in ${timer}s` : "Resend Challenge"}
                            </button>
                        </div>
                    </>
                )}

                {/* Biometric Option for Mobile ONLY */}
                {isMobile && step === "phone" && (
                    <div className="relative pt-4">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full border-t border-gray-800"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-black px-2 text-gray-500 font-medium">Or</span>
                        </div>
                        <div className="pt-6">
                            <Button
                                onClick={handleBiometricLogin}
                                className="w-full flex items-center justify-center gap-2 bg-white text-black hover:bg-gray-200 h-12 rounded-full font-bold transition-all transform active:scale-95"
                            >
                                <Fingerprint className="w-5 h-5" />
                                Login with Fingerprint
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Error Message Display */}
            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center">
                    {error}
                </div>
            )}

            {/* Recaptcha Container (Hidden) */}
            <div id="recaptcha-container"></div>
        </div>
    );
}
