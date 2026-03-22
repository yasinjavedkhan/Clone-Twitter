import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { auth } from '../../src/lib/firebase';

export default function CallScreen() {
    const { id, type } = useLocalSearchParams();
    const user = auth.currentUser;
    const router = useRouter();
    const roomName = `v1_TwitterClone_${id}`;
    
    // Construct Jitsi URL with advanced config overrides for a truly direct experience
    const displayName = user?.displayName || user?.email?.split('@')[0] || "User";
    const jitsiUrl = `https://meet.jit.si/${roomName}#config.prejoinPageEnabled=false&config.prejoinConfig.enabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=${type === 'voice' ? 'true' : 'false'}&userInfo.displayName="${encodeURIComponent(displayName)}"&config.disableDeepLinking=true&config.disableInviteFunctions=true&config.enableInsecureRoomNameWarning=false&config.enableWelcomePage=false&interfaceConfig.SHOW_JITSI_WATERMARK=false&interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false&interfaceConfig.DEFAULT_BACKGROUND='#000000'`;

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                    <X size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Active Call</Text>
            </View>
            <WebView
                source={{ uri: jitsiUrl }}
                style={{ flex: 1 }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                originWhitelist={['*']}
            />
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
        padding: 15,
        backgroundColor: '#000',
    },
    closeButton: {
        marginRight: 15,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
