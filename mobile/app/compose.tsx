import { StyleSheet, Text, View, TextInput, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Image as ImageIcon, Video, MapPin, Smile } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../src/lib/firebase';
import { uploadToCloudinary } from '../src/lib/cloudinary';

export default function ComposeScreen() {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<{ uri: string, type: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setMedia({ 
        uri: result.assets[0].uri, 
        type: result.assets[0].mimeType || 'image/jpeg' 
      });
    }
  };

  const handlePost = async () => {
    if (!content && !media) return;

    setLoading(true);
    try {
      let mediaUrl = '';
      if (media) {
        mediaUrl = await uploadToCloudinary(media.uri, media.type);
      }

      await addDoc(collection(db, "tweets"), {
        content,
        imageUrl: media?.type.startsWith('image/') ? mediaUrl : null,
        videoUrl: media?.type.startsWith('video/') ? mediaUrl : null,
        createdAt: serverTimestamp(),
        authorName: "Yasin Khan", // Mock for now
        authorUsername: "yasinjavedkhan",
        authorAvatar: "https://picsum.photos/seed/user/200/200",
        likesCount: 0,
      });

      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to post. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <X size={26} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.postButton, (!content && !media) && styles.disabledButton]} 
          onPress={handlePost}
          disabled={loading || (!content && !media)}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.inputContainer}>
          <Image 
            source={{ uri: 'https://picsum.photos/seed/user/200/200' }} 
            style={styles.miniAvatar} 
          />
          <TextInput
            style={styles.input}
            placeholder="Sharing something interesting?"
            placeholderTextColor="#71767b"
            multiline
            autoFocus
            value={content}
            onChangeText={setContent}
            maxLength={280}
          />
        </View>

        {media && (
          <View style={styles.mediaPreviewContainer}>
            <Image source={{ uri: media.uri }} style={styles.mediaPreview} />
            <TouchableOpacity style={styles.removeMedia} onPress={() => setMedia(null)}>
              <X size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Footer Tools */}
      <View style={styles.footer}>
        <View style={styles.tools}>
          <TouchableOpacity style={styles.toolButton} onPress={pickMedia}>
            <ImageIcon size={22} color="#1d9bf0" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolButton}>
            <Video size={22} color="#1d9bf0" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolButton}>
            <MapPin size={22} color="#1d9bf0" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolButton}>
            <Smile size={22} color="#1d9bf0" />
          </TouchableOpacity>
        </View>
        <Text style={[styles.charCount, content.length > 250 && {color: 'orange'}]}>
          {280 - content.length}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f071a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  postButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  disabledButton: {
    opacity: 0.5,
  },
  postButtonText: {
    color: '#0f071a',
    fontWeight: 'bold',
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  inputContainer: {
    flexDirection: 'row',
  },
  miniAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 18,
    paddingTop: 8,
    minHeight: 100,
  },
  mediaPreviewContainer: {
    marginTop: 20,
    borderRadius: 15,
    overflow: 'hidden',
    position: 'relative',
  },
  mediaPreview: {
    width: '100%',
    height: 300,
    borderRadius: 15,
  },
  removeMedia: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  tools: {
    flexDirection: 'row',
  },
  toolButton: {
    marginRight: 20,
  },
  charCount: {
    color: '#94a3b8',
    fontSize: 12,
  },
});
