"use client";

import { useEffect, useRef, useState } from "react";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

export default function AgoraCall({ roomName, callType, otherUser, onEndCall }: { roomName: string, callType: 'voice' | 'video', otherUser: any, onEndCall: () => void }) {
    const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || "56b46b437307402bb2a172013bab91d2";
    const [client, setClient] = useState<IAgoraRTCClient | null>(null);
    const [localTracks, setLocalTracks] = useState<(ICameraVideoTrack | IMicrophoneAudioTrack)[]>([]);
    const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(callType === 'voice');
    const [initError, setInitError] = useState<string | null>(null);
    const localVideoRef = useRef<HTMLDivElement>(null);
    const joinInProgress = useRef(false);

    useEffect(() => {
        let agoraClient: IAgoraRTCClient;
        let audio: IMicrophoneAudioTrack | null = null;
        let video: ICameraVideoTrack | null = null;

        const init = async () => {
            if (joinInProgress.current) return;
            joinInProgress.current = true;

            console.log("Agora: Starting initialization for room:", roomName);

            if (!APP_ID || APP_ID === "YOUR_AGORA_APP_ID") {
                console.error("Agora: App ID is missing.");
                setInitError("Agora App ID is missing. Please check configuration.");
                return;
            }

            try {
                agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
                setClient(agoraClient);

                agoraClient.on("user-published", async (user, mediaType) => {
                    console.log("Agora: Remote user published:", user.uid, mediaType);
                    await agoraClient.subscribe(user, mediaType);
                    if (mediaType === "video") {
                        setRemoteUsers((prev) => {
                            if (prev.find(u => u.uid === user.uid)) return prev;
                            return [...prev, user];
                        });
                    }
                    if (mediaType === "audio") {
                        user.audioTrack?.play();
                    }
                });

                agoraClient.on("user-unpublished", (user) => {
                    console.log("Agora: Remote user unpublished:", user.uid);
                    setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
                });

                console.log("Agora: Joining channel...");
                await agoraClient.join(APP_ID, roomName, null, null);
                
                console.log("Agora: Creating local tracks...");
                audio = await AgoraRTC.createMicrophoneAudioTrack();
                
                if (callType === 'video') {
                    video = await AgoraRTC.createCameraVideoTrack().catch((err) => {
                        console.warn("Agora: Camera access failed, falling back to audio only.", err);
                        return null;
                    });
                    
                    if (video) {
                        setLocalTracks([audio, video]);
                        await agoraClient.publish([audio, video]);
                        if (localVideoRef.current) {
                            video.play(localVideoRef.current);
                        }
                    } else {
                        setLocalTracks([audio]);
                        await agoraClient.publish([audio]);
                        setIsVideoOff(true);
                    }
                } else {
                    setLocalTracks([audio]);
                    await agoraClient.publish([audio]);
                }
                console.log("Agora: Local tracks published successfully.");
            } catch (error: any) {
                console.error("Agora: Initialization failed:", error);
                joinInProgress.current = false;
                if (error.name === 'NotAllowedError' || error.message?.includes('PERMISSION_DENIED')) {
                    setInitError("Mic/Camera access denied. Please check site permissions.");
                } else if (error.message?.includes('INVALID_APP_ID')) {
                    setInitError("Invalid Agora App ID.");
                } else {
                    setInitError("Connection failed: " + (error.message || "Unknown error"));
                }
            }
        };

        if (roomName) init();

        return () => {
            console.log("Agora: Cleaning up tracks and leaving channel...");
            joinInProgress.current = false;
            audio?.stop();
            audio?.close();
            video?.stop();
            video?.close();
            if (agoraClient) {
                agoraClient.leave().catch((err) => console.warn("Agora: Error during leave:", err));
            }
        };
    }, [roomName, callType]);

    const toggleMute = () => {
        const audioTrack = localTracks.find(t => t.trackMediaType === 'audio') as IMicrophoneAudioTrack;
        if (audioTrack) {
            audioTrack.setEnabled(isMuted);
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (callType === 'voice') return;
        const videoTrack = localTracks.find(t => t.trackMediaType === 'video') as ICameraVideoTrack;
        if (videoTrack) {
            videoTrack.setEnabled(isVideoOff);
            setIsVideoOff(!isVideoOff);
        }
    };

    return (
        <div className="flex-grow flex flex-col bg-[#050505] relative overflow-hidden">
            {/* Header Status */}
            <div className="absolute top-8 left-0 right-0 z-30 flex flex-col items-center">
                 <div className="bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-green-500 text-[11px] font-bold uppercase tracking-wider">Secure Call</span>
                 </div>
            </div>

            {/* Main Content Area */}
            <div className="absolute inset-0 bg-black flex items-center justify-center">
                {initError ? (
                    <div className="flex flex-col items-center justify-center text-red-500 p-10 text-center animate-in fade-in zoom-in">
                        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                             <PhoneOff className="w-10 h-10" />
                        </div>
                        <p className="text-xl font-bold mb-2">Connection Issue</p>
                        <p className="text-sm text-gray-500 mb-6 max-w-xs">{initError}</p>
                        <button 
                            onClick={onEndCall}
                            className="bg-white text-black px-8 py-3 rounded-full font-bold transition hover:scale-105"
                        >
                            Return to Chat
                        </button>
                    </div>
                ) : (remoteUsers.length > 0 && !isVideoOff && callType === 'video') ? (
                    remoteUsers.map((user) => (
                        <RemoteVideo key={user.uid} user={user} />
                    ))
                ) : (
                    /* Real Call Visualizer */
                    <div className="flex flex-col items-center animate-in fade-in duration-500">
                        <div className="relative mb-8">
                            {/* Pulse Rings */}
                            <div className="absolute inset-0 bg-twitter-blue/20 rounded-full animate-ping" />
                            <div className="absolute inset-0 bg-twitter-blue/10 rounded-full animate-pulse scale-110" />
                            
                            <div className="relative w-40 h-40 rounded-full border-4 border-twitter-blue/30 overflow-hidden shadow-2xl shadow-twitter-blue/20">
                                {otherUser?.profileImage ? (
                                    <img src={otherUser.profileImage} className="w-full h-full object-cover" alt="Caller" />
                                ) : (
                                    <div className="w-full h-full bg-twitter-blue flex items-center justify-center text-5xl font-bold text-white uppercase">
                                        {otherUser?.displayName?.[0] || "?"}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <h2 className="text-3xl font-black text-white">{otherUser?.displayName || "Connecting..."}</h2>
                        <p className="text-twitter-blue font-medium mt-3 tracking-[0.2em] uppercase text-xs animate-pulse">
                            {remoteUsers.length > 0 ? "Voice Call Active" : "Ringing..."}
                        </p>
                    </div>
                )}
            </div>

            {/* Local Video (PiP) */}
            {callType === 'video' && !isVideoOff && (
                <div 
                    ref={localVideoRef} 
                    className="absolute top-20 right-6 w-28 h-40 bg-gray-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden z-20"
                />
            )}

            {/* Premium Controls */}
            <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center gap-6 z-40">
                <button 
                    onClick={toggleMute}
                    className={`group flex flex-col items-center gap-2`}
                >
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${isMuted ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}>
                        {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
                    </div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">{isMuted ? "Unmute" : "Mute"}</span>
                </button>

                <button 
                    onClick={onEndCall}
                    className="group flex flex-col items-center gap-2"
                >
                    <div className="w-20 h-20 bg-red-600 rounded-full hover:bg-red-700 transition-all duration-300 flex items-center justify-center shadow-2xl shadow-red-900/40 transform hover:scale-105 active:scale-95">
                        <PhoneOff className="w-9 h-9 text-white" />
                    </div>
                    <span className="text-[10px] text-red-500 font-bold uppercase">End Call</span>
                </button>

                {callType === 'video' && (
                    <button 
                        onClick={toggleVideo}
                        className="group flex flex-col items-center gap-2"
                    >
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${isVideoOff ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}>
                            {isVideoOff ? <VideoOff className="w-6 h-6 text-white" /> : <Video className="w-6 h-6 text-white" />}
                        </div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase">{isVideoOff ? "Video On" : "Video Off"}</span>
                    </button>
                )}
            </div>
        </div>
    );
}

function RemoteVideo({ user }: { user: any }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (ref.current) {
            user.videoTrack?.play(ref.current);
        }
    }, [user]);

    return <div ref={ref} className="w-full h-full" />;
}

