"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, getDocs, where, limit, startAfter } from "firebase/firestore";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Button } from "@/components/ui/Button";
import Tweet from "@/components/tweet/Tweet";
import { Image, List, Smile, Calendar, MapPin, Globe, X, User, Users } from "lucide-react";
import { useRef } from "react";
import Avatar from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

// Lazy-load the heavy emoji picker
const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

export default function Home() {
  const router = useRouter();
  const { user, userData, signInWithGoogle } = useAuth();
  const [content, setContent] = useState("");
  const [isTweeting, setIsTweeting] = useState(false);
  const [tweets, setTweets] = useState<any[]>([]);
  const [mediaFiles, setMediaFiles] = useState<{ file: File; type: 'image' | 'video'; preview: string }[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replySetting, setReplySetting] = useState<'everyone' | 'following' | 'mentions' | 'followers'>('everyone');
  const [showReplySettings, setShowReplySettings] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [tweetLocation, setTweetLocation] = useState<string | null>(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [activeTab, setActiveTab] = useState<'foryou' | 'following'>('foryou');
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const lastScrollY = useRef<number>(0);

  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);

  useEffect(() => {
    // Initial fetch of 15 tweets
    const q = query(collection(db, "tweets"), orderBy("createdAt", "desc"), limit(15));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tweetsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTweets(tweetsData);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === 15);
    });

    return () => unsubscribe();
  }, []);

  const loadMoreTweets = async () => {
    if (!lastDoc || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, "tweets"), 
        orderBy("createdAt", "desc"), 
        startAfter(lastDoc), 
        limit(15)
      );
      const snapshot = await getDocs(q);
      const moreTweets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      if (moreTweets.length > 0) {
        setTweets(prev => [...prev, ...moreTweets]);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === 15);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Error loading more tweets:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const fetchFollowing = async () => {
      if (!user) return;
      const followsRef = collection(db, "follows");
      const qFollows = query(followsRef, where("followerId", "==", user.uid));
      const followSnapshot = await getDocs(qFollows);
      const ids = followSnapshot.docs.map(doc => doc.data().followingId);
      setFollowingIds(ids);
    };
    fetchFollowing();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          
          if (currentScrollY > 50) {
            // Scrolling down with a threshold of 10px
            if (currentScrollY > lastScrollY.current + 10) {
              setIsHeaderVisible(false);
            } 
            // Scrolling up with a threshold of 10px
            else if (currentScrollY < lastScrollY.current - 10) {
              setIsHeaderVisible(true);
            }
          } else {
            // Always show at the very top
            setIsHeaderVisible(true);
          }
          
          // Only update lastScrollY if we passed a threshold, this makes the scroll logic much cleaner
          if (Math.abs(currentScrollY - lastScrollY.current) > 10) {
            lastScrollY.current = currentScrollY;
          }
          
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const onEmojiClick = (emojiData: any) => {
    setContent((prev) => prev + emojiData.emoji);
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limit to 4 items (Twitter standard)
    const newFiles = files.slice(0, 4 - mediaFiles.length);
    
    newFiles.forEach(file => {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaFiles(prev => [...prev, {
          file,
          type,
          preview: reader.result as string
        }]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleLocation = () => {
    if (tweetLocation) {
        setTweetLocation(null);
        return;
    }
    setIsFetchingLocation(true);
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    setTweetLocation(`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
                } catch (error) {
                    console.error("Error getting location:", error);
                    alert("Could not fetch location.");
                } finally {
                    setIsFetchingLocation(false);
                }
            },
            (error) => {
                console.error("Geolocation error:", error);
                alert("Location access denied.");
                setIsFetchingLocation(false);
            }
        );
    } else {
        alert("Geolocation not supported.");
        setIsFetchingLocation(false);
    }
  };

  const addPollOption = () => {
      if (pollOptions.length < 4) {
          setPollOptions([...pollOptions, ""]);
      }
  };

  const removePollOption = (index: number) => {
      if (pollOptions.length > 2) {
          const newOptions = [...pollOptions];
          newOptions.splice(index, 1);
          setPollOptions(newOptions);
      }
  };

  const handleTweet = async () => {
    if ((!content.trim() && mediaFiles.length === 0) || !user) return;

    setIsTweeting(true);
    try {
      let mediaUrls: string[] = [];

      if (mediaFiles.length > 0) {
        const uploadPromises = mediaFiles.map(async (media) => {
          return await uploadToCloudinary(media.file);
        });
        mediaUrls = await Promise.all(uploadPromises);
      }

      if (mediaUrls.length > 0) {
        // Create one post per media item
        const tweetPromises = mediaUrls.map(url => {
          const tweetData: any = {
            userId: user.uid,
            content: content.trim(),
            mediaUrls: [url], // Each post gets exactly one media URL
            replySetting,
            likesCount: 0,
            commentsCount: 0,
            retweetsCount: 0,
            viewsCount: 0,
            createdAt: serverTimestamp(),
          };

          // Group-level features only on the first post (optional decision, but for simplicity we'll keep them on all)
          if (showPoll && pollOptions.some(opt => opt.trim())) {
            tweetData.poll = {
              options: pollOptions.filter(opt => opt.trim()).map(opt => ({ text: opt, votes: 0 })),
              createdAt: serverTimestamp()
            };
          }
          if (scheduledDate) tweetData.scheduledAt = new Date(scheduledDate);
          if (tweetLocation) tweetData.location = tweetLocation;

          return addDoc(collection(db, "tweets"), tweetData);
        });

        await Promise.all(tweetPromises);
      } else {
        // Text-only post
        const tweetData: any = {
          userId: user.uid,
          content: content.trim(),
          mediaUrls: [],
          replySetting,
          likesCount: 0,
          commentsCount: 0,
          retweetsCount: 0,
          viewsCount: 0,
          createdAt: serverTimestamp(),
        };

        if (showPoll && pollOptions.some(opt => opt.trim())) {
          tweetData.poll = {
            options: pollOptions.filter(opt => opt.trim()).map(opt => ({ text: opt, votes: 0 })),
            createdAt: serverTimestamp()
          };
        }
        if (scheduledDate) tweetData.scheduledAt = new Date(scheduledDate);
        if (tweetLocation) tweetData.location = tweetLocation;

        await addDoc(collection(db, "tweets"), tweetData);
      }
      
      setContent("");
      setMediaFiles([]);
      setShowPoll(false);
      setPollOptions(["", ""]);
      setShowSchedule(false);
      setScheduledDate("");
      setTweetLocation(null);
    } catch (error: any) {
      console.error("Error creating tweet:", error);
      if (error.code?.includes('storage/')) {
        alert("Media upload failed. This is likely because your Firebase Storage is not yet fully active or requires an upgrade. You can still post text-only tweets!");
      } else {
        alert("Error posting tweet. Please try again.");
      }
    } finally {
      setIsTweeting(false);
    }
  };

  return (
    <div className="flex flex-col relative w-full">
      {/* Tabs */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-gray-800 flex items-center w-full pl-3 sm:pl-0">
        {!user && (
            <div className="shrink-0 sm:hidden pr-2">
                <button
                    onClick={signInWithGoogle}
                    className="flex items-center gap-1.5 bg-white text-black font-bold px-3 py-1.5 rounded-full text-[12px] hover:bg-gray-200 transition"
                >
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign in
                </button>
            </div>
        )}
        {user && (
            <div className="shrink-0 sm:hidden pr-2 z-50">
                <button 
                  onClick={() => router.push(`/profile/${user.uid}`)}
                  className="flex items-center justify-center p-1 rounded-full active:bg-white/10 transition cursor-pointer"
                >
                    <Avatar
                        src={userData?.profileImage}
                        fallbackText={userData?.displayName || userData?.username}
                        size="md"
                    />
                </button>
            </div>
        )}
        <button
          onClick={() => setActiveTab('foryou')}
          className="flex-1 hover:bg-white/5 transition flex justify-center"
        >
          <div className="relative py-4">
            <span className={cn("font-bold text-[15px]", activeTab === 'foryou' ? "text-white" : "text-gray-500")}>For you</span>
            {activeTab === 'foryou' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--color-twitter-blue)] rounded-full"></div>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('following')}
          className="flex-1 hover:bg-white/5 transition flex justify-center"
        >
          <div className="relative py-4">
            <span className={cn("font-bold text-[15px]", activeTab === 'following' ? "text-white" : "text-gray-500")}>Following</span>
            {activeTab === 'following' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--color-twitter-blue)] rounded-full"></div>
            )}
          </div>
        </button>
      </div>

      {/* Tweet Input */}
      {user && (
        <div className="p-4 border-b border-gray-800 flex gap-4">
          <Link href={`/profile/${user.uid}`} className="shrink-0 hover:opacity-90 transition">
            <Avatar
              src={userData?.profileImage}
              fallbackText={userData?.displayName || userData?.username}
              size="lg"
            />
          </Link>
          <div className="flex-grow">
            <textarea
              className="w-full bg-transparent text-xl outline-none resize-none placeholder-gray-500 min-h-[50px]"
              placeholder="What's happening?"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              rows={1}
            />
            <div className="flex flex-col mt-2">
              <div className="relative">
                <button 
                  onClick={() => setShowReplySettings(!showReplySettings)} 
                  className="flex items-center gap-1.5 text-[var(--color-twitter-blue)] text-sm font-bold pb-2 hover:bg-blue-500/10 px-3 py-1 -ml-2 rounded-full transition w-fit mb-2"
                >
                  <Globe className="w-4 h-4" />
                  <span>
                    {replySetting === 'everyone' ? 'Everyone can reply' : 
                     replySetting === 'followers' ? 'Only people who follow you can reply' :
                     replySetting === 'following' ? 'People you follow can reply' : 
                     'Only people you mention can reply'}
                  </span>
                </button>
                {showReplySettings && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowReplySettings(false)} />
                    <div className="absolute top-10 left-0 bg-black border border-gray-800 rounded-2xl shadow-[0_0_15px_rgba(255,255,255,0.1)] z-50 w-72 overflow-hidden py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="px-4 py-2 font-bold text-white text-[15px]">Who can reply?</div>
                      <div className="px-4 pb-2 text-sm text-gray-500 mb-2 border-b border-gray-800">
                        Choose who can reply to this post. Anyone mentioned can always reply.
                      </div>
                      <button 
                        onClick={() => { setReplySetting('everyone'); setShowReplySettings(false); }} 
                        className={cn("w-full text-left px-4 py-3 hover:bg-white/5 transition flex items-center gap-3", replySetting === 'everyone' && "bg-white/5")}
                      >
                        <div className="bg-blue-500 text-white p-2 rounded-full"><Globe className="w-5 h-5" /></div>
                        <span className="font-bold text-[15px] text-white">Everyone</span>
                      </button>
                      <button 
                        onClick={() => { setReplySetting('followers'); setShowReplySettings(false); }} 
                        className={cn("w-full text-left px-4 py-3 hover:bg-white/5 transition flex items-center gap-3", replySetting === 'followers' && "bg-white/5")}
                      >
                        <div className="bg-blue-500 text-white p-2 rounded-full"><Users className="w-5 h-5" /></div>
                        <span className="font-bold text-[15px] text-white">Followers</span>
                      </button>
                      <button 
                        onClick={() => { setReplySetting('following'); setShowReplySettings(false); }} 
                        className={cn("w-full text-left px-4 py-3 hover:bg-white/5 transition flex items-center gap-3", replySetting === 'following' && "bg-white/5")}
                      >
                        <div className="bg-blue-500 text-white p-2 rounded-full"><User className="w-5 h-5" /></div>
                        <span className="font-bold text-[15px] text-white">People you follow</span>
                      </button>
                      <button 
                        onClick={() => { setReplySetting('mentions'); setShowReplySettings(false); }} 
                        className={cn("w-full text-left px-4 py-3 hover:bg-white/5 transition flex items-center gap-3", replySetting === 'mentions' && "bg-white/5")}
                      >
                        <div className="bg-blue-500 text-white p-2 text-[18px] font-bold leading-5 text-center flex items-center justify-center rounded-full w-9 h-9">@</div>
                        <span className="font-bold text-[15px] text-white">Only people you mention</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
              
              <div className="w-full h-[1px] bg-gray-800 mb-3 ml-1 mr-4"></div>

              {mediaFiles.length > 0 && (
                <div className={cn(
                  "grid gap-2 mb-3 mr-2",
                  mediaFiles.length === 1 ? "grid-cols-1" : "grid-cols-2"
                )}>
                  {mediaFiles.map((media, index) => (
                    <div key={index} className="relative aspect-video rounded-2xl overflow-hidden border border-gray-800 bg-gray-900">
                      <button
                        onClick={() => removeMedia(index)}
                        className="absolute top-2 left-2 z-10 bg-black/50 hover:bg-black/70 p-1.5 rounded-full text-white transition backdrop-blur-sm"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      {media.type === 'image' ? (
                        <img
                          src={media.preview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video
                          src={media.preview}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {showPoll && (
                  <div className="mt-4 mb-3 p-4 border border-gray-800 rounded-2xl relative mr-4 ml-1">
                      <button
                          onClick={() => setShowPoll(false)}
                          className="absolute top-2 right-2 p-1 hover:bg-gray-900 rounded-full text-gray-500"
                      >
                          <X className="w-4 h-4" />
                      </button>
                      <div className="space-y-3">
                          {pollOptions.map((option, index) => (
                              <div key={index} className="flex items-center gap-2">
                                  <input
                                      type="text"
                                      value={option}
                                      onChange={(e) => {
                                          const newOptions = [...pollOptions];
                                          newOptions[index] = e.target.value;
                                          setPollOptions(newOptions);
                                      }}
                                      placeholder={`Choice ${index + 1}`}
                                      className="flex-grow bg-transparent border border-gray-800 rounded-md p-2 text-sm text-white focus:border-blue-500 outline-none"
                                  />
                                  {pollOptions.length > 2 && (
                                      <button onClick={() => removePollOption(index)} className="text-gray-500 hover:text-red-500">
                                          <X className="w-4 h-4" />
                                      </button>
                                  )}
                              </div>
                          ))}
                          {pollOptions.length < 4 && (
                              <button
                                  onClick={addPollOption}
                                  className="text-blue-500 text-sm font-medium hover:underline"
                              >
                                  + Add another choice
                              </button>
                          )}
                      </div>
                  </div>
              )}

              {showSchedule && (
                  <div className="mt-4 mb-3 p-4 border border-gray-800 rounded-2xl relative mr-4 ml-1">
                      <button
                          onClick={() => setShowSchedule(false)}
                          className="absolute top-2 right-2 p-1 hover:bg-gray-900 rounded-full text-gray-500"
                      >
                          <X className="w-4 h-4" />
                      </button>
                      <label className="text-xs text-gray-500 block mb-1">Send at</label>
                      <input
                          type="datetime-local"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className="bg-transparent border border-gray-800 rounded-md p-2 text-white text-sm outline-none focus:border-blue-500 w-full"
                      />
                  </div>
              )}

              {tweetLocation && (
                  <div className="mt-3 mb-3 ml-1 flex items-center gap-1.5 text-blue-500 text-xs font-medium bg-blue-500/10 w-fit px-3 py-1 rounded-full border border-blue-500/20">
                      <MapPin className="w-3 h-3" />
                      <span>{tweetLocation}</span>
                      <button onClick={() => setTweetLocation(null)} className="ml-1 hover:bg-blue-500/20 rounded-full">
                          <X className="w-3 h-3" />
                      </button>
                  </div>
              )}

              <div className="flex justify-between items-center pr-4">
                <div className="flex items-center">
                  <input
                    type="file"
                    accept="image/*,video/*,.jpg,.jpeg,.png,.gif,.mp4,.mov,.webm"
                    multiple
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleMediaSelect}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={mediaFiles.length >= 4}
                    className="p-2 rounded-full hover:bg-blue-500/10 text-[var(--color-twitter-blue)] transition disabled:opacity-50"
                  >
                    <Image className="w-5 h-5" />
                  </button>
                  <div className="relative" ref={emojiPickerRef}>
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-2 rounded-full hover:bg-blue-500/10 text-[var(--color-twitter-blue)] transition"
                    >
                      <Smile className="w-5 h-5" />
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute bottom-12 left-0 z-50">
                        <EmojiPicker
                          onEmojiClick={onEmojiClick}
                          theme={"dark" as any}
                          autoFocusSearch={false}
                          width={300}
                          height={400}
                        />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setShowPoll(!showPoll)}
                    className={cn("p-2 rounded-full hover:bg-blue-500/10 text-[var(--color-twitter-blue)] transition", showPoll && "bg-blue-500/10")}
                    title="Poll"
                  >
                    <List className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setShowSchedule(!showSchedule)}
                    className={cn("p-2 rounded-full hover:bg-blue-500/10 text-[var(--color-twitter-blue)] transition hidden sm:block", showSchedule && "bg-blue-500/10")}
                    title="Schedule"
                  >
                    <Calendar className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleLocation}
                    className={cn("p-2 rounded-full hover:bg-blue-500/10 text-[var(--color-twitter-blue)] transition hidden sm:block", (tweetLocation || isFetchingLocation) && "bg-blue-500/10")}
                    title="Location"
                  >
                    <MapPin className={cn("w-5 h-5", isFetchingLocation && "animate-pulse")} />
                  </button>
                </div>
                <Button
                  onClick={handleTweet}
                  disabled={(!content.trim() && mediaFiles.length === 0) || isTweeting}
                  className="px-5 py-1.5 twitter-button-primary"
                >
                  {isTweeting ? "Posting..." : "Post"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feed Area */}
      <div 
        className="flex flex-col pb-20"
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          // For You tab: left swipe (dx < -60) → Following
          if (activeTab === 'foryou' && dx < -60) setActiveTab('following');
          // Following tab: right swipe (dx > 60) → For You
          else if (activeTab === 'following' && dx > 60) setActiveTab('foryou');
        }}
      >
        {(() => {
          const displayTweets = activeTab === 'following' 
            ? tweets.filter(t => followingIds.includes(t.userId)) 
            : tweets;

          if (displayTweets.length === 0) {
            return (
              <div className="p-12 text-center text-gray-500">
                <p className="text-xl font-bold text-white mb-2">
                  {activeTab === 'following' ? "Welcome to your timeline!" : "No tweets yet."}
                </p>
                <p className="text-[15px]">
                  {activeTab === 'following' ? "When you follow people, you'll see the tweets they post here." : "Be the first to post!"}
                </p>
              </div>
            );
          }

          return (
            <>
              {displayTweets.map((tweet) => (
                <Tweet key={tweet.id} tweet={tweet} />
              ))}
              
              {hasMore && activeTab === 'foryou' && (
                <div className="p-8 flex justify-center border-b border-gray-800">
                  <button 
                    onClick={loadMoreTweets}
                    disabled={loadingMore}
                    className="text-[var(--color-twitter-blue)] font-bold hover:bg-blue-500/10 px-6 py-2 rounded-full transition disabled:opacity-50"
                  >
                    {loadingMore ? "Loading more..." : "Show more posts"}
                  </button>
                </div>
              )}
              
              {!hasMore && displayTweets.length > 0 && (
                <div className="p-12 text-center text-gray-500 border-b border-gray-800">
                  <p className="text-[15px]">You've reached the end of the timeline.</p>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}
