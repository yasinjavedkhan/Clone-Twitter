"use client";

import { useState } from "react";
import { X, Image, List, Smile, Calendar, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment, query, where, orderBy, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useRef, useEffect } from "react";
import EmojiPicker from "emoji-picker-react";
import { formatDistanceToNow } from "date-fns";
import Avatar from "@/components/ui/Avatar";
import { sendPushNotification } from "@/lib/notifications";
import { useTheme } from "@/contexts/ThemeContext";

interface CommentModalProps {
    tweet: any;
    author: any;
    isOpen: boolean;
    onClose: () => void;
}

export default function CommentModal({ tweet, author, isOpen, onClose }: CommentModalProps) {
    const { user, userData } = useAuth();
    const { theme } = useTheme();
    const [content, setContent] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [mediaFiles, setMediaFiles] = useState<{ file: File; type: 'image' | 'video'; preview: string }[]>([]);
    const [comments, setComments] = useState<any[]>([]);
// ... (rest of the states stay)
    const [showPoll, setShowPoll] = useState(false);
    const [pollOptions, setPollOptions] = useState(["", ""]);
    const [showSchedule, setShowSchedule] = useState(false);
    const [scheduledDate, setScheduledDate] = useState("");
    const [commentLocation, setCommentLocation] = useState<string | null>(null);
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);

    const authorCache = useRef<Map<string, any>>(new Map());

    useEffect(() => {
        if (!isOpen || !tweet.id) return;

        const q = query(
            collection(db, "comments"),
            where("tweetId", "==", tweet.id)
            // Removed orderBy to avoid requiring a composite index
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const commentsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as any[];

            // Sort by createdAt in JS
            commentsData.sort((a, b) => {
                const timeA = a.createdAt?.seconds || 0;
                const timeB = b.createdAt?.seconds || 0;
                return timeA - timeB;
            });

            // Fetch author data for each comment efficiently
            const commentsWithAuthors = await Promise.all(
                commentsData.map(async (comment: any) => {
                    if (authorCache.current.has(comment.userId)) {
                        return { ...comment, author: authorCache.current.get(comment.userId) };
                    }
                    const userDoc = await getDoc(doc(db, "users", comment.userId));
                    const authorData = userDoc.exists() ? userDoc.data() : null;
                    if (authorData) authorCache.current.set(comment.userId, authorData);
                    return {
                        ...comment,
                        author: authorData
                    };
                })
            );

            setComments(commentsWithAuthors);
        });

        return () => unsubscribe();
    }, [isOpen, tweet.id]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const onEmojiClick = (emojiData: any) => {
        setContent((prev) => prev + emojiData.emoji);
    };

    const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Limit to 4 items
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
        if (commentLocation) {
            setCommentLocation(null);
            return;
        }
        setIsFetchingLocation(true);
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    try {
                        const { latitude, longitude } = position.coords;
                        setCommentLocation(`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
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

    if (!isOpen || !user) return null;

    const handleSubmit = async () => {
        if (!content.trim() && mediaFiles.length === 0 || isSubmitting) return;
        setIsSubmitting(true);

        try {
            let mediaUrls: string[] = [];

            if (mediaFiles.length > 0) {
                const uploadPromises = mediaFiles.map(async (media) => {
                  return await uploadToCloudinary(media.file);
                });
                mediaUrls = await Promise.all(uploadPromises);
            }

            const commentData: any = {
                tweetId: tweet.id,
                userId: user.uid,
                content: content.trim(),
                mediaUrls,
                createdAt: serverTimestamp(),
            };

            if (showPoll && pollOptions.some(opt => opt.trim())) {
                commentData.poll = {
                    options: pollOptions.filter(opt => opt.trim()).map(opt => ({ text: opt, votes: 0 })),
                    createdAt: serverTimestamp()
                };
            }

            if (scheduledDate) {
                commentData.scheduledAt = new Date(scheduledDate);
            }

            if (commentLocation) {
                commentData.location = commentLocation;
            }

            // 1. Add comment to 'comments' collection
            await addDoc(collection(db, "comments"), commentData);

            // 2. Update commentsCount on the tweet
            const tweetRef = doc(db, "tweets", tweet.id);
            await updateDoc(tweetRef, {
                commentsCount: increment(1)
            });

            // 3. Send push notification to tweet author
            if (tweet.userId !== user.uid) {
                const senderName = userData?.displayName || user.displayName || user.email?.split('@')[0] || 'Someone';
                sendPushNotification({
                    toUserId: tweet.userId,
                    title: `💬 New Reply`,
                    body: `${senderName}: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
                    data: {
                        type: 'comment',
                        tweetId: tweet.id,
                        url: `/`
                    }
                }).catch(console.error);
            }

            setContent("");
            setMediaFiles([]);
            setShowPoll(false);
            setPollOptions(["", ""]);
            setShowSchedule(false);
            setScheduledDate("");
            setCommentLocation(null);
            onClose();
        } catch (error: any) {
            console.error("Error posting comment:", error);
            if (error.code?.includes('storage/')) {
                alert("Media upload failed. Your reply could not be posted with media. Please try text only.");
            } else {
                alert("Failed to post comment.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm sm:pt-[5%]">
            <div className="bg-[var(--tw-bg-main)] w-full h-full sm:h-auto sm:max-w-xl sm:rounded-2xl sm:border border-[var(--tw-border-main)] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-[var(--tw-bg-main)]/90 backdrop-blur z-10 sticky top-0">
                    <button onClick={onClose} className="p-2 hover:bg-[var(--tw-text-main)]/10 rounded-full transition">
                        <X className="w-5 h-5 text-[var(--tw-text-main)]" />
                    </button>
                    <span className="text-blue-500 font-bold cursor-pointer hover:underline text-[15px]">Drafts</span>
                </div>

                <div className="flex-grow overflow-y-auto px-4 pb-4">
                    {/* Original Tweet Group */}
                    <div className="flex gap-4 min-h-0">
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 shrink-0">
                                <Avatar
                                    src={author?.profileImage}
                                    fallbackText={author?.displayName || author?.username}
                                    size="lg"
                                />
                            </div>
                            {/* Vertical Line to next item */}
                            <div className="w-0.5 grow bg-[var(--tw-border-main)] my-1"></div>
                        </div>
                        <div className="flex flex-col py-1 pb-6 min-w-0 flex-grow">
                            <div className="flex items-center gap-1 text-[15px]">
                                <span className="font-bold text-[var(--tw-text-main)] leading-tight">{author?.displayName || author?.username}</span>
                                <span className="text-[var(--tw-text-muted)] leading-tight">·</span>
                                <span className="text-[var(--tw-text-muted)] leading-tight">now</span>
                            </div>
                            <p className="text-[var(--tw-text-main)] mt-1 text-[15px] break-words">{tweet.content}</p>
                            <p className="text-[var(--tw-text-muted)] text-[15px] mt-3">
                                Replying to <span className="text-blue-500">@{author?.username}</span>
                            </p>
                        </div>
                    </div>

                    {/* Previous Comments */}
                    {comments.map((comment, index) => (
                        <div key={comment.id} className="flex gap-4">
                            <div className="flex flex-col items-center">
                                {/* Line from above */}
                                <div className="w-0.5 h-2 bg-[var(--tw-border-main)] -mt-2"></div>
                                <div className="w-12 h-12 shrink-0">
                                    <Avatar
                                        src={comment.author?.profileImage}
                                        fallbackText={comment.author?.displayName || comment.author?.username}
                                        size="lg"
                                    />
                                </div>
                                {/* Line to below */}
                                <div className="w-0.5 grow bg-[var(--tw-border-main)] my-1"></div>
                            </div>
                            <div className="flex flex-col py-1 pb-6 min-w-0 flex-grow">
                                <div className="flex items-center gap-1 text-[15px]">
                                    <span className="font-bold text-[var(--tw-text-main)] leading-tight">{comment.author?.displayName || comment.author?.username}</span>
                                    <span className="text-[var(--tw-text-muted)] leading-tight">·</span>
                                    <span className="text-[var(--tw-text-muted)] text-xs leading-tight">
                                        {comment.createdAt?.toDate ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true }) : 'now'}
                                    </span>
                                </div>
                                <p className="text-[var(--tw-text-main)] mt-1 text-[15px] break-words">{comment.content}</p>
                                {comment.mediaUrls && comment.mediaUrls.length > 0 && (
                                    <div className={cn(
                                        "mt-2 overflow-hidden rounded-2xl border border-[var(--tw-border-main)] grid gap-0.5",
                                        comment.mediaUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"
                                    )}>
                                        {comment.mediaUrls.map((url: string, idx: number) => {
                                            const isVid = url.toLowerCase().includes('.mp4') || 
                                                         url.toLowerCase().includes('.mov') || 
                                                         url.toLowerCase().includes('.webm') ||
                                                         url.includes('video');
                                            return (
                                                <div key={idx} className="relative aspect-video bg-[var(--tw-bg-card)] overflow-hidden">
                                                    {isVid ? (
                                                        <video src={url} controls className="w-full h-full object-cover" />
                                                    ) : (
                                                        <img src={url} className="w-full h-full object-cover" alt="Comment media" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* My Reply */}
                    <div className="flex gap-4 mt-2">
                        <div className="flex flex-col items-center">
                            {/* Line from above to connect into the reply section */}
                            <div className="w-0.5 h-full bg-[var(--tw-border-main)] -mt-4 mb-2"></div>
                            <div className="w-12 h-12 shrink-0">
                                <Avatar
                                    src={userData?.profileImage}
                                    fallbackText={userData?.displayName || userData?.username}
                                    size="lg"
                                />
                            </div>
                        </div>
                        <div className="flex-grow pt-2">
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Post your reply"
                                className="w-full bg-transparent border-none outline-none text-[var(--tw-text-main)] text-xl resize-none min-h-[120px]"
                                autoFocus
                            />
                            {mediaFiles.length > 0 && (
                                <div className={cn(
                                    "grid gap-2 mt-2 mb-3 mr-2",
                                    mediaFiles.length === 1 ? "grid-cols-1" : "grid-cols-2"
                                )}>
                                    {mediaFiles.map((media, index) => (
                                        <div key={index} className="relative aspect-video rounded-2xl overflow-hidden border border-[var(--tw-border-main)] bg-[var(--tw-bg-card)]">
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
                                <div className="mt-4 p-4 border border-[var(--tw-border-main)] rounded-2xl relative">
                                    <button
                                        onClick={() => setShowPoll(false)}
                                        className="absolute top-2 right-2 p-1 hover:bg-[var(--tw-text-main)]/10 rounded-full text-[var(--tw-text-muted)]"
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
                                                    className="flex-grow bg-transparent border border-[var(--tw-border-main)] rounded-md p-2 text-sm text-[var(--tw-text-main)] focus:border-blue-500 outline-none"
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
                                <div className="mt-4 p-4 border border-[var(--tw-border-main)] rounded-2xl relative">
                                    <button
                                        onClick={() => setShowSchedule(false)}
                                        className="absolute top-2 right-2 p-1 hover:bg-[var(--tw-text-main)]/10 rounded-full text-[var(--tw-text-muted)]"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    <label className="text-xs text-[var(--tw-text-muted)] block mb-1">Send at</label>
                                    <input
                                        type="datetime-local"
                                        value={scheduledDate}
                                        onChange={(e) => setScheduledDate(e.target.value)}
                                        className="bg-transparent border border-[var(--tw-border-main)] rounded-md p-2 text-[var(--tw-text-main)] text-sm outline-none focus:border-blue-500 w-full"
                                    />
                                </div>
                            )}

                            {commentLocation && (
                                <div className="mt-3 flex items-center gap-1.5 text-blue-500 text-xs font-medium bg-blue-500/10 w-fit px-3 py-1 rounded-full border border-blue-500/20">
                                    <MapPin className="w-3 h-3" />
                                    <span>{commentLocation}</span>
                                    <button onClick={() => setCommentLocation(null)} className="ml-1 hover:bg-blue-500/20 rounded-full">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between mt-4 pl-14">
                        <div className="flex items-center gap-1 text-blue-500">
                            <input
                                type="file"
                                accept="image/*,video/*"
                                multiple
                                hidden
                                ref={fileInputRef}
                                onChange={handleMediaSelect}
                            />
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={cn("p-2 hover:bg-blue-500/10 rounded-full cursor-pointer transition", mediaFiles.length >= 4 && "opacity-50")}
                                title="Media"
                            >
                                <Image className="w-5 h-5" />
                            </div>
                            <div
                                onClick={() => setShowPoll(!showPoll)}
                                className={cn("p-2 hover:bg-blue-500/10 rounded-full cursor-pointer transition", showPoll && "bg-blue-500/10")}
                                title="Poll"
                            >
                                <List className="w-5 h-5" />
                            </div>
                            <div className="relative" ref={emojiPickerRef}>
                                <div
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    className="p-2 hover:bg-blue-500/10 rounded-full cursor-pointer transition"
                                    title="Emoji"
                                >
                                    <Smile className="w-5 h-5" />
                                </div>
                                {showEmojiPicker && (
                                    <div className="absolute bottom-12 left-0 z-50">
                                        <EmojiPicker
                                            onEmojiClick={onEmojiClick}
                                            theme={(theme === 'light' ? 'light' : 'dark') as any}
                                            autoFocusSearch={false}
                                            width={300}
                                            height={400}
                                        />
                                    </div>
                                )}
                            </div>
                            <div
                                onClick={() => setShowSchedule(!showSchedule)}
                                className={cn("p-2 hover:bg-blue-500/10 rounded-full cursor-pointer transition", showSchedule && "bg-blue-500/10")}
                                title="Schedule"
                            >
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div
                                onClick={handleLocation}
                                className={cn("p-2 hover:bg-blue-500/10 rounded-full cursor-pointer transition", (commentLocation || isFetchingLocation) && "bg-blue-500/10")}
                                title="Location"
                            >
                                <MapPin className={cn("w-5 h-5", isFetchingLocation && "animate-pulse")} />
                            </div>
                        </div>
                        <Button
                            onClick={handleSubmit}
                            disabled={(!content.trim() && mediaFiles.length === 0) || isSubmitting}
                            className="px-6 py-1.5 font-bold"
                        >
                            Reply
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
