"use client";

import { useEffect, useRef } from "react";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";

/**
 * AgoraCall is now a "Ghost" component that handles the background 
 * microphone/audio logic without rendering any UI.
 */
export default function AgoraCall({ 
    roomName, 
    callType, 
    onRemoteJoined, 
    isMuted, 
    isSpeakerActive, 
    isHoldActive 
}: { 
    roomName: string, 
    callType: 'voice' | 'video', 
    onRemoteJoined?: () => void,
    isMuted?: boolean,
    isSpeakerActive?: boolean,
    isHoldActive?: boolean
}) {
    const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || "56b46b437307402bb2a172013bab91d2";
    const joinInProgress = useRef(false);
    const audioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
    const videoTrackRef = useRef<ICameraVideoTrack | null>(null);
    const remoteAudioTracksRef = useRef<Map<string, any>>(new Map());

    useEffect(() => {
        let agoraClient: IAgoraRTCClient;

        const init = async () => {
            if (joinInProgress.current) return;
            joinInProgress.current = true;

            if (!APP_ID || APP_ID === "YOUR_AGORA_APP_ID") return;

            try {
                agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

                agoraClient.on("user-published", async (user, mediaType) => {
                    await agoraClient.subscribe(user, mediaType);
                    if (mediaType === "audio") {
                        const track = user.audioTrack;
                        if (track) {
                            remoteAudioTracksRef.current.set(user.uid.toString(), track);
                            // Only play if not on hold
                            if (!isHoldActive) track.play();
                            // Apply speaker volume
                            track.setVolume(isSpeakerActive ? 100 : 20);
                            if (onRemoteJoined) onRemoteJoined();
                        }
                    }
                });

                agoraClient.on("user-unpublished", (user, mediaType) => {
                    if (mediaType === "audio") {
                        remoteAudioTracksRef.current.delete(user.uid.toString());
                    }
                });

                await agoraClient.join(APP_ID, roomName, null, null);
                
                audioTrackRef.current = await AgoraRTC.createMicrophoneAudioTrack();
                
                if (callType === 'video') {
                    videoTrackRef.current = await AgoraRTC.createCameraVideoTrack().catch(() => null);
                    if (videoTrackRef.current) {
                        await agoraClient.publish([audioTrackRef.current, videoTrackRef.current]);
                    } else {
                        await agoraClient.publish([audioTrackRef.current]);
                    }
                } else {
                    await agoraClient.publish([audioTrackRef.current]);
                }
            } catch (error) {
                console.error("Agora: Background logic failed:", error);
                joinInProgress.current = false;
            }
        };

        if (roomName) init();

        return () => {
            joinInProgress.current = false;
            audioTrackRef.current?.stop();
            audioTrackRef.current?.close();
            videoTrackRef.current?.stop();
            videoTrackRef.current?.close();
            if (agoraClient) {
                agoraClient.leave().catch(() => {});
            }
        };
    }, [roomName, callType]);

    // Handle Controls (Mute, Speaker, Hold)
    useEffect(() => {
        // Mute / Unmute local microphone
        // Hold also mutes the local mic
        const shouldMute = isMuted || isHoldActive;
        if (audioTrackRef.current) {
            audioTrackRef.current.setEnabled(!shouldMute);
        }

        // Speaker Volume & Hold (Playback)
        remoteAudioTracksRef.current.forEach((track) => {
            if (isHoldActive) {
                track.stop(); // Stop playback on hold
            } else {
                track.play(); // Resume playback
                track.setVolume(isSpeakerActive ? 100 : 20);
            }
        });
    }, [isMuted, isSpeakerActive, isHoldActive]);

    return null;
}
