import { StyleSheet, Text, View, TextInput, FlatList, TouchableOpacity, Image, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, TrendingUp } from 'lucide-react-native';
import { useState } from 'react';

const { width } = Dimensions.get('window');
const GRID_SIZE = width / 3;

export default function ExploreScreen() {
  const [activeCategory, setActiveCategory] = useState('For You');

  const categories = ['For You', 'Trending', 'News', 'Sports', 'Entertainment'];

  // Mock data for Instagram-style explore grid
  const mockMedia = Array(18).fill(0).map((_, i) => ({
    id: i.toString(),
    uri: `https://picsum.photos/seed/${i + 100}/400/400`,
    isLarge: i % 7 === 0 // Like IG, some items are double sized
  }));

  const renderGridItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={[
      styles.gridItem, 
      item.isLarge && styles.largeGridItem
    ]}>
      <Image source={{ uri: item.uri }} style={styles.gridImage} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Header */}
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Search size={18} color="#71767b" style={{ marginRight: 10 }} />
          <TextInput
            placeholder="Search JD"
            placeholderTextColor="#71767b"
            style={styles.searchInput}
          />
        </View>
      </View>

      {/* Category Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map((cat) => (
            <TouchableOpacity 
              key={cat} 
              style={[styles.tab, activeCategory === cat && styles.activeTab]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.tabText, activeCategory === cat && styles.activeTabText]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Explore Grid */}
      <FlatList
        data={mockMedia}
        renderItem={renderGridItem}
        keyExtractor={item => item.id}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.gridContainer}
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
    padding: 12,
    paddingBottom: 8,
  },
  searchBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  searchInput: {
    color: '#f8fafc',
    fontSize: 15,
    flex: 1,
  },
  tabsContainer: {
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#06b6d4',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#f8fafc',
  },
  gridContainer: {
    paddingTop: 1,
  },
  gridItem: {
    width: GRID_SIZE,
    height: GRID_SIZE,
    padding: 1,
  },
  largeGridItem: {
    // Note: numColumns=3 makes manual large items tricky in FlatList 
    // without custom layout. keeping it simple for now.
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
});
