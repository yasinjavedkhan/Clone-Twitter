import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react-native';
import { createAgoraRtcEngine, ChannelProfileType, ClientRoleType, IRtcEngine, RtcSurfaceView } from 'react-native-agora';
import { auth } from '../../src/lib/firebase';

// NOTE: In production, use a secure way to store your App ID
const APP_ID = "56b46b437307402bb2a172013bab91d2"; 

export default function CallScreen() {
    const { id, type, room } = useLocalSearchParams();
    const user = auth.currentUser;
    const router = useRouter();
    const channelName = (Array.isArray(room) ? room[0] : room) || `Call_${Array.isArray(id) ? id[0] : id}`;
    
    const [engine, setEngine] = useState<IRtcEngine | null>(null);
    const [isJoined, setIsJoined] = useState(false);
    const [remoteUid, setRemoteUid] = useState<number>(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(type === 'voice');

    useEffect(() => {
        init();
        return () => {
            engine?.leaveChannel();
            engine?.release();
        };
    }, []);

    const init = async () => {
        try {
            const rtcEngine = createAgoraRtcEngine();
            rtcEngine.initialize({ appId: APP_ID });
            setEngine(rtcEngine);

            rtcEngine.registerEventHandler({
                onJoinChannelSuccess: () => {
                    setIsJoined(true);
                },
                onUserJoined: (connection, uid) => {
                    setRemoteUid(uid);
                },
                onUserOffline: () => {
                    setRemoteUid(0);
                },
                onError: (err) => {
                    console.error("Agora Error:", err);
                }
            });

            if (type === 'video') {
                rtcEngine.enableVideo();
                rtcEngine.startPreview();
            } else {
                rtcEngine.enableAudio();
            }

            rtcEngine.joinChannel('', channelName, 0, {
                channelProfile: ChannelProfileType.ChannelProfileCommunication,
                clientRoleType: ClientRoleType.ClientRoleBroadcaster,
            });
        } catch (e) {
            console.error(e);
        }
    };

    const toggleMute = () => {
        engine?.muteLocalAudioStream(!isMuted);
        setIsMuted(!isMuted);
    };

    const toggleVideo = () => {
        engine?.muteLocalVideoStream(!isVideoOff);
        setIsVideoOff(!isVideoOff);
    };

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            
            <View style={styles.videoContainer}>
                {remoteUid !== 0 ? (
                    <RtcSurfaceView
                        canvas={{ uid: remoteUid }}
                        style={styles.remoteVideo}
                    />
                ) : (
                    <View style={styles.placeholder}>
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarText}>{channelName[0].toUpperCase()}</Text>
                        </View>
                        <Text style={styles.callingText}>Calling...</Text>
                        <Text style={styles.subText}>Secure end-to-end encrypted</Text>
                    </View>
                )}

                {type === 'video' && isJoined && !isVideoOff && (
                    <View style={styles.localVideoWrapper}>
                        <RtcSurfaceView
                            canvas={{ uid: 0 }}
                            style={styles.localVideo}
                        />
                    </View>
                )}
            </View>

            <View style={styles.controls}>
                <TouchableOpacity 
                    style={[styles.controlButton, isMuted && styles.activeControl]} 
                    onPress={toggleMute}
                >
                    {isMuted ? <MicOff color="#fff" size={24} /> : <Mic color="#fff" size={24} />}
                </TouchableOpacity>
                
                <TouchableOpacity 
                    style={styles.hangupButton} 
                    onPress={() => {
                        engine?.leaveChannel();
                        router.back();
                    }}
                >
                    <PhoneOff color="#fff" size={32} />
                </TouchableOpacity>

                {type === 'video' && (
                    <TouchableOpacity 
                        style={[styles.controlButton, isVideoOff && styles.activeControl]} 
                        onPress={toggleVideo}
                    >
                        {isVideoOff ? <VideoOff color="#fff" size={24} /> : <Video color="#fff" size={24} />}
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#050505',
    },
    videoContainer: {
        flex: 1,
        position: 'relative',
    },
    remoteVideo: {
        flex: 1,
    },
    localVideoWrapper: {
        width: 120,
        height: 180,
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 10,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: '#1d9bf0',
        backgroundColor: '#111',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10,
    },
    localVideo: {
        flex: 1,
    },
    placeholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#050505',
    },
    avatarPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#1d9bf0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#1d9bf0',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 5,
    },
    avatarText: {
        color: '#fff',
        fontSize: 48,
        fontWeight: '900',
    },
    callingText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subText: {
        color: '#71767b',
        fontSize: 14,
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 20,
        paddingBottom: 40,
        gap: 30,
        backgroundColor: 'transparent',
    },
    controlButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeControl: {
        backgroundColor: '#ef4444',
    },
    hangupButton: {
        width: 84,
        height: 84,
        borderRadius: 42,
        backgroundColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 10,
    },
});
