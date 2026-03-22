import { StyleSheet, Text, View, FlatList, Image, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings, Grid, Bookmark, MapPin, Calendar, Link as LinkIcon } from 'lucide-react-native';
import { useState } from 'react';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = width / 3;

export default function ProfileScreen() {
  const [activeTab, setActiveTab] = useState('posts');

  // Mock data for Instagram-style grid
  const mockPosts = Array(12).fill(0).map((_, i) => ({
    id: i.toString(),
    uri: `https://picsum.photos/seed/${i + 50}/400/400`
  }));

  const renderGridItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.gridItem}>
      <Image source={{ uri: item.uri }} style={styles.gridImage} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatarPlaceholder}>
                <Image 
                  source={{ uri: 'https://picsum.photos/seed/user/200/200' }} 
                  style={styles.avatar} 
                />
              </View>
            </View>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>12</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>1.2k</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>450</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
            </View>
          </View>

          <View style={styles.bioContainer}>
            <Text style={styles.displayName}>Yasin Khan</Text>
            <Text style={styles.username}>@yasinjavedkhan</Text>
            <Text style={styles.bio}>
              Building the future of social media. 🚀
              React Native | Next.js | UI/UX Enthusiast
            </Text>
            
            <View style={styles.locationContainer}>
              <MapPin size={14} color="#71767b" />
              <Text style={styles.locationText}>Pakistan</Text>
              <LinkIcon size={14} color="#1d9bf0" style={{marginLeft: 10}} />
              <Text style={styles.linkText}>yasin.dev</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.editButton}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Selection */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'posts' && styles.activeTabBorder]} 
            onPress={() => setActiveTab('posts')}
          >
            <Grid size={24} color={activeTab === 'posts' ? '#fff' : '#71767b'} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'likes' && styles.activeTabBorder]} 
            onPress={() => setActiveTab('likes')}
          >
            <Bookmark size={24} color={activeTab === 'likes' ? '#fff' : '#71767b'} />
          </TouchableOpacity>
        </View>

        {/* Posts Grid */}
        <FlatList
          data={mockPosts}
          renderItem={renderGridItem}
          keyExtractor={item => item.id}
          numColumns={3}
          scrollEnabled={false}
          contentContainerStyle={styles.gridContainer}
        />
      </ScrollView>
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
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    flex: 1,
  },
  avatarPlaceholder: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  statsContainer: {
    flex: 3,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 13,
  },
  bioContainer: {
    marginBottom: 16,
  },
  displayName: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
  },
  username: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 8,
  },
  bio: {
    color: '#f1f5f9',
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 12,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    color: '#94a3b8',
    fontSize: 14,
    marginLeft: 4,
  },
  linkText: {
    color: '#06b6d4',
    fontSize: 14,
    marginLeft: 4,
  },
  editButton: {
    width: '100%',
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  editButtonText: {
    color: '#f8fafc',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    marginTop: 10,
  },
  tab: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabBorder: {
    borderBottomWidth: 2,
    borderBottomColor: '#06b6d4',
  },
  gridContainer: {
    paddingTop: 2,
  },
  gridItem: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH,
    padding: 1,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
});
