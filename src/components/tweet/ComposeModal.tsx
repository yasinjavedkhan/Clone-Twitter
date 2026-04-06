"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Button } from "@/components/ui/Button";
import { Image, List, Smile, Calendar, MapPin, Globe, X, User } from "lucide-react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import Avatar from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

interface ComposeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ComposeModal({ isOpen, onClose }: ComposeModalProps) {
    const { user, userData } = useAuth();
    const [content, setContent] = useState("");
    const [isTweeting, setIsTweeting] = useState(false);
    const [mediaFiles, setMediaFiles] = useState<{ file: File; type: 'image' | 'video'; preview: string }[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [replySetting, setReplySetting] = useState<'everyone' | 'following' | 'mentions'>('everyone');
    const [showReplySettings, setShowReplySettings] = useState(false);
    const [showPoll, setShowPoll] = useState(false);
    const [pollOptions, setPollOptions] = useState(["", ""]);
    const [showSchedule, setShowSchedule] = useState(false);
    const [scheduledDate, setScheduledDate] = useState("");
    const [composeLocation, setComposeLocation] = useState<string | null>(null);
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!isOpen || !user) return null;

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

    const removeMedia = (index: number) => {
        setMediaFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleLocation = () => {
        if (composeLocation) {
            setComposeLocation(null);
            return;
        }
        setIsFetchingLocation(true);
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    try {
                        const { latitude, longitude } = position.coords;
                        setComposeLocation(`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
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
        if (pollOptions.length < 4) setPollOptions([...pollOptions, ""]);
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
                const uploadPromises = mediaFiles.map(async (media) => await uploadToCloudinary(media.file));
                mediaUrls = await Promise.all(uploadPromises);
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
            if (composeLocation) tweetData.location = composeLocation;

            await addDoc(collection(db, "tweets"), tweetData);
            
            setContent("");
            setMediaFiles([]);
            setShowPoll(false);
            setPollOptions(["", ""]);
            setShowSchedule(false);
            setScheduledDate("");
            setComposeLocation(null);
            onClose();
        } catch (error: any) {
            console.error("Error creating tweet:", error);
            if (error.code?.includes('storage/')) {
                alert("Media upload failed. Your Firebase Storage is likely not fully active.");
            } else {
                alert("Error posting tweet. Please try again.");
            }
        } finally {
            setIsTweeting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-transparent sm:bg-gray-600/50 sm:backdrop-blur-sm sm:pt-[5%]">
            <div className="bg-black w-full h-full sm:h-auto sm:max-w-xl sm:rounded-2xl sm:border border-gray-800 flex flex-col pt-2 shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between p-2 px-4 sticky top-0 bg-black/80 backdrop-blur z-20">
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">
                        <X className="w-5 h-5 text-white" />
                    </button>
                    <span className="text-blue-500 font-bold hover:underline cursor-pointer text-[15px] px-4 hidden sm:block">Drafts</span>
                    <Button
                        onClick={handleTweet}
                        disabled={(!content.trim() && mediaFiles.length === 0) || isTweeting}
                        className="px-5 py-1.5 twitter-button-primary sm:hidden"
                    >
                        {isTweeting ? "Posting..." : "Post"}
                    </Button>
                </div>

                <div className="flex-grow overflow-y-auto px-4 pb-4">
                    <div className="flex gap-4">
                        <div className="shrink-0 pt-1">
                            <Avatar
                                src={userData?.profileImage}
                                fallbackText={userData?.displayName || userData?.username}
                                size="lg"
                            />
                        </div>
                        <div className="flex-grow pt-2">
                            <textarea
                                className="w-full bg-transparent text-xl outline-none resize-none placeholder-gray-500 min-h-[120px]"
                                placeholder="What's happening?"
                                value={content}
                                onChange={(e) => {
                                    setContent(e.target.value);
                                    e.target.style.height = 'auto';
                                    e.target.style.height = e.target.scrollHeight + 'px';
                                }}
                            />

                            <div className="relative">
                                <button 
                                    onClick={() => setShowReplySettings(!showReplySettings)} 
                                    className="flex items-center gap-1.5 text-[var(--color-twitter-blue)] text-sm font-bold hover:bg-blue-500/10 px-3 py-1 -ml-3 rounded-full transition w-fit mb-2"
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
                                            <div className="px-4 pb-2 text-sm text-gray-500 mb-2 border-b border-gray-800">Choose who can reply to this post. Anyone mentioned can always reply.</div>
                                            <button onClick={() => { setReplySetting('everyone'); setShowReplySettings(false); }} className={cn("w-full text-left px-4 py-3 hover:bg-white/5 transition flex items-center gap-3", replySetting === 'everyone' && "bg-white/5")}>
                                                <div className="bg-blue-500 text-white p-2 rounded-full"><Globe className="w-5 h-5" /></div>
                                                <span className="font-bold text-[15px] text-white">Everyone</span>
                                            </button>
                                            <button onClick={() => { setReplySetting('following'); setShowReplySettings(false); }} className={cn("w-full text-left px-4 py-3 hover:bg-white/5 transition flex items-center gap-3", replySetting === 'following' && "bg-white/5")}>
                                                <div className="bg-blue-500 text-white p-2 rounded-full"><User className="w-5 h-5" /></div>
                                                <span className="font-bold text-[15px] text-white">People you follow</span>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                            
                            <div className="w-full h-[1px] bg-gray-800 mb-3 -ml-2"></div>

                            {mediaFiles.length > 0 && (
                                <div className={cn("grid gap-2 mb-3", mediaFiles.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
                                    {mediaFiles.map((media, index) => (
                                        <div key={index} className="relative aspect-video rounded-2xl overflow-hidden border border-gray-800 bg-gray-900">
                                            <button onClick={() => removeMedia(index)} className="absolute top-2 left-2 z-10 bg-black/50 hover:bg-black/70 p-1.5 rounded-full text-white transition backdrop-blur-sm"><X className="w-4 h-4" /></button>
                                            {media.type === 'image' ? <img src={media.preview} className="w-full h-full object-cover" /> : <video src={media.preview} className="w-full h-full object-cover" muted playsInline />}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {showPoll && (
                                <div className="mt-4 mb-3 p-4 border border-gray-800 rounded-2xl relative">
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

                            {showSchedule && (
                                <div className="mt-4 mb-3 p-4 border border-gray-800 rounded-2xl relative">
                                    <button onClick={() => setShowSchedule(false)} className="absolute top-2 right-2 p-1 hover:bg-gray-900 rounded-full text-gray-500"><X className="w-4 h-4" /></button>
                                    <label className="text-xs text-gray-500 block mb-1">Send at</label>
                                    <input type="datetime-local" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="bg-transparent border border-gray-800 rounded-md p-2 text-white text-sm outline-none focus:border-blue-500 w-full" />
                                </div>
                            )}

                            {composeLocation && (
                                <div className="mt-3 mb-3 flex items-center gap-1.5 text-blue-500 text-xs font-medium bg-blue-500/10 w-fit px-3 py-1 rounded-full border border-blue-500/20">
                                    <MapPin className="w-3 h-3" /><span>{composeLocation}</span><button onClick={() => setComposeLocation(null)} className="ml-1 hover:bg-blue-500/20 rounded-full"><X className="w-3 h-3" /></button>
                                </div>
                            )}

                            <div className="flex justify-between items-center sm:pt-4">
                                <div className="flex items-center -ml-2">
                                    <input type="file" accept="image/*,video/*" multiple hidden ref={fileInputRef} onChange={handleMediaSelect} />
                                    <button onClick={() => fileInputRef.current?.click()} disabled={mediaFiles.length >= 4} className="p-2 rounded-full hover:bg-blue-500/10 text-[var(--color-twitter-blue)] disabled:opacity-50 transition"><Image className="w-5 h-5" /></button>
                                    <div className="relative" ref={emojiPickerRef}>
                                        <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 rounded-full hover:bg-blue-500/10 text-[var(--color-twitter-blue)] transition"><Smile className="w-5 h-5" /></button>
                                        {showEmojiPicker && <div className="absolute top-10 left-0 z-50"><EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.DARK} autoFocusSearch={false} width={300} height={400} /></div>}
                                    </div>
                                    <button onClick={() => setShowPoll(!showPoll)} className={cn("p-2 rounded-full hover:bg-blue-500/10 text-[var(--color-twitter-blue)] transition", showPoll && "bg-blue-500/10")}><List className="w-5 h-5" /></button>
                                    <button onClick={() => setShowSchedule(!showSchedule)} className={cn("p-2 rounded-full hover:bg-blue-500/10 text-[var(--color-twitter-blue)] transition hidden sm:block", showSchedule && "bg-blue-500/10")}><Calendar className="w-5 h-5" /></button>
                                    <button onClick={handleLocation} className={cn("p-2 rounded-full hover:bg-blue-500/10 text-[var(--color-twitter-blue)] transition hidden sm:block", (composeLocation || isFetchingLocation) && "bg-blue-500/10")}><MapPin className={cn("w-5 h-5", isFetchingLocation && "animate-pulse")} /></button>
                                </div>
                                <Button onClick={handleTweet} disabled={(!content.trim() && mediaFiles.length === 0) || isTweeting} className="px-5 py-1.5 twitter-button-primary hidden sm:block">{isTweeting ? "Posting..." : "Post"}</Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
