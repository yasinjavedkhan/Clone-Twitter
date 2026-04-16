"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Button } from "@/components/ui/Button";
import { Image, List, Smile, Calendar, MapPin, Globe, X, User } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });
import { useRouter, useSearchParams } from "next/navigation";
import { sendPushNotification } from "@/lib/notifications";
import { Suspense } from "react";

function ComposeContent() {
    const { user, userData } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialContent = searchParams.get("content") || "";

    const [content, setContent] = useState(initialContent);
    const [isTweeting, setIsTweeting] = useState(false);
    const [mediaFiles, setMediaFiles] = useState<{ file: File; type: 'image' | 'video'; preview: string }[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [replySetting, setReplySetting] = useState<'everyone' | 'following' | 'mentions'>('everyone');
    const [showReplySettings, setShowReplySettings] = useState(false);
    const [showPoll, setShowPoll] = useState(false);
    const [pollOptions, setPollOptions] = useState(["", ""]);
    const [showSchedule, setShowSchedule] = useState(false);
    const [scheduledDate, setScheduledDate] = useState("");
    const [postLocation, setPostLocation] = useState<string | null>(null);
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!user) {
        router.replace("/");
        return null;
    }

    const onEmojiClick = (emojiData: any) => {
        setContent((prev) => prev + emojiData.emoji);
    };

    const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        const newFiles = files.slice(0, 4 - mediaFiles.length);
        newFiles.forEach(file => {
            const type = file.type.startsWith('video/') ? 'video' : 'image';
            const reader = new FileReader();
            reader.onloadend = () => {
                setMediaFiles(prev => [...prev, { file, type, preview: reader.result as string }]);
            };
            reader.readAsDataURL(file);
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeMedia = (index: number) => setMediaFiles(prev => prev.filter((_, i) => i !== index));

    const handleLocation = () => {
        if (postLocation) {
            setPostLocation(null);
            return;
        }
        setIsFetchingLocation(true);
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    try {
                        const { latitude, longitude } = position.coords;
                        setPostLocation(`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
                    } finally {
                        setIsFetchingLocation(false);
                    }
                },
                () => { alert("Location access denied."); setIsFetchingLocation(false); }
            );
        } else {
            alert("Geolocation not supported.");
            setIsFetchingLocation(false);
        }
    };

    const addPollOption = () => { if (pollOptions.length < 4) setPollOptions([...pollOptions, ""]); };
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
                mediaUrls = await Promise.all(mediaFiles.map(media => uploadToCloudinary(media.file)));
            }

            const tweetData: any = {
                userId: user.uid,
                content: content.trim(),
                mediaUrls,
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
            if (postLocation) tweetData.location = postLocation;

            const tweetRef = await addDoc(collection(db, "tweets"), tweetData);

            // Notify followers
            try {
                const followersQuery = query(
                    collection(db, "follows"),
                    where("followingId", "==", user.uid)
                );
                const followersSnap = await getDocs(followersQuery);
                const followerIds = followersSnap.docs.map(doc => doc.data().followerId);

                if (followerIds.length > 0) {
                    await Promise.all(followerIds.map(async (followerId) => {
                        // Create in-app notification
                        await addDoc(collection(db, "notifications"), {
                            userId: followerId,
                            type: "post",
                            title: `New Post from ${userData?.displayName || userData?.username || 'someone you follow'}`,
                            message: content.trim().substring(0, 100) + (content.length > 100 ? "..." : ""),
                            tweetId: tweetRef.id,
                            authorId: user.uid,
                            read: false,
                            createdAt: serverTimestamp(),
                        });

                        // Send push notification
                        await sendPushNotification({
                            toUserId: followerId,
                            title: `New Post from ${userData?.displayName || userData?.username}`,
                            body: content.trim().substring(0, 150),
                            data: {
                                type: "post",
                                tweetId: tweetRef.id,
                            }
                        });
                    }));
                }
            } catch (notifyError) {
                console.error("Error sending notifications to followers:", notifyError);
                // Don't fail the whole tweet process if notifications fail
            }

            router.push("/");
        } catch (error: any) {
            console.error("Error creating tweet:", error);
            alert("Error posting tweet. Please try again.");
        } finally {
            setIsTweeting(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800 flex items-center justify-between px-4 h-[53px]">
                <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-full transition">
                    <X className="w-5 h-5 text-white" />
                </button>
                <span className="text-blue-500 font-bold text-[15px] cursor-pointer hover:underline">Drafts</span>
            </div>

            {/* Composer */}
            <div className="flex gap-4 p-4 flex-grow">
                <div className="shrink-0">
                    <Avatar
                        src={userData?.profileImage}
                        fallbackText={userData?.displayName || userData?.username}
                        size="lg"
                    />
                </div>
                <div className="flex-grow flex flex-col min-h-full">
                    <textarea
                        ref={textareaRef}
                        className="w-full bg-transparent text-xl outline-none resize-none placeholder-gray-500 min-h-[150px]"
                        placeholder="What's happening?"
                        value={content}
                        onChange={(e) => {
                            setContent(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                    />

                    {/* Reply Setting */}
                    <div className="relative mb-2">
                        <button
                            onClick={() => setShowReplySettings(!showReplySettings)}
                            className="flex items-center gap-1.5 text-[var(--color-twitter-blue)] text-sm font-bold hover:bg-blue-500/10 px-3 py-1 rounded-full transition w-fit"
                        >
                            <Globe className="w-4 h-4" />
                            <span>
                                {replySetting === 'everyone' ? 'Everyone can reply' :
                                    replySetting === 'following' ? 'People you follow can reply' :
                                        'Only people you mention can reply'}
                            </span>
                        </button>
                        {showReplySettings && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowReplySettings(false)} />
                                <div className="absolute top-10 left-0 bg-black border border-gray-800 rounded-2xl shadow-[0_0_15px_rgba(255,255,255,0.1)] z-50 w-72 overflow-hidden py-2">
                                    <div className="px-4 py-2 font-bold text-white text-[15px]">Who can reply?</div>
                                    <div className="px-4 pb-2 text-sm text-gray-500 mb-2 border-b border-gray-800">Choose who can reply to this post.</div>
                                    <button onClick={() => { setReplySetting('everyone'); setShowReplySettings(false); }} className={cn("w-full text-left px-4 py-3 hover:bg-white/5 transition flex items-center gap-3", replySetting === 'everyone' && "bg-white/5")}>
                                        <div className="bg-blue-500 text-white p-2 rounded-full"><Globe className="w-5 h-5" /></div>
                                        <span className="font-bold text-[15px] text-white">Everyone</span>
                                    </button>
                                    <button onClick={() => { setReplySetting('following'); setShowReplySettings(false); }} className={cn("w-full text-left px-4 py-3 hover:bg-white/5 transition flex items-center gap-3", replySetting === 'following' && "bg-white/5")}>
                                        <div className="bg-blue-500 text-white p-2 rounded-full"><User className="w-5 h-5" /></div>
                                        <span className="font-bold text-[15px] text-white">People you follow</span>
                                    </button>
                                    <button onClick={() => { setReplySetting('mentions'); setShowReplySettings(false); }} className={cn("w-full text-left px-4 py-3 hover:bg-white/5 transition flex items-center gap-3", replySetting === 'mentions' && "bg-white/5")}>
                                        <div className="bg-blue-500 text-white p-2 text-[18px] font-bold leading-5 text-center flex items-center justify-center rounded-full w-9 h-9">@</div>
                                        <span className="font-bold text-[15px] text-white">Only people you mention</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="w-full h-[1px] bg-gray-800 mb-3"></div>

                    {/* Media Preview */}
                    {mediaFiles.length > 0 && (
                        <div className={cn("grid gap-2 mb-3", mediaFiles.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
                            {mediaFiles.map((media, index) => (
                                <div key={index} className="relative aspect-video rounded-2xl overflow-hidden border border-gray-800 bg-gray-900">
                                    <button onClick={() => removeMedia(index)} className="absolute top-2 left-2 z-10 bg-black/50 hover:bg-black/70 p-1.5 rounded-full text-white transition"><X className="w-4 h-4" /></button>
                                    {media.type === 'image' ? <img src={media.preview} className="w-full h-full object-cover" /> : <video src={media.preview} className="w-full h-full object-cover" muted playsInline />}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Poll */}
                    {showPoll && (
                        <div className="mb-3 p-4 border border-gray-800 rounded-2xl relative">
                            <button onClick={() => setShowPoll(false)} className="absolute top-2 right-2 p-1 hover:bg-gray-900 rounded-full text-gray-500"><X className="w-4 h-4" /></button>
                            <div className="space-y-3">
                                {pollOptions.map((option, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <input type="text" value={option} onChange={(e) => { const newOptions = [...pollOptions]; newOptions[index] = e.target.value; setPollOptions(newOptions); }} placeholder={`Choice ${index + 1}`} className="flex-grow bg-transparent border border-gray-800 rounded-md p-2 text-sm text-white focus:border-blue-500 outline-none" />
                                        {pollOptions.length > 2 && <button onClick={() => removePollOption(index)} className="text-gray-500 hover:text-red-500"><X className="w-4 h-4" /></button>}
                                    </div>
                                ))}
                                {pollOptions.length < 4 && <button onClick={addPollOption} className="text-blue-500 text-sm font-medium hover:underline">+ Add another choice</button>}
                            </div>
                        </div>
                    )}

                    {/* Schedule */}
                    {showSchedule && (
                        <div className="mb-3 p-4 border border-gray-800 rounded-2xl relative">
                            <button onClick={() => setShowSchedule(false)} className="absolute top-2 right-2 p-1 hover:bg-gray-900 rounded-full text-gray-500"><X className="w-4 h-4" /></button>
                            <label className="text-xs text-gray-500 block mb-1">Send at</label>
                            <input type="datetime-local" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="bg-transparent border border-gray-800 rounded-md p-2 text-white text-sm outline-none focus:border-blue-500 w-full" />
                        </div>
                    )}

                    {/* Location */}
                    {postLocation && (
                        <div className="mb-3 flex items-center gap-1.5 text-blue-500 text-xs font-medium bg-blue-500/10 w-fit px-3 py-1 rounded-full border border-blue-500/20">
                            <MapPin className="w-3 h-3" /><span>{postLocation}</span><button onClick={() => setPostLocation(null)} className="ml-1 hover:bg-blue-500/20 rounded-full"><X className="w-3 h-3" /></button>
                        </div>
                    )}

                    {/* Actions + Post Button */}
                    <div className="flex justify-between items-center mt-auto pt-4 sticky bottom-0 bg-black border-t border-gray-800 -mx-4 px-4 pb-4">
                        <div className="flex items-center -ml-2">
                            <input type="file" accept="image/*,video/*" multiple className="hidden" ref={fileInputRef} onChange={handleMediaSelect} />
                            <button onClick={() => fileInputRef.current?.click()} disabled={mediaFiles.length >= 4} className="p-2 rounded-full hover:bg-blue-500/10 text-[var(--color-twitter-blue)] disabled:opacity-50 transition"><Image className="w-5 h-5" /></button>
                            <div className="relative" ref={emojiPickerRef}>
                                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 rounded-full hover:bg-blue-500/10 text-[var(--color-twitter-blue)] transition"><Smile className="w-5 h-5" /></button>
                                {showEmojiPicker && <div className="absolute bottom-12 left-0 z-50"><EmojiPicker onEmojiClick={onEmojiClick} theme={"dark" as any} autoFocusSearch={false} width={300} height={400} /></div>}
                            </div>
                            <button onClick={() => setShowPoll(!showPoll)} className={cn("p-2 rounded-full hover:bg-blue-500/10 text-[var(--color-twitter-blue)] transition", showPoll && "bg-blue-500/10")}><List className="w-5 h-5" /></button>
                            <button onClick={() => setShowSchedule(!showSchedule)} className={cn("p-2 rounded-full hover:bg-blue-500/10 text-[var(--color-twitter-blue)] transition", showSchedule && "bg-blue-500/10")}><Calendar className="w-5 h-5" /></button>
                            <button onClick={handleLocation} className={cn("p-2 rounded-full hover:bg-blue-500/10 text-[var(--color-twitter-blue)] transition", (postLocation || isFetchingLocation) && "bg-blue-500/10")} title="Location">
                                <MapPin className={cn("w-5 h-5", isFetchingLocation && "animate-pulse")} />
                            </button>
                        </div>
                        <Button
                            onClick={handleTweet}
                            disabled={(!content.trim() && mediaFiles.length === 0) || isTweeting}
                            className="px-5 py-2 twitter-button-primary text-[15px] font-bold"
                        >
                            {isTweeting ? "Posting..." : "Post"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ComposePage() {
    return (
        <Suspense fallback={null}>
            <ComposeContent />
        </Suspense>
    );
}
