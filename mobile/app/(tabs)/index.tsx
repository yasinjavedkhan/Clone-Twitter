import { StyleSheet, Text, View, FlatList, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, MessageCircle, Repeat2, Heart, Share, Plus } from 'lucide-react-native';

export default function HomeScreen() {
  const [tweets, setTweets] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "tweets"), orderBy("createdAt", "desc"), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tweetsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTweets(tweetsData);
    });

    return () => unsubscribe();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    // Refresh logic here
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderTweet = ({ item }: { item: any }) => (
    <View style={styles.tweetContainer}>
      <View style={styles.avatarContainer}>
          <View style={styles.avatarPlaceholder}>
             {item.authorAvatar ? (
               <Image source={{ uri: item.authorAvatar }} style={styles.avatar} />
             ) : (
               <User size={24} color="#71767b" />
             )}
          </View>
      </View>
      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.displayName}>{item.authorName || "User"}</Text>
          <Text style={styles.username}>@{item.authorUsername || "username"}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.time}>1h</Text>
        </View>
        <Text style={styles.tweetText}>{item.content}</Text>
        
        <View style={styles.footer}>
          <TouchableOpacity style={styles.footerAction}>
            <MessageCircle size={18} color="#71767b" />
            <Text style={styles.footerText}>12</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerAction}>
            <Repeat2 size={18} color="#71767b" />
            <Text style={styles.footerText}>5</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerAction}>
            <Heart size={18} color="#71767b" />
            <Text style={styles.footerText}>{item.likesCount || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerAction}>
            <Share size={18} color="#71767b" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={tweets}
        renderItem={renderTweet}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      />
      <TouchableOpacity style={styles.fab}>
        <Plus size={30} color="#fff" strokeWidth={3} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  tweetContainer: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2f3336',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#16181c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  displayName: {
    color: '#fff',
    fontWeight: 'bold',
    marginRight: 5,
  },
  username: {
    color: '#71767b',
  },
  dot: {
    color: '#71767b',
    marginHorizontal: 4,
  },
  time: {
    color: '#71767b',
  },
  tweetText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 40,
  },
  footerAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    color: '#71767b',
    fontSize: 13,
    marginLeft: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1d9bf0',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});
