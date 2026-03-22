import { Tabs } from 'expo-router';
import { Home, Mail, User, Search, Bell } from 'lucide-react-native';
import { useColorScheme } from 'react-native';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../src/lib/firebase';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const qNotif = query(
          collection(db, "notifications"),
          where("userId", "==", user.uid),
          where("read", "==", false)
        );
        const unsubNotif = onSnapshot(qNotif, (snapshot) => {
          setUnreadCount(snapshot.size);
        });

        const qMessages = query(
            collection(db, "conversations"),
            where("participants", "array-contains", user.uid)
        );
        const unsubMessages = onSnapshot(qMessages, (snapshot) => {
            let count = 0;
            snapshot.docs.forEach((doc) => {
                const data = doc.data();
                if (data.unreadCount && data.unreadCount[user.uid]) {
                    count += data.unreadCount[user.uid];
                }
            });
            setUnreadMessages(count);
            console.log("MOBILE_DEBUG: Total unread messages count:", count);
        });

        return () => {
          unsubNotif();
          unsubMessages();
        };
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: '#ffffff',
      tabBarInactiveTintColor: '#71767b',
      tabBarStyle: {
        backgroundColor: '#000000',
        borderTopWidth: 0.5,
        borderTopColor: '#2f3336',
        height: 60,
        paddingBottom: 10,
        paddingTop: 5,
      },
      headerStyle: {
        backgroundColor: '#000000',
      },
      headerTitleStyle: {
        color: '#ffffff',
        fontWeight: 'bold',
      },
      headerShadowVisible: false,
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={26} color={color} />,
          headerTitle: 'Home',
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <Search size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color }) => <Bell size={26} color={color} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => <Mail size={26} color={color} />,
          tabBarBadge: unreadMessages > 0 ? unreadMessages : undefined,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User size={26} color={color} />,
          headerTitle: 'Profile',
        }}
      />
    </Tabs>
  );
}
