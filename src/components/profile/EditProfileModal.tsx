"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { X, Camera } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { userCache } from "@/lib/cache";

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave?: () => void;
}

export default function EditProfileModal({ isOpen, onClose, onSave }: EditProfileModalProps) {
    const { user, userData } = useAuth();

    const [displayName, setDisplayName] = useState(userData?.displayName || "");
    const [bio, setBio] = useState(userData?.bio || "");
    const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
    const [coverImageFile, setCoverImageFile] = useState<File | null>(null);

    // Previews
    const [profilePreview, setProfilePreview] = useState(userData?.profileImage || "");
    const [coverPreview, setCoverPreview] = useState(userData?.coverImage || "");

    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen || !user) return null;

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'cover') => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (type === 'profile') {
                setProfileImageFile(file);
                setProfilePreview(URL.createObjectURL(file));
            } else {
                setCoverImageFile(file);
                setCoverPreview(URL.createObjectURL(file));
            }
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        let storageError = false;
        try {
            const updates: any = {
                displayName,
                bio,
            };

            const uploadPromises = [];

            if (profileImageFile) {
                uploadPromises.push(
                    uploadToCloudinary(profileImageFile)
                        .then(url => {
                            updates.profileImage = url;
                        })
                        .catch(err => {
                            console.error("Profile image upload failed:", err);
                        })
                );
            }

            if (coverImageFile) {
                uploadPromises.push(
                    uploadToCloudinary(coverImageFile)
                        .then(url => {
                            updates.coverImage = url;
                        })
                        .catch(err => {
                            console.error("Cover image upload failed:", err);
                        })
                );
            }

            // Wait for both uploads if they exist (even if they fail, we proceed)
            if (uploadPromises.length > 0) {
                await Promise.all(uploadPromises);
            }

            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, updates);

            // Update local cache
            const currentCache = userCache.get(user.uid) || {};
            userCache.set(user.uid, { ...currentCache, ...updates });

            if (onSave) onSave();
            onClose();
        } catch (error: any) {
            console.error("Error updating profile:", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-transparent sm:bg-gray-600/50 sm:backdrop-blur-sm">
            <div className="bg-black w-full h-full sm:h-auto sm:max-w-xl sm:rounded-2xl sm:border border-gray-800 overflow-hidden flex flex-col sm:max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800 sticky top-0 bg-black/90 backdrop-blur z-10">
                    <div className="flex items-center gap-6">
                        <button onClick={onClose} className="p-2 hover:bg-gray-900 rounded-full transition">
                            <X className="w-5 h-5 text-white" />
                        </button>
                        <h2 className="text-xl font-bold text-white">Edit profile</h2>
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-1.5"
                    >
                        {isSaving ? "Saving..." : "Save"}
                    </Button>
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto hidden-scrollbar pb-10">
                    {/* Cover Image Upload */}
                    <div className="relative h-48 bg-gray-800 flex items-center justify-center group">
                        {coverPreview && (
                            <img src={coverPreview} className="absolute inset-0 w-full h-full object-cover" alt="Cover" />
                        )}
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition"></div>
                        <label className="relative z-10 w-12 h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center cursor-pointer transition">
                            <Camera className="w-6 h-6 text-white" />
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageChange(e, 'cover')} />
                        </label>
                    </div>

                    {/* Profile Image Upload */}
                    <div className="relative h-20 px-4">
                        <div className="absolute -top-16 border-4 border-black rounded-full overflow-hidden w-32 h-32 bg-gray-700 group">
                            <img src={profilePreview || "/default-avatar.png"} className="w-full h-full object-cover" alt="Avatar" />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition flex items-center justify-center">
                                <label className="w-12 h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center cursor-pointer transition">
                                    <Camera className="w-6 h-6 text-white" />
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageChange(e, 'profile')} />
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Form Fields */}
                    <div className="px-4 space-y-6 mt-4 opacity-100 placeholder-shown:opacity-100">
                        <div className="relative border border-gray-700 rounded-md focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition px-3 pt-6 pb-2">
                            <label className="absolute top-1 left-3 text-xs text-gray-500">Name</label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="w-full bg-transparent outline-none text-white text-lg"
                                maxLength={50}
                            />
                        </div>

                        <div className="relative border border-gray-700 rounded-md focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition px-3 pt-6 pb-2">
                            <label className="absolute top-1 left-3 text-xs text-gray-500">Bio</label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                className="w-full bg-transparent outline-none text-white text-lg resize-none min-h-[100px]"
                                maxLength={160}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
