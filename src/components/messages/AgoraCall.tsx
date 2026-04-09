"use client";

import { useEffect, useRef } from "react";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack, IRemoteVideoTrack, ILocalVideoTrack, ILocalAudioTrack } from "agora-rtc-sdk-ng";

/**
 * AgoraCall handles the background media tracks for calling.
 * This version is strictly optimized for bidirectional video.
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

            if (!APP_ID || APP_ID === "YOUR_AGORA_APP_ID") {
                joinInProgress.current = false;
                return;
            }

            try {
                // 1. Create client
                agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

                // 2. Set up remote publishing listeners
                agoraClient.on("user-published", async (user, mediaType) => {
                    await agoraClient.subscribe(user, mediaType);
                    
                    if (mediaType === "audio") {
                        const track = user.audioTrack;
                        if (track) {
                            remoteAudioTracksRef.current.set(user.uid.toString(), track);
                            // Auto play audio
                            track.play();
                            track.setVolume(isSpeakerActive ? 100 : 40);
                            if (onRemoteJoined) onRemoteJoined();
                        }
                    }

                    if (mediaType === "video") {
                        const track = user.videoTrack;
                        if (track) {
                            remoteVideoTracksRef.current.set(user.uid.toString(), track);
                            if (onRemoteVideoToggle) onRemoteVideoToggle(true);
                            
                            // Strict check for container availability (important if call is just connecting)
                            let attempts = 0;
                            const checkContainer = setInterval(() => {
                                 attempts++;
                                 const container = document.getElementById("remote-video-container");
                                 if (container) {
                                      track.play("remote-video-container");
                                      clearInterval(checkContainer);
                                 }
                                 if (attempts > 60) clearInterval(checkContainer); // Stop after 30s
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

                // 3. Join channel
                await agoraClient.join(APP_ID, roomName, null, null);
                
                // 4. Capture and Publish local tracks
                if (callType === 'video') {
                    // Both users MUST publish audio and video tracks for strict bidirectional
                    const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
                    audioTrackRef.current = audioTrack;
                    videoTrackRef.current = videoTrack;
                    
                    // Render locally mirrored feed
                    const localCheck = setInterval(() => {
                        const localContainer = document.getElementById("local-video-container");
                        if (localContainer) {
                            videoTrack.play("local-video-container");
                            clearInterval(localCheck);
                        }
                    }, 500);
                    setTimeout(() => clearInterval(localCheck), 10000);

                    // PUBLISH BOTH
                    await agoraClient.publish([audioTrack, videoTrack]);
                } else {
                    const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
                    audioTrackRef.current = audioTrack;
                    await agoraClient.publish([audioTrack]);
                }

                console.log("Agora: Bidirectional connection established.");
            } catch (error) {
                console.error("Agora: Bidirectional setup error:", error);
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

    // Handle Toggles (Mute, Speaker, Hold, Video Off)
    useEffect(() => {
        const syncMedia = async () => {
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

            if (videoTrackRef.current) {
                videoTrackRef.current.setEnabled(!isHoldActive && !isVideoOff);
            }

            remoteVideoTracksRef.current.forEach((track) => {
                const container = document.getElementById("remote-video-container");
                if (container && !isHoldActive) {
                    track.play("remote-video-container");
                } else if (isHoldActive) {
                    track.stop();
                }
            });
        };

        syncMedia();
    }, [isMuted, isSpeakerActive, isHoldActive, isVideoOff, roomName]);


    return null;
}
