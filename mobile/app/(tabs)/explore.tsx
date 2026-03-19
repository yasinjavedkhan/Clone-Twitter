import { StyleSheet, Text, View, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';

export default function ExploreScreen() {
  return (
    <SafeAreaView style={styles.container}>
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
      <View style={styles.content}>
        <Text style={styles.title}>What's happening</Text>
        <View style={styles.trendingItem}>
            <Text style={styles.trendingCategory}>Trending in India</Text>
            <Text style={styles.trendingName}>#TwitterMobile</Text>
            <Text style={styles.trendingCount}>10.5K posts</Text>
        </View>
        <View style={styles.trendingItem}>
            <Text style={styles.trendingCategory}>Technology · Trending</Text>
            <Text style={styles.trendingName}>React Native</Text>
            <Text style={styles.trendingCount}>5,234 posts</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2f3336',
  },
  searchBar: {
    backgroundColor: '#16181c',
    borderRadius: 25,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  searchInput: {
    color: '#fff',
    fontSize: 15,
    flex: 1,
  },
  content: {
    padding: 15,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  trendingItem: {
    marginBottom: 20,
  },
  trendingCategory: {
    color: '#71767b',
    fontSize: 13,
    marginBottom: 2,
  },
  trendingName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  trendingCount: {
    color: '#71767b',
    fontSize: 13,
  },
});
