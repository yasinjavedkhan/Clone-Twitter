import { StyleSheet, Text, View, FlatList, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, User, Repeat2, MessageCircle, FileText, Info, Shield, CheckCircle2, Bell } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { auth, db } from '../../src/lib/firebase';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by createdAt descending
      const sortedNotifs = notifs.sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      
      setNotifications(sortedNotifs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const renderNotification = ({ item }: { item: any }) => {
    const time = item.createdAt?.toDate ? formatDistanceToNow(item.createdAt.toDate()) : 'Now';
    
    let Icon = Bell;
    let iconColor = '#06b6d4';
    
    if (item.type === 'like') { Icon = Heart; iconColor = '#f43f5e'; }
    else if (item.type === 'follow') { Icon = User; iconColor = '#06b6d4'; }
    else if (item.type === 'post') { Icon = FileText; iconColor = '#06b6d4'; }
    else if (item.type === 'system') { Icon = Info; iconColor = '#06b6d4'; }
    else if (item.type === 'security') { Icon = Shield; iconColor = '#eab308'; }
    else if (item.type === 'success') { Icon = CheckCircle2; iconColor = '#22c55e'; }

    return (
      <TouchableOpacity 
        style={[styles.notificationItem, !item.read && styles.unreadItem]}
        onPress={() => !item.read && markAsRead(item.id)}
      >
        <View style={styles.iconContainer}>
          <Icon size={24} color={iconColor} />
        </View>
        
        <View style={styles.content}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.time}>{time} ago</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
      </View>
      {loading ? (
        <View style={styles.loader}>
          <Text style={{ color: '#94a3b8' }}>Loading...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No notifications yet.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  loader: {
    padding: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    textAlign: 'center',
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  unreadItem: {
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
  },
  iconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  title: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  message: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  time: {
    color: '#64748b',
    fontSize: 12,
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
