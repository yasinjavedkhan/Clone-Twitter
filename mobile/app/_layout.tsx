import { Stack } from 'expo-router';
import { View, Platform } from 'react-native';
import IncomingCallOverlay from '../src/components/IncomingCallOverlay';
import * as Notifications from 'expo-notifications';
import { auth, db } from '../src/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useCallback, useEffect } from 'react';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

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
