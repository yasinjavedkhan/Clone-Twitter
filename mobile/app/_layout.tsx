import { Stack } from 'expo-router';
import { View, Platform, AppState } from 'react-native';
import IncomingCallOverlay from '../src/components/IncomingCallOverlay';
import * as Notifications from 'expo-notifications';
import { auth, db } from '../src/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useCallback, useEffect, useRef } from 'react';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const appState = useRef(AppState.currentState);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Presence Heartbeat (Mobile)
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (!user) return;

      const updateLastSeen = async () => {
        if (appState.current === 'active') {
          await updateDoc(doc(db, "users", user.uid), {
            lastSeen: serverTimestamp()
          }).catch(() => {});
        }
      };

      // Initial update
      updateLastSeen();

      // 3-second heartbeat for hyper-responsive presence
      const interval = setInterval(updateLastSeen, 3000);

      // Listen for app coming to foreground
      const subscription = AppState.addEventListener('change', nextAppState => {
        appState.current = nextAppState;
        if (appState.current === 'active') {
          updateLastSeen();
        }
      });

      return () => {
        clearInterval(interval);
        subscription.remove();
      };
    });

    return () => unsubAuth();
  }, []);

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
      
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#06b6d4',
        });
      }
      
      // Use getDevicePushTokenAsync to get the native FCM token for Firebase Admin/Messaging
      const token = (await Notifications.getDevicePushTokenAsync()).data;
      console.log("Mobile FCM Token acquired:", token.substring(0, 10) + "...");
      
      if (auth.currentUser) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
          fcmToken: token,
          fcmTokenUpdated: new Date(),
        });
      }
    }

    registerForPushNotificationsAsync();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
      <IncomingCallOverlay />
    </View>
  );
}
