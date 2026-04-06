"use client";

import { useEffect, useRef, useState } from "react";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";

/**
 * AgoraCall is now a "Ghost" component that handles the background 
 * microphone/audio logic without rendering any UI.
 */
export default function AgoraCall({ roomName, callType, onRemoteJoined }: { 
    roomName: string, 
    callType: 'voice' | 'video', 
    onRemoteJoined?: () => void 
}) {
    const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || "56b46b437307402bb2a172013bab91d2";
    const joinInProgress = useRef(false);

    useEffect(() => {
        let agoraClient: IAgoraRTCClient;
        let audio: IMicrophoneAudioTrack | null = null;
        let video: ICameraVideoTrack | null = null;

        const init = async () => {
            if (joinInProgress.current) return;
            joinInProgress.current = true;

            if (!APP_ID || APP_ID === "YOUR_AGORA_APP_ID") return;

            try {
                agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

                agoraClient.on("user-published", async (user, mediaType) => {
                    await agoraClient.subscribe(user, mediaType);
                    if (mediaType === "audio") {
                        user.audioTrack?.play();
                        if (onRemoteJoined) onRemoteJoined();
                    }
                });

                await agoraClient.join(APP_ID, roomName, null, null);
                
                audio = await AgoraRTC.createMicrophoneAudioTrack();
                
                if (callType === 'video') {
                    video = await AgoraRTC.createCameraVideoTrack().catch(() => null);
                    if (video) {
                        await agoraClient.publish([audio, video]);
                    } else {
                        await agoraClient.publish([audio]);
                    }
                } else {
                    await agoraClient.publish([audio]);
                }
            } catch (error) {
                console.error("Agora: Background logic failed:", error);
                joinInProgress.current = false;
            }
        };

        if (roomName) init();

        return () => {
            joinInProgress.current = false;
            audio?.stop();
            audio?.close();
            video?.stop();
            video?.close();
            if (agoraClient) {
                agoraClient.leave().catch(() => {});
            }
        };
    }, [roomName, callType]);

    // This component renders nothing, it only handles audio/video tracks in the background
    return null;
}
