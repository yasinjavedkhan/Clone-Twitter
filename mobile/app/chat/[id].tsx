import { StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Modal, Image } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc, increment } from 'firebase/firestore';
import { db, auth } from '../../src/lib/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, ChevronLeft, Phone, Video, X, Mic, MicOff, VideoOff, Maximize2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';

// Configuration for API requests
const IS_PROD = false; // Set to false for local testing
const BASE_URL = IS_PROD ? "https://clone-twitter-fmya.vercel.app" : "http://192.168.1.109:3000";

export default function ChatDetailScreen() {
    const { id } = useLocalSearchParams();
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const user = auth.currentUser;
    const router = useRouter();
    const flatListRef = useRef<FlatList>(null);
    const [otherUserData, setOtherUserData] = useState<any>(null);

    // Fetch other user info for the call screen
    useEffect(() => {
        if (!id || !user) return;
        const fetchOther = async () => {
            const convDoc = await getDoc(doc(db, "conversations", id as string));
            const participants = convDoc.data()?.participants || [];
            const otherId = participants.find((p: string) => p !== user.uid);
            if (otherId) {
                const userSnapshot = await getDoc(doc(db, "users", otherId));
                if (userSnapshot.exists()) {
                    setOtherUserData({ userId: userSnapshot.id, ...userSnapshot.data() });
                }
            }
        };
        fetchOther();
    }, [id, user]);

    useEffect(() => {
        if (!id) return;

        const q = query(
            collection(db, `conversations/${id}/messages`),
            orderBy("createdAt", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(document => ({
                id: document.id,
                ...document.data()
            }));

            // Mark unread messages as read
            if (user?.uid) {
                msgs.forEach((msg: any) => {
                    if (msg.senderId !== user.uid && !msg.read) {
                        updateDoc(doc(db, `conversations/${id}/messages/${msg.id}`), {
                            read: true
                        }).catch(console.error);
                    }
                });

                // Clear my unread count for this conversation
                updateDoc(doc(db, "conversations", id as string), {
                    [`unreadCount.${user.uid}`]: 0
                }).catch(() => {});
            }

            setMessages(msgs);
        });

        return () => unsubscribe();
    }, [id]);

    const recordCallEvent = async (type: 'voice' | 'video') => {
        if (!user || !id) return;
        const text = type === 'voice' ? "📞 Started a voice call" : "📹 Started a video call";
        try {
            await addDoc(collection(db, `conversations/${id}/messages`), {
                senderId: user.uid,
                text,
                type: 'call',
                read: false,
                createdAt: serverTimestamp(),
            });

            // Update unread count for the other user
            const convDoc = await getDoc(doc(db, "conversations", id as string));
            const participants = convDoc.data()?.participants || [];
            const otherId = participants.find((p: string) => p !== user.uid);
            if (otherId) {
                await updateDoc(doc(db, "conversations", id as string), {
                    lastMessage: text,
                    lastTimestamp: serverTimestamp(),
                    [`unreadCount.${otherId}`]: increment(1)
                });
            }
        } catch (error) {
            console.error("Error recording call event:", error);
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !user || !id) return;

        const msg = {
            text: newMessage,
            senderId: user.uid,
            read: false,
            createdAt: serverTimestamp(),
        };

        setNewMessage("");
        await addDoc(collection(db, `conversations/${id}/messages`), msg);

        // Update unread count for the other user
        const convDoc = await getDoc(doc(db, "conversations", id as string));
        const participants = convDoc.data()?.participants || [];
        const otherId = participants.find((p: string) => p !== user.uid);
        if (otherId) {
            await updateDoc(doc(db, "conversations", id as string), {
                lastMessage: newMessage,
                lastTimestamp: serverTimestamp(),
                [`unreadCount.${otherId}`]: increment(1)
            });
        }
    };

    const renderMessage = ({ item }: { item: any }) => {
        const isMine = item.senderId === user?.uid;
        return (
            <View style={[{ alignItems: isMine ? 'flex-end' : 'flex-start', alignSelf: 'stretch', marginBottom: 10 }]}>
                <View style={[styles.messageBubble, isMine ? styles.myMessage : styles.theirMessage, { marginBottom: 2 }]}>
                    <Text style={[styles.messageText, isMine ? styles.myMessageText : styles.theirMessageText]}>
                        {item.text}
                    </Text>
                </View>
                {isMine && (
                    <Text style={{ fontSize: 10, color: item.read ? '#1d9bf0' : '#71767b', marginRight: 5, fontWeight: 'bold' }}>
                        {item.read ? '• Seen' : '• Sent'}
                    </Text>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ChevronLeft size={28} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Chat</Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.headerIcon} onPress={async () => {
                        const otherId = otherUserData?.userId || otherUserData?.id;
                        if (!otherId) return alert("User data not loaded yet.");
                        
                        // 1. Record in chat history
                        await recordCallEvent('voice');

                        // 2. Signal via backend API
                        fetch(`${BASE_URL}/api/notify`, { 
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                toUserId: otherId,
                                title: "Incoming Voice Call",
                                body: `${user?.email || 'Someone'} is calling...`,
                                data: {
                                    type: 'call',
                                    callType: 'voice',
                                    conversationId: id,
                                    roomName: `twitter_clone_${id}`
                                }
                            })
                        }).catch(err => console.error("Notification error:", err));
                        
                        router.push(`/call/${id}?type=voice` as any);
                    }}>
                        <Phone size={22} color="#1d9bf0" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerIcon} onPress={async () => {
                        const otherId = otherUserData?.userId || otherUserData?.id;
                        if (!otherId) return alert("User data not loaded yet.");

                        // 1. Record in chat history
                        await recordCallEvent('video');

                        // 2. Signal via backend API
                        fetch(`${BASE_URL}/api/notify`, { 
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                toUserId: otherId,
                                title: "Incoming Video Call",
                                body: `${user?.email || 'Someone'} is video calling...`,
                                data: {
                                    type: 'call',
                                    callType: 'video',
                                    conversationId: id,
                                    roomName: `twitter_clone_${id}`
                                }
                            })
                        }).catch(err => console.error("Notification error:", err));

                        router.push(`/call/${id}?type=video` as any);
                    }}>
                        <Video size={24} color="#1d9bf0" />
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.messagesList}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
            >
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Start a message"
                        placeholderTextColor="#71767b"
                        value={newMessage}
                        onChangeText={setNewMessage}
                        multiline
                    />
                    <TouchableOpacity onPress={sendMessage} style={styles.sendButton} disabled={!newMessage.trim()}>
                        <Send size={20} color={newMessage.trim() ? "#1d9bf0" : "#71767b"} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderBottomWidth: 0.5,
        borderBottomColor: '#2f3336',
    },
    backButton: {
        marginRight: 15,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    messagesList: {
        padding: 15,
    },
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 20,
    },
    myMessage: {
        alignSelf: 'flex-end',
        backgroundColor: '#1d9bf0',
        borderBottomRightRadius: 2,
    },
    theirMessage: {
        alignSelf: 'flex-start',
        backgroundColor: '#2f3336',
        borderBottomLeftRadius: 2,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 20,
    },
    myMessageText: {
        color: '#fff',
    },
    theirMessageText: {
        color: '#fff',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        paddingHorizontal: 15,
        borderTopWidth: 0.5,
        borderTopColor: '#2f3336',
        backgroundColor: '#000',
    },
    input: {
        flex: 1,
        backgroundColor: '#16181c',
        color: '#fff',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 8,
        fontSize: 16,
        maxHeight: 100,
    },
    sendButton: {
        marginLeft: 10,
        padding: 5,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    headerIcon: {
        padding: 5,
    },
});
