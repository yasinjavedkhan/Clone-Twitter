import { Tabs } from 'expo-router';
import { Home, Mail, User, Search, Bell } from 'lucide-react-native';
import { useColorScheme } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();

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
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => <Mail size={26} color={color} />,
        }}
      />
    </Tabs>
  );
}
