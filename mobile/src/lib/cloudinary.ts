export const uploadToCloudinary = async (uri: string, type: string): Promise<string> => {
  const cloudName = "dcwakwfs8";
  const uploadPreset = "twitter_clone";

  const formData = new FormData();
  
  // React Native version of file object in FormData
  const file = {
    uri,
    type: type || 'image/jpeg',
    name: uri.split('/').pop() || 'upload.jpg',
  } as any;
  
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const resourceType = type?.startsWith("video/") ? "video" : "image";

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      {
        method: "POST",
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Cloudinary upload failed");
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
};
