import { StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Modal, Image, Alert } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc, increment } from 'firebase/firestore';
import { db, auth } from '../../src/lib/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, ChevronLeft, Phone, Video, X, Mic, MicOff, VideoOff, Maximize2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { format, formatDistanceToNow } from 'date-fns';

// Configuration for API requests
const IS_PROD = true; // Set to false for local testing
const BASE_URL = IS_PROD ? "https://clone-twitter-fmya.vercel.app" : "http://10.0.2.2:3000";

export default function ChatDetailScreen() {
    const { id } = useLocalSearchParams();
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const user = auth.currentUser;
    const router = useRouter();
    const flatListRef = useRef<FlatList>(null);
    const [otherUserData, setOtherUserData] = useState<any>(null);

    // Force re-render frequently (3s) to keep presence text accurate
    const [, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick(prev => prev + 1), 3000);
        return () => clearInterval(timer);
    }, []);

    const isUserActive = (lastSeen: any) => {
        if (!lastSeen) return false;
        try {
            const date = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
            // 5-second threshold matches the 3-second mobile heartbeat
            return (Date.now() - date.getTime()) / 1000 < 5;
        } catch {
            return false;
        }
    };

    const formatLastSeenText = (lastSeen: any) => {
        if (!lastSeen) return "";
        try {
            const date = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
            const diffInSeconds = (Date.now() - date.getTime()) / 1000;
            if (diffInSeconds < 5) return "Active now";
            if (diffInSeconds < 60) return `Active ${Math.floor(diffInSeconds)}s ago`;
            return `Active ${formatDistanceToNow(date)} ago`;
        } catch {
            return "Active recently";
        }
    };

    // Fetch other user info for the call screen
    useEffect(() => {
        if (!id || !user) return;
        
        let unsubUser: any = null;

        const fetchOther = async () => {
            const convDoc = await getDoc(doc(db, "conversations", id as string));
            const participants = convDoc.data()?.participants || [];
            const otherId = participants.find((p: string) => p !== user.uid);
            if (otherId) {
                // Real-time listener for the other user's presence state
                unsubUser = onSnapshot(doc(db, "users", otherId), (snapshot) => {
                    if (snapshot.exists()) {
                        setOtherUserData({ userId: snapshot.id, ...snapshot.data() });
                    }
                });
            }
        };
        fetchOther();
        return () => unsubUser?.();
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

    const renderMessage = ({ item, index }: { item: any, index: number }) => {
        const isMine = item.senderId === user?.uid;
        const msgDate = item.createdAt?.toDate ? item.createdAt.toDate() : (item.createdAt instanceof Date ? item.createdAt : new Date());
        
        return (
            <View style={[{ alignItems: isMine ? 'flex-end' : 'flex-start', alignSelf: 'stretch', marginBottom: 12 }]}>
                <View style={[
                    styles.messageBubble, 
                    isMine ? styles.myMessage : styles.theirMessage,
                    item.type === 'call' && { backgroundColor: '#1d9bf020', borderWidth: 1, borderColor: '#1d9bf040', width: '90%' }
                ]}>
                    <Text style={[
                        styles.messageText, 
                        isMine ? styles.myMessageText : styles.theirMessageText,
                        item.type === 'call' && { color: '#1d9bf0', fontWeight: 'bold', fontSize: 17 }
                    ]}>
                        {item.text}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 4 }}>
                        <Text style={{ fontSize: 10, color: isMine ? 'rgba(255,255,255,0.7)' : '#71767b', fontWeight: '600' }}>
                            {format(msgDate, 'h:mm a')}
                        </Text>
                        {isMine && (
                            <Text style={{ fontSize: 10, color: item.read ? '#fff' : 'rgba(255,255,255,0.5)', fontWeight: 'bold' }}>
                                {item.read ? '✓✓' : '✓'}
                            </Text>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    const isOnline = isUserActive(otherUserData?.lastSeen);

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ChevronLeft size={28} color="#fff" />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.headerTitle}>{otherUserData?.displayName || otherUserData?.username || "Chat"}</Text>
                        {otherUserData?.lastSeen && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isOnline ? '#22c55e' : '#71767b' }} />
                                <Text style={{ color: isOnline ? '#22c55e' : '#71767b', fontSize: 11, fontWeight: isOnline ? '600' : '400' }}>
                                    {formatLastSeenText(otherUserData.lastSeen)}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity 
                      style={[styles.headerIcon, !isOnline && { opacity: 0.3 }]} 
                      onPress={async () => {
                        const otherId = otherUserData?.userId || otherUserData?.id;
                        if (!otherId) return;
                        
                        // Restriction: Block call if offline
                        if (!isOnline) {
                            return Alert.alert("User Offline", `${otherUserData?.displayName || 'User'} is offline. You can only call active users.`);
                        }

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
                    <TouchableOpacity 
                      style={[styles.headerIcon, !isOnline && { opacity: 0.3 }]} 
                      onPress={async () => {
                        const otherId = otherUserData?.userId || otherUserData?.id;
                        if (!otherId) return;

                        // Restriction: Block call if offline
                        if (!isOnline) {
                            return Alert.alert("User Offline", `${otherUserData?.displayName || 'User'} is offline. You can only call active users.`);
                        }

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
        backgroundColor: '#000000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        backgroundColor: '#000000',
    },
    backButton: {
        marginRight: 12,
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 19,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    messagesList: {
        padding: 16,
        paddingBottom: 32,
    },
    messageBubble: {
        maxWidth: '85%',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 22,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    myMessage: {
        alignSelf: 'flex-end',
        backgroundColor: '#1d9bf0',
        borderBottomRightRadius: 4,
    },
    theirMessage: {
        alignSelf: 'flex-start',
        backgroundColor: '#16181c',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
        fontWeight: '500',
    },
    myMessageText: {
        color: '#ffffff',
    },
    theirMessageText: {
        color: '#f8f9f9',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        paddingHorizontal: 16,
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(255,255,255,0.1)',
        backgroundColor: '#000000',
    },
    input: {
        flex: 1,
        backgroundColor: '#16181c',
        color: '#ffffff',
        borderRadius: 24,
        paddingHorizontal: 18,
        paddingVertical: 10,
        fontSize: 16,
        maxHeight: 120,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    sendButton: {
        marginLeft: 12,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(29, 155, 240, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 18,
    },
    headerIcon: {
        padding: 6,
    },
});
