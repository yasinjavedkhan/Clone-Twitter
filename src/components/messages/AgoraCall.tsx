"use client";

import { useEffect, useRef, useState } from "react";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

export default function AgoraCall({ roomName, callType, onEndCall }: { roomName: string, callType: 'voice' | 'video', onEndCall: () => void }) {
    const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || "YOUR_AGORA_APP_ID"; // Replace with user's App ID
    const [client, setClient] = useState<IAgoraRTCClient | null>(null);
    const [localTracks, setLocalTracks] = useState<(ICameraVideoTrack | IMicrophoneAudioTrack)[]>([]);
    const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(callType === 'voice');
    const localVideoRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let agoraClient: IAgoraRTCClient;
        let audio: IMicrophoneAudioTrack | null = null;
        let video: ICameraVideoTrack | null = null;

        const init = async () => {
            if (!APP_ID || APP_ID === "YOUR_AGORA_APP_ID") {
                console.error("Agora App ID is missing.");
                return;
            }

            agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
            setClient(agoraClient);

            agoraClient.on("user-published", async (user, mediaType) => {
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
                setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
            });

            try {
                await agoraClient.join(APP_ID, roomName, null, null);
                audio = await AgoraRTC.createMicrophoneAudioTrack();
                
                if (callType === 'video') {
                    video = await AgoraRTC.createCameraVideoTrack();
                    setLocalTracks([audio, video]);
                    await agoraClient.publish([audio, video]);
                    if (localVideoRef.current) video.play(localVideoRef.current);
                } else {
                    setLocalTracks([audio]);
                    await agoraClient.publish([audio]);
                }
            } catch (error) {
                console.error("Agora init error:", error);
            }
        };

        init();

        return () => {
            audio?.stop();
            audio?.close();
            video?.stop();
            video?.close();
            agoraClient?.leave();
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
        const videoTrack = localTracks.find(t => t.trackMediaType === 'video') as ICameraVideoTrack;
        if (videoTrack) {
            videoTrack.setEnabled(isVideoOff);
            setIsVideoOff(!isVideoOff);
        }
    };

    return (
        <div className="flex-grow flex flex-col bg-gray-950 relative overflow-hidden">
            {/* Remote Video (Full Screen) */}
            <div className="absolute inset-0 bg-black">
                {remoteUsers.length > 0 ? (
                    remoteUsers.map((user) => (
                        <RemoteVideo key={user.uid} user={user} />
                    ))
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                        <div className="text-center">
                            <div className="w-24 h-24 rounded-full bg-twitter-blue/20 mx-auto mb-6 animate-pulse flex items-center justify-center">
                                <Video className="w-10 h-10 text-twitter-blue" />
                            </div>
                            <p className="text-xl font-medium text-white">Calling...</p>
                            <p className="text-sm text-gray-500 mt-2">Connecting to secure line</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Local Video (PiP) */}
            {callType === 'video' && (
                <div 
                    ref={localVideoRef} 
                    className="absolute top-6 right-6 w-32 h-44 bg-gray-900 rounded-2xl border-2 border-twitter-blue shadow-2xl overflow-hidden z-20"
                />
            )}

            {/* Controls */}
            <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center gap-8 z-30">
                <button 
                    onClick={toggleMute}
                    className={`p-5 rounded-full transition-all duration-300 shadow-lg ${isMuted ? 'bg-red-500' : 'bg-gray-800/80 hover:bg-gray-700'}`}
                >
                    {isMuted ? <MicOff className="w-7 h-7 text-white" /> : <Mic className="w-7 h-7 text-white" />}
                </button>

                <button 
                    onClick={onEndCall}
                    className="p-6 bg-red-600 rounded-full hover:bg-red-700 transition-all duration-300 shadow-2xl shadow-red-900/60 transform hover:scale-110 active:scale-95"
                >
                    <PhoneOff className="w-9 h-9 text-white" />
                </button>

                {callType === 'video' && (
                    <button 
                        onClick={toggleVideo}
                        className={`p-5 rounded-full transition-all duration-300 shadow-lg ${isVideoOff ? 'bg-red-500' : 'bg-gray-800/80 hover:bg-gray-700'}`}
                    >
                        {isVideoOff ? <VideoOff className="w-7 h-7 text-white" /> : <Video className="w-7 h-7 text-white" />}
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
