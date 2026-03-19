import { StyleSheet, Text, View, FlatList, TouchableOpacity, RefreshControl, Image, ScrollView, Dimensions } from 'react-native';
import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, MessageCircle, Repeat2, Heart, Share, Plus, Image as ImageIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();
  const [tweets, setTweets] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Mock Stories Data (Instagram Style)
  const stories = [
    { id: '1', name: 'Your Story', avatar: 'https://picsum.photos/seed/you/200/200', isMe: true },
    { id: '2', name: 'alex.dev', avatar: 'https://picsum.photos/seed/a/200/200' },
    { id: '3', name: 'sarah_m', avatar: 'https://picsum.photos/seed/b/200/200' },
    { id: '4', name: 'tech_guru', avatar: 'https://picsum.photos/seed/c/200/200' },
    { id: '5', name: 'nature_pix', avatar: 'https://picsum.photos/seed/d/200/200' },
    { id: '6', name: 'pixel_artist', avatar: 'https://picsum.photos/seed/e/200/200' },
  ];

  const renderStories = () => (
    <View style={styles.storiesContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {stories.map(story => (
          <View key={story.id} style={styles.storyItem}>
            <View style={[styles.storyRing, story.isMe && styles.myStoryRing]}>
              <View style={styles.storyAvatarContainer}>
                <Image source={{ uri: story.avatar }} style={styles.storyAvatar} />
              </View>
              {story.isMe && (
                <View style={styles.addStoryBadge}>
                  <Plus size={12} color="#fff" strokeWidth={4} />
                </View>
              )}
            </View>
            <Text style={styles.storyName} numberOfLines={1}>{story.name}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerWrapper}>
      <TouchableOpacity style={styles.quickInputContainer} onPress={() => router.push('/compose')}>
        <Image source={{ uri: 'https://picsum.photos/seed/you/200/200' }} style={styles.miniAvatar} />
        <View style={styles.quickInput}>
          <Text style={styles.quickInputText}>What's on your mind?</Text>
        </View>
        <ImageIcon size={24} color="#1d9bf0" />
      </TouchableOpacity>
      {renderStories()}
    </View>
  );

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
      {/* Header with User Info */}
      <View style={styles.tweetHeader}>
        <View style={styles.userInfo}>
          <View style={styles.avatarPlaceholder}>
             {item.authorAvatar ? (
               <Image source={{ uri: item.authorAvatar }} style={styles.avatar} />
             ) : (
               <User size={24} color="#71767b" />
             )}
          </View>
          <View style={styles.nameContainer}>
            <Text style={styles.displayName}>{item.authorName || "User"}</Text>
            <Text style={styles.username}>@{item.authorUsername || "username"}</Text>
          </View>
        </View>
        <TouchableOpacity>
          <Text style={styles.dot}>···</Text>
        </TouchableOpacity>
      </View>

      {/* Content Text */}
      <View style={styles.contentPadding}>
        <Text style={styles.tweetText}>{item.content}</Text>
      </View>

      {/* Media Content (Instagram Style) */}
      {(item.imageUrl || item.image) && (
        <View style={styles.mediaContainer}>
          <Image 
            source={{ uri: item.imageUrl || item.image }} 
            style={styles.mainMedia} 
            resizeMode="cover"
          />
        </View>
      )}

      {/* Footer Actions */}
      <View style={styles.footer}>
        <View style={styles.leftActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Heart size={22} color={item.isLiked ? "#f91880" : "#fff"} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <MessageCircle size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Repeat2 size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.actionButton}>
          <Share size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Likes Count */}
      <View style={styles.likesPadding}>
        <Text style={styles.likesCountText}>{item.likesCount || 0} likes</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={tweets}
        renderItem={renderTweet}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      />
      <TouchableOpacity 
        style={styles.fab} 
        activeOpacity={0.8}
        onPress={() => router.push('/compose')}
      >
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
    marginBottom: 20,
    backgroundColor: '#000',
  },
  tweetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameContainer: {
    marginLeft: 12,
  },
  displayName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  username: {
    color: '#71767b',
    fontSize: 13,
  },
  avatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#16181c',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: 38,
    height: 38,
  },
  contentPadding: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  tweetText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
  },
  mediaContainer: {
    width: '100%',
    aspectRatio: 1, // Instagram style 1:1
    backgroundColor: '#16181c',
  },
  mainMedia: {
    width: '100%',
    height: '100%',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginRight: 16,
  },
  likesPadding: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  likesCountText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  dot: {
    color: '#71767b',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerWrapper: {
    backgroundColor: '#000',
  },
  quickInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2f3336',
  },
  miniAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  quickInput: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#333',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  quickInputText: {
    color: '#71767b',
    fontSize: 14,
  },
  storiesContainer: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2f3336',
    backgroundColor: '#000',
  },
  storyItem: {
    alignItems: 'center',
    marginHorizontal: 10,
    width: 68,
  },
  storyRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2,
    borderWidth: 2,
    borderColor: '#e91e63', // Instagram-like pink/orange ring
    marginBottom: 6,
    position: 'relative',
  },
  myStoryRing: {
    borderColor: '#444', // My story has a different or no ring
  },
  storyAvatarContainer: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#16181c',
  },
  storyAvatar: {
    width: '100%',
    height: '100%',
  },
  storyName: {
    color: '#fff',
    fontSize: 11,
    textAlign: 'center',
  },
  addStoryBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#1d9bf0',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1d9bf0',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#1d9bf0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
});
