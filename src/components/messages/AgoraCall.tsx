"use client";

import { useEffect, useRef } from "react";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack, IRemoteVideoTrack } from "agora-rtc-sdk-ng";

/**
 * AgoraCall is now a "Ghost" component that handles the background 
 * microphone/audio logic without rendering any UI.
 */
export default function AgoraCall({ 
    roomName, 
    callType, 
    onRemoteJoined,
    onRemoteVideoToggle,
    isMuted, 
    isSpeakerActive, 
    isHoldActive,
    isVideoOff
}: { 
    roomName: string, 
    callType: 'voice' | 'video', 
    onRemoteJoined?: () => void,
    onRemoteVideoToggle?: (isPlaying: boolean) => void,
    isMuted?: boolean,
    isSpeakerActive?: boolean,
    isHoldActive?: boolean,
    isVideoOff?: boolean
}) {
    const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || "56b46b437307402bb2a172013bab91d2";
    const joinInProgress = useRef(false);
    const audioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
    const videoTrackRef = useRef<ICameraVideoTrack | null>(null);
    const remoteAudioTracksRef = useRef<Map<string, any>>(new Map());
    const remoteVideoTracksRef = useRef<Map<string, IRemoteVideoTrack>>(new Map());

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
                            if (!isHoldActive) track.play();
                            track.setVolume(isSpeakerActive ? 100 : 40);
                            if (onRemoteJoined) onRemoteJoined();
                        }
                    }

                    if (mediaType === "video") {
                        const track = user.videoTrack;
                        if (track) {
                            remoteVideoTracksRef.current.set(user.uid.toString(), track);
                            if (onRemoteVideoToggle) onRemoteVideoToggle(true);
                            // Wait for DOM to be ready
                            setTimeout(() => {
                                track.play("remote-video-container");
                            }, 500);
                        }
                    }
                });

                agoraClient.on("user-unpublished", (user, mediaType) => {
                    if (mediaType === "audio") {
                        remoteAudioTracksRef.current.delete(user.uid.toString());
                    }
                    if (mediaType === "video") {
                        remoteVideoTracksRef.current.delete(user.uid.toString());
                        if (onRemoteVideoToggle) onRemoteVideoToggle(false);
                    }
                });

                await agoraClient.join(APP_ID, roomName, null, null);
                
                audioTrackRef.current = await AgoraRTC.createMicrophoneAudioTrack();
                
                if (callType === 'video') {
                    videoTrackRef.current = await AgoraRTC.createCameraVideoTrack().catch(() => null);
                    if (videoTrackRef.current) {
                        await agoraClient.publish([audioTrackRef.current, videoTrackRef.current]);
                        // Wait for DOM to be ready
                        setTimeout(() => {
                            videoTrackRef.current?.play("local-video-container");
                        }, 500);
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
        const shouldMute = isMuted || isHoldActive;
        if (audioTrackRef.current) {
            audioTrackRef.current.setEnabled(!shouldMute);
        }

        remoteAudioTracksRef.current.forEach((track) => {
            if (isHoldActive) {
                track.stop();
            } else {
                track.play();
                track.setVolume(isSpeakerActive ? 100 : 40);
            }
        });

        // Toggle Video display on hold or explicit Camera Off
        if (videoTrackRef.current) {
            videoTrackRef.current.setEnabled(!isHoldActive && !isVideoOff);
        }

        remoteVideoTracksRef.current.forEach((track) => {
            if (isHoldActive) {
                track.stop();
            } else {
                track.play("remote-video-container");
            }
        });
    }, [isMuted, isSpeakerActive, isHoldActive, isVideoOff]);

    return null;
}
