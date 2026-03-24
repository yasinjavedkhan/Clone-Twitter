import { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { auth } from '../../src/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Twitter } from 'lucide-react-native';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email.trim(), password);
            // Navigation is handled by RootLayout based on auth state
        } catch (error: any) {
            console.error(error);
            Alert.alert('Login Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.header}>
                        <Twitter size={40} color="#1d9bf0" />
                        <Text style={styles.title}>Log in to X</Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Email Address</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="vincenzo@example.com"
                                placeholderTextColor="#71767b"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Password</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your password"
                                placeholderTextColor="#71767b"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        <TouchableOpacity 
                            style={[styles.button, loading && styles.buttonDisabled]} 
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#000" />
                            ) : (
                                <Text style={styles.buttonText}>Log in</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Don't have an account? </Text>
                            <Link href={"/signup" as any} asChild>
                                <TouchableOpacity>
                                    <Text style={styles.footerLink}>Sign up</Text>
                                </TouchableOpacity>
                            </Link>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 30,
        paddingTop: 60,
        paddingBottom: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 50,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 20,
        textAlign: 'center',
    },
    form: {
        flex: 1,
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        color: '#1d9bf0',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#000',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 4,
        color: '#fff',
        padding: 12,
        fontSize: 16,
    },
    button: {
        backgroundColor: '#fff',
        borderRadius: 30,
        padding: 15,
        alignItems: 'center',
        marginTop: 20,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 40,
    },
    footerText: {
        color: '#71767b',
        fontSize: 14,
    },
    footerLink: {
        color: '#1d9bf0',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
