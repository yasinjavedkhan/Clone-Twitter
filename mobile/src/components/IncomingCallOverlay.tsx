import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Image } from 'react-native';
import { Phone, PhoneOff, Video } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { BlurView } from 'expo-blur';

export default function IncomingCallOverlay() {
    const [incomingCall, setIncomingCall] = useState<any>(null);
    const router = useRouter();

    useEffect(() => {
        const subscription = Notifications.addNotificationReceivedListener(notification => {
            const data = notification.request.content.data;
            if (data?.type === 'call') {
                setIncomingCall(data);
            }
        });

        const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data;
            if (data?.type === 'call') {
                handleAccept(data);
            }
        });

        return () => {
            subscription.remove();
            responseSubscription.remove();
        };
    }, []);

    const handleAccept = (callData = incomingCall) => {
        setIncomingCall(null);
        // Using string template for the path as it's more reliable in some expo-router versions
        router.push(`/call/${callData.conversationId}?type=${callData.callType}` as any);
    };

    const handleDecline = () => {
        setIncomingCall(null);
    };

    if (!incomingCall) return null;

    return (
        <Modal transparent visible={!!incomingCall} animationType="fade">
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
                <View style={styles.container}>
                    <View style={styles.avatarContainer}>
                        {incomingCall.fromUserAvatar ? (
                            <Image source={{ uri: incomingCall.fromUserAvatar }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarInitial}>
                                    {incomingCall.fromUserName?.[0] || '?'}
                                </Text>
                            </View>
                        )}
                        <View style={styles.ringRing} />
                    </View>

                    <Text style={styles.name}>{incomingCall.fromUserName || 'Someone'}</Text>
                    <Text style={styles.status}>
                        Incoming {incomingCall.callType === 'video' ? 'Video' : 'Voice'} Call...
                    </Text>

                    <View style={styles.actions}>
                        <TouchableOpacity 
                            onPress={handleDecline}
                            style={[styles.button, styles.declineButton]}
                        >
                            <PhoneOff size={32} color="white" />
                            <Text style={styles.buttonText}>Decline</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => handleAccept()}
                            style={[styles.button, styles.acceptButton]}
                        >
                            {incomingCall.callType === 'video' ? (
                                <Video size={32} color="white" />
                            ) : (
                                <Phone size={32} color="white" />
                            )}
                            <Text style={styles.buttonText}>Accept</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </BlurView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    avatarContainer: {
        marginBottom: 30,
        alignItems: 'center',
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        borderColor: '#1d9bf0',
    },
    avatarPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#1d9bf0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: {
        fontSize: 48,
        fontWeight: 'bold',
        color: 'white',
    },
    ringRing: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 2,
        borderColor: '#1d9bf033',
        // Note: Actual animation would need Animated API
    },
    name: {
        fontSize: 28,
        fontWeight: '900',
        color: 'white',
        marginBottom: 8,
    },
    status: {
        fontSize: 16,
        color: '#1d9bf0',
        fontWeight: '600',
    },
    actions: {
        flexDirection: 'row',
        gap: 60,
        marginTop: 80,
    },
    button: {
        alignItems: 'center',
        gap: 10,
    },
    declineButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#ff4444',
        alignItems: 'center',
        justifyContent: 'center',
    },
    acceptButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#00ba7c',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#8899a6',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    }
});
