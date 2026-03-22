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
      tabBarActiveTintColor: '#f472b6',
      tabBarInactiveTintColor: '#94a3b8',
      tabBarStyle: {
        backgroundColor: '#0f071a',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.05)',
        height: 60,
        paddingBottom: 10,
        paddingTop: 5,
      },
      headerStyle: {
        backgroundColor: '#0f071a',
      },
      headerTitleStyle: {
        color: '#f8fafc',
        fontWeight: 'bold',
        fontSize: 18,
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
