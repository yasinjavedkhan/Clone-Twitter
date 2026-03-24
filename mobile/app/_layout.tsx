import { Stack, useRouter, useSegments } from 'expo-router';
import { View, Platform, ActivityIndicator } from 'react-native';
import IncomingCallOverlay from '../src/components/IncomingCallOverlay';
import * as Notifications from 'expo-notifications';
import { auth, db } from '../src/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_700Bold,
  });

  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const segments = useSegments();

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Handle user state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (initializing) setInitializing(false);
    });
    return unsubscribe;
  }, []);

  // Handle navigation based on auth state
  useEffect(() => {
    if (initializing || !fontsLoaded) return;

    const inAuthGroup = (segments[0] as string) === '(auth)';

    if (!user && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/login' as any);
    } else if (user && inAuthGroup) {
      // Redirect to home if authenticated
      router.replace('/(tabs)' as any);
    }
  }, [user, initializing, segments, fontsLoaded]);

  useEffect(() => {
    async function registerForPushNotificationsAsync() {
      if (Platform.OS === 'web') return;
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      if (auth.currentUser) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
          fcmToken: token,
          fcmTokenUpdated: new Date(),
        }).catch(err => console.error("Error updating push token:", err));
      }
    }

    if (user) {
      registerForPushNotificationsAsync();
    }
  }, [user]);

  if (!fontsLoaded || initializing) {
    return (
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#1d9bf0" />
        </View>
    );
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
      <IncomingCallOverlay />
    </View>
  );
}
