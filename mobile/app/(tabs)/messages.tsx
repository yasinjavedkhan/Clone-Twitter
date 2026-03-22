import { StyleSheet, Text, View, FlatList, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth } from '../../src/lib/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Search, User } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<any[]>([]);
  const user = auth.currentUser;
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", user.uid),
      orderBy("lastTimestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setConversations(convs);
    });

    return () => unsubscribe();
  }, [user]);

  const renderConversation = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.convContainer}
      onPress={() => router.push(`/chat/${item.id}`)}
    >
      <View style={styles.avatarPlaceholder}>
        <User size={24} color="#71767b" />
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name}>{item.otherUserName || "User"}</Text>
          <Text style={styles.time}>{item.lastTimestamp ? "2h" : ""}</Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage || "Start a new conversation"}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={18} color="#71767b" style={{ marginRight: 10 }} />
          <Text style={{ color: '#71767b' }}>Search messages</Text>
        </View>
      </View>
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={item => item.id}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Welcome to your inbox!</Text>
            <Text style={styles.emptySubtitle}>Drop a message to anyone on JD and start chatting.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  searchContainer: {
    padding: 15,
  },
  searchBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  convContainer: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  name: {
    color: '#f8fafc',
    fontWeight: 'bold',
  },
  time: {
    color: '#94a3b8',
    fontSize: 13,
  },
  lastMessage: {
    color: '#94a3b8',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'center',
  },
});
