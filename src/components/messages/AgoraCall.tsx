"use client";

import { useEffect, useRef } from "react";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack, IRemoteVideoTrack, ILocalVideoTrack, ILocalAudioTrack } from "agora-rtc-sdk-ng";

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
    const audioTrackRef = useRef<ILocalAudioTrack | null>(null);
    const videoTrackRef = useRef<ILocalVideoTrack | null>(null);
    const remoteAudioTracksRef = useRef<Map<string, any>>(new Map());
    const remoteVideoTracksRef = useRef<Map<string, IRemoteVideoTrack>>(new Map());

    useEffect(() => {
        let agoraClient: IAgoraRTCClient;

        const init = async () => {
            if (joinInProgress.current) return;
            joinInProgress.current = true;

            if (!APP_ID || APP_ID === "YOUR_AGORA_APP_ID") return;

            try {
                // Initialize Agora Client
                agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

                // Set up event listeners BEFORE joining
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
                            // Ensure DOM is ready for rendering
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

                // Join the channel
                await agoraClient.join(APP_ID, roomName, null, null);
                
                // Explicitly request tracks for the local user
                if (callType === 'video') {
                    const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
                    audioTrackRef.current = audioTrack;
                    videoTrackRef.current = videoTrack;
                    
                    await agoraClient.publish([audioTrack, videoTrack]);
                    
                    // Render locally
                    setTimeout(() => {
                        videoTrack.play("local-video-container");
                    }, 500);
                } else {
                    const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
                    audioTrackRef.current = audioTrack;
                    await agoraClient.publish([audioTrack]);
                }

                console.log("Agora: Local user tracks published successfully.");
            } catch (error) {
                console.error("Agora: Bidirectional logic failed:", error);
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

    // Synchronize Controls Real-time
    useEffect(() => {
        const syncTracks = async () => {
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

            // Local camera track sync
            if (videoTrackRef.current) {
                videoTrackRef.current.setEnabled(!isHoldActive && !isVideoOff);
            }

            // Remote camera tracks sync
            remoteVideoTracksRef.current.forEach((track) => {
                if (isHoldActive) {
                    track.stop();
                } else {
                    track.play("remote-video-container");
                }
            });
        };

        syncTracks();
    }, [isMuted, isSpeakerActive, isHoldActive, isVideoOff]);

    return null;
}
