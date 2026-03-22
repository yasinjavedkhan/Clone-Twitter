import { StyleSheet, Text, View, FlatList, TouchableOpacity, RefreshControl, Image, ScrollView, Dimensions, PanResponder } from 'react-native';
import { useState, useEffect, useRef, useMemo } from 'react';
import { auth, db } from '../../src/lib/firebase';
import { doc, getDoc, collection, query, orderBy, limit, onSnapshot, getDocs, where } from 'firebase/firestore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, MessageCircle, Repeat2, Heart, Share, Plus, Image as ImageIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();
  const [allTweets, setAllTweets] = useState<any[]>([]);
  const [followingTweets, setFollowingTweets] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'foryou' | 'following'>('foryou');
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const { width: screenWidth } = Dimensions.get('window');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } else {
        setUserData(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Following IDs
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "follows"), where("followerId", "==", auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = snapshot.docs.map(doc => doc.data().followingId);
      setFollowingIds(ids);
    });
    return () => unsubscribe();
  }, []);

  // Fetch "For You" Tweets (All)
  useEffect(() => {
    const q = query(collection(db, "tweets"), orderBy("createdAt", "desc"), limit(30));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tweetsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllTweets(tweetsData);
    });
    return () => unsubscribe();
  }, []);

  // Fetch "Following" Tweets
  useEffect(() => {
    if (followingIds.length === 0) {
      setFollowingTweets([]);
      return;
    }
    // Firestore "in" query limited to 30 ids
    const batchIds = followingIds.slice(0, 30);
    const q = query(
      collection(db, "tweets"), 
      where("userId", "in", batchIds),
      orderBy("createdAt", "desc"), 
      limit(30)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tweetsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setFollowingTweets(tweetsData);
    });
    return () => unsubscribe();
  }, [followingIds]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleTabPress = (tab: 'foryou' | 'following') => {
    setActiveTab(tab);
  };

  // PanResponder for swipe gesture
  const panResponder = useMemo(() => PanResponder.create({
    // Capture phase: intercept BEFORE FlatList can respond
    onMoveShouldSetPanResponderCapture: (_, gestureState) => {
      const { dx, dy } = gestureState;
      // Only take over if clearly horizontal (dx much bigger than dy)
      return Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 3;
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx < -50) {
        // Swipe Left -> For You
        setActiveTab('foryou');
      } else if (gestureState.dx > 50) {
        // Swipe Right -> Following
        setActiveTab('following');
      }
    },
  }), []);

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity 
        style={styles.tabItem} 
        onPress={() => handleTabPress('foryou')}
      >
        <Text style={[styles.tabText, activeTab === 'foryou' && styles.activeTabText]}>For You</Text>
        {activeTab === 'foryou' && <View style={styles.tabUnderline} />}
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.tabItem} 
        onPress={() => handleTabPress('following')}
      >
        <Text style={[styles.tabText, activeTab === 'following' && styles.activeTabText]}>Following</Text>
        {activeTab === 'following' && <View style={styles.tabUnderline} />}
      </TouchableOpacity>
    </View>
  );

  const TweetItem = ({ item }: { item: any }) => {
    const [canReply, setCanReply] = useState(true);
    const [canSee, setCanSee] = useState(true);
    const [isChecking, setIsChecking] = useState(false);
    const [replyError, setReplyError] = useState<string | null>(null);
    const currentUserId = auth.currentUser?.uid;

    useEffect(() => {
      const checkPermissions = async () => {
        if (!item.replySetting || item.replySetting === 'everyone') {
          setCanReply(true);
          setCanSee(true);
          return;
        }
        if (item.userId === currentUserId) {
          setCanReply(true);
          setCanSee(true);
          return;
        }
        setIsChecking(true);
        try {
          if (item.replySetting === 'following') {
            const q1 = query(collection(db, "follows"), where("followerId", "==", item.userId), where("followingId", "==", currentUserId || ""));
            const q2 = query(collection(db, "follows"), where("followerId", "==", currentUserId || ""), where("followingId", "==", item.userId));
            const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
            const authorFollowsMe = !snap1.empty;
            const iFollowAuthor = !snap2.empty;
            setCanSee(authorFollowsMe || iFollowAuthor);
            setCanReply(authorFollowsMe);
            if (!authorFollowsMe) setReplyError("The author only allows people they follow to reply.");
          } else if (item.replySetting === 'followers') {
            const q = query(collection(db, "follows"), where("followerId", "==", currentUserId || ""), where("followingId", "==", item.userId));
            const snap = await getDocs(q);
            const iFollowAuthor = !snap.empty;
            setCanSee(iFollowAuthor);
            setCanReply(iFollowAuthor);
            if (!iFollowAuthor) setReplyError("Only followers of the author can reply.");
          } else if (item.replySetting === 'mentions') {
            if (userData?.username) {
              const username = userData.username.toLowerCase();
              const content = item.content.toLowerCase();
              const isMentioned = new RegExp(`@${username}\\b`).test(content);
              setCanReply(isMentioned);
              setCanSee(isMentioned);
              if (!isMentioned) setReplyError("Only people mentioned by the author can reply.");
            } else {
              setCanReply(false);
              setCanSee(false);
            }
          }
        } catch (e) {
          console.error(e);
          setCanSee(false);
        } finally {
          setIsChecking(false);
        }
      };
      checkPermissions();
    }, [item.id, item.replySetting, item.userId, currentUserId, userData?.username]);

    if (!canSee) return null;

    return (
      <View style={styles.tweetContainer}>
        <View style={styles.tweetHeader}>
          <TouchableOpacity 
            style={styles.userInfo}
            onPress={() => router.push({ pathname: '/profile', params: { id: item.userId } } as any)}
          >
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
          </TouchableOpacity>
        </View>
        <View style={styles.contentPadding}>
          <Text style={styles.tweetText}>{item.content}</Text>
        </View>
        {(item.imageUrl || item.image) && (
          <View style={styles.mediaContainer}>
            <Image source={{ uri: item.imageUrl || item.image }} style={styles.mainMedia} resizeMode="cover" />
          </View>
        )}
        <View style={styles.footer}>
          <View style={styles.leftActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Heart size={22} color={item.isLiked ? "#f91880" : "#fff"} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, !canReply && { opacity: 0.3 }]}
              onPress={() => !canReply && alert(replyError || "You cannot reply.")}
            >
              <MessageCircle size={22} color={canReply ? "#fff" : "#444"} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Repeat2 size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

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
      <View style={styles.quickInputContainer}>
        <TouchableOpacity onPress={() => router.push('/profile')}>
          {userData?.profileImage ? (
            <Image source={{ uri: userData.profileImage }} style={styles.miniAvatar} />
          ) : (
            <View style={[styles.miniAvatar, { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }]}>
              <User size={20} color="#71767b" />
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickInput} onPress={() => router.push('/compose' as any)}>
          <Text style={styles.quickInputText}>What's on your mind?</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/compose' as any)}>
          <ImageIcon size={24} color="#06b6d4" />
        </TouchableOpacity>
      </View>
      {renderStories()}
    </View>
  );

  const stories = [
    { id: '1', name: 'Your Story', avatar: 'https://picsum.photos/seed/you/200/200', isMe: true },
    { id: '2', name: 'alex.dev', avatar: 'https://picsum.photos/seed/a/200/200' },
    { id: '3', name: 'sarah_m', avatar: 'https://picsum.photos/seed/b/200/200' },
    { id: '4', name: 'tech_guru', avatar: 'https://picsum.photos/seed/c/200/200' },
    { id: '5', name: 'nature_pix', avatar: 'https://picsum.photos/seed/d/200/200' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Fixed Tab Header */}
      <View style={styles.fixedHeader}>
        <View style={styles.navRow}>
          <TouchableOpacity onPress={() => router.push('/profile')}>
            <View style={styles.smallAvatarPlaceholder}>
              {userData?.profileImage ? (
                <Image source={{ uri: userData.profileImage }} style={styles.smallAvatar} />
              ) : (
                <User size={18} color="#94a3b8" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.logoText}>JD</Text>
          <View style={{ width: 32 }} />
        </View>
        {renderTabBar()}
      </View>

      {/* Swipeable Feed Area */}
      <View style={styles.horizontalPager} {...panResponder.panHandlers}>
        {activeTab === 'foryou' ? (
          <FlatList
            data={allTweets}
            renderItem={({ item }) => <TweetItem item={item} />}
            keyExtractor={item => `foryou-${item.id}`}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={renderHeader}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#06b6d4" />}
          />
        ) : (
          <FlatList
            data={followingTweets}
            renderItem={({ item }) => <TweetItem item={item} />}
            keyExtractor={item => `following-${item.id}`}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No posts yet</Text>
                <Text style={styles.emptySubtitle}>Follow some people to see their posts here!</Text>
              </View>
            }
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#06b6d4" />}
          />
        )}
      </View>

      <TouchableOpacity 
        style={styles.fab} 
        activeOpacity={0.8}
        onPress={() => router.push('/compose' as any)}
      >
        <Plus size={30} color="#fff" strokeWidth={3} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  tweetContainer: {
    marginBottom: 8,
    backgroundColor: '#020617',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
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
    color: '#f8fafc',
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
    color: '#f8fafc',
    fontWeight: 'bold',
    fontSize: 14,
  },
  dot: {
    color: '#71767b',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerWrapper: {
    backgroundColor: '#020617',
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
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
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
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: '#020617',
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
    borderColor: '#06b6d4', // Cyan ring
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
    backgroundColor: '#06b6d4',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#020617',
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
    backgroundColor: '#06b6d4',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  fixedHeader: {
    backgroundColor: '#020617',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  logoText: {
    color: '#06b6d4',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
  },
  smallAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  smallAvatar: {
    width: 32,
    height: 32,
  },
  tabBar: {
    flexDirection: 'row',
    height: 48,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#f8fafc',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    width: 60,
    height: 4,
    backgroundColor: '#06b6d4',
    borderRadius: 2,
  },
  horizontalPager: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 100,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },
});
