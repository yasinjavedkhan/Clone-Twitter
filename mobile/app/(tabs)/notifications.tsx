import { StyleSheet, Text, View, FlatList, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, User, Repeat2, MessageCircle } from 'lucide-react-native';

export default function NotificationsScreen() {
  const notifications = [
    { 
      id: '1', 
      type: 'like', 
      user: 'alex.dev', 
      avatar: 'https://picsum.photos/seed/a/200/200',
      text: 'liked your photo',
      time: '2h',
      media: 'https://picsum.photos/seed/post1/200/200'
    },
    { 
      id: '2', 
      type: 'follow', 
      user: 'sarah_m', 
      avatar: 'https://picsum.photos/seed/b/200/200',
      text: 'started following you',
      time: '5h',
      isFollowing: false
    },
    { 
      id: '3', 
      type: 'comment', 
      user: 'tech_guru', 
      avatar: 'https://picsum.photos/seed/c/200/200',
      text: 'commented: "This looks amazing! 🔥"',
      time: '1d',
      media: 'https://picsum.photos/seed/post2/200/200'
    },
  ];

  const renderNotification = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity style={styles.notificationItem}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        
        <View style={styles.content}>
          <Text style={styles.notificationText}>
            <Text style={styles.username}>{item.user}</Text> {item.text} <Text style={styles.time}>{item.time}</Text>
          </Text>
        </View>

        {item.type === 'follow' ? (
          <TouchableOpacity style={[styles.actionButton, item.isFollowing && styles.followingButton]}>
            <Text style={styles.actionButtonText}>
              {item.isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        ) : item.media ? (
          <Image source={{ uri: item.media }} style={styles.mediaThumbnail} />
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
      </View>
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  header: {
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: 'bold',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  notificationText: {
    color: '#f1f5f9',
    fontSize: 14,
    lineHeight: 18,
  },
  username: {
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  time: {
    color: '#94a3b8',
  },
  mediaThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  actionButton: {
    backgroundColor: '#06b6d4',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  followingButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
