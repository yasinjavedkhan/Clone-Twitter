import { StyleSheet, Text, View, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Heart, User, Repeat2 } from 'lucide-react-native';

export default function NotificationsScreen() {
  const notifications = [
    { id: '1', type: 'like', text: 'Yasin Khan liked your post' },
    { id: '2', type: 'follow', text: 'Maaz Khan followed you' },
    { id: '3', type: 'retweet', text: 'Someone reposted your post' },
  ];

  const renderNotification = ({ item }: { item: any }) => {
    let Icon = Bell;
    let iconColor = "#fff";

    if (item.type === 'like') { Icon = Heart; iconColor = "#f91880"; }
    else if (item.type === 'follow') { Icon = User; iconColor = "#1d9bf0"; }
    else if (item.type === 'retweet') { Icon = Repeat2; iconColor = "#00ba7c"; }

    return (
      <View style={styles.notificationItem}>
        <View style={styles.iconContainer}>
          <Icon size={24} color={iconColor} fill={item.type === 'like' ? iconColor : "transparent"} />
        </View>
        <View style={styles.content}>
          <View style={styles.avatarPlaceholder} />
          <Text style={styles.notificationText}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={item => item.id}
        ListHeaderComponent={<Text style={styles.headerTitle}>Notifications</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    padding: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2f3336',
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2f3336',
  },
  iconContainer: {
    paddingLeft: 30,
    paddingRight: 10,
    paddingTop: 5,
  },
  content: {
    flex: 1,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#16181c',
    marginBottom: 8,
  },
  notificationText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
  },
});
