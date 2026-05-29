import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { dataUrlToFile } from '../../helpers/fileHelpers';

export const useAvatars = () => {
  const [avatarMode, setAvatarMode] = useState("prebuilt");
  // selectedAvatars now stores all images from the selected collection/avatar
  const [selectedAvatars, setSelectedAvatars] = useState([]);
  // Track which collection is selected (for prebuilt mode)
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);
  const [uploadedAvatarFile, setUploadedAvatarFile] = useState(null); // Keep for compatibility
  const [uploadedAvatarFiles, setUploadedAvatarFiles] = useState([]);
  const [avatarPrompt, setAvatarPrompt] = useState("");
  const [avatarVariantCount, setAvatarVariantCount] = useState(3);
  const [generatedAvatars, setGeneratedAvatars] = useState([]);
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  // reAvatars now stores collections: [{id, name, coverImage, images: [...]}]
  const [reAvatars, setReAvatars] = useState([]);
  const [reAvatarsLoading, setReAvatarsLoading] = useState(false);
  const [reAvatarsError, setReAvatarsError] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  // User's saved avatar library from MongoDB
  const [library, setLibrary] = useState([]);

  // Fetch RE avatars (admin collections) + user library
  const fetchReAvatars = async () => {
    setReAvatarsLoading(true);
    setReAvatarsError(null);
    try {
      const res = await fetch("/api/avatars/re");
      const data = await res.json();
      setReAvatars(data.avatars ?? []);
      setLibrary(data.library ?? []);
    } catch (err) {
      console.error("[RE Avatars] fetch error:", err);
      setReAvatarsError("Failed to load avatars");
    } finally {
      setReAvatarsLoading(false);
    }
  };

  useEffect(() => {
    fetchReAvatars();
  }, []);

  const handleUploadFile = async (file) => {
    if (!file) return;
    if (uploadedAvatarFiles.length >= 5) {
      toast.error("You can upload up to 5 custom presenters.");
      return;
    }

    const id = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const localUrl = URL.createObjectURL(file);
    const newUpload = {
      id,
      file,
      url: localUrl,
      name: file.name ? file.name.replace(/\.[^/.]+$/, "") : "Custom Presenter",
      isUploading: false,
      isSaved: false
    };

    const updatedFiles = [...uploadedAvatarFiles, newUpload];
    setUploadedAvatarFiles(updatedFiles);

    // If it's the first or only file uploaded, auto-select it!
    if (updatedFiles.length === 1) {
      await selectUploadedAvatar(newUpload, updatedFiles);
    }
  };

  const selectUploadedAvatar = async (uploadObj, currentFiles = uploadedAvatarFiles) => {
    if (uploadObj.isUploading) return;

    // If it's already saved to the database/R2, select it immediately
    if (uploadObj.isSaved) {
      const avatarObj = {
        url: uploadObj.url,
        file: uploadObj.file,
        name: uploadObj.name,
        key: uploadObj.id,
        angle: "front",
      };
      setSelectedAvatars([avatarObj]);
      // For backward compatibility
      setUploadedAvatarFile(uploadObj.file);
      return;
    }

    // Mark as uploading
    setUploadedAvatarFiles((prev) =>
      prev.map((f) => (f.id === uploadObj.id ? { ...f, isUploading: true } : f))
    );

    try {
      toast.info(`Saving "${uploadObj.name}" to your Asset Library...`);
      const formData = new FormData();
      formData.append("file", uploadObj.file);
      formData.append("name", uploadObj.name);
      formData.append("type", "avatar");
      formData.append("category", "avatars");

      const res = await fetch("/api/assets/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const data = await res.json();
      const savedAsset = data.asset;

      // Update state with permanent URL and saved status
      setUploadedAvatarFiles((prev) =>
        prev.map((f) =>
          f.id === uploadObj.id
            ? {
                ...f,
                url: savedAsset.url,
                isUploading: false,
                isSaved: true,
                id: savedAsset._id || savedAsset.id,
              }
            : f
        )
      );

      const avatarObj = {
        url: savedAsset.url,
        file: uploadObj.file,
        name: savedAsset.name,
        key: savedAsset._id || savedAsset.id,
        angle: "front",
      };

      setSelectedAvatars([avatarObj]);
      // Update backward compatibility uploadedAvatarFile
      setUploadedAvatarFile(uploadObj.file);
      toast.success(`"${savedAsset.name}" saved to library!`);

      // Refetch the database+S3 list so the avatar appears in "RE Agents" list!
      fetchReAvatars();
    } catch (err) {
      setUploadedAvatarFiles((prev) =>
        prev.map((f) => (f.id === uploadObj.id ? { ...f, isUploading: false } : f))
      );
      toast.error("Failed to save avatar to Asset Library", { description: err.message });
    }
  };

  const toggleUploadedAvatar = async (uploadObj) => {
    const isSelected = selectedAvatars.some(
      (a) => a.key === uploadObj.id || a.url === uploadObj.url
    );
    if (isSelected) {
      clearSelectedAvatars();
    } else {
      await selectUploadedAvatar(uploadObj);
    }
  };

  const selectLibraryAvatar = (item) => {
    const isSelected = selectedAvatars.some((a) => a.key === item.id);
    if (isSelected) {
      clearSelectedAvatars();
    } else {
      setSelectedAvatars([{ url: item.url, file: null, name: item.name, key: item.id, angle: 'front' }]);
    }
  };

  const deleteLibraryAvatar = async (id) => {
    try {
      const res = await fetch(`/api/assets?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setLibrary((prev) => prev.filter((a) => a.id !== id));
      setSelectedAvatars((prev) => {
        const wasSelected = prev.some((a) => a.key === id);
        if (wasSelected) { setUploadedAvatarFile(null); return []; }
        return prev;
      });
      toast.success('Avatar removed from library');
    } catch {
      toast.error('Failed to delete avatar');
    }
  };

  const removeUploadedAvatar = (id) => {
    setUploadedAvatarFiles((prev) => prev.filter((f) => f.id !== id));
    setSelectedAvatars((prev) => {
      const isSelected = prev.some((a) => a.key === id);
      if (isSelected) {
        setUploadedAvatarFile(null);
        return [];
      }
      return prev;
    });
  };

  // Select an avatar collection (prebuilt mode) — max 1
  // All images in the collection become selectedAvatars
  const selectCollection = (collection) => {
    if (selectedCollectionId === collection.id) {
      // Deselect
      setSelectedCollectionId(null);
      setSelectedAvatars([]);
    } else {
      // Select this collection — all its images become selectedAvatars
      setSelectedCollectionId(collection.id);
      const avatarObjects = collection.images.map((img, i) => ({
        url: img.url,
        key: img.key,
        file: null,
        name: collection.name,
        angle: i === 0 ? "front" : i === 1 ? "three-quarter" : "side",
      }));
      setSelectedAvatars(avatarObjects);
    }
  };

  // Check if a collection is selected
  const isCollectionSelected = (collectionId) => {
    return selectedCollectionId === collectionId;
  };

  // Toggle avatar selection for upload/generate modes — max 1 avatar
  const toggleAvatarSelection = (avatar) => {
    setSelectedAvatars(prev => {
      if (!prev) return [avatar];
      
      const isSelected = prev.some(a => a?.url === avatar?.url || a?.key === avatar?.key);
      
      if (isSelected) {
        // Remove avatar
        return prev.filter(a => a?.url !== avatar?.url && a?.key !== avatar?.key);
      } else {
        // Replace with new avatar (max 1 in upload/generate modes)
        return [avatar];
      }
    });
  };

  // Clear all selected avatars
  const clearSelectedAvatars = () => {
    setSelectedAvatars([]);
    setSelectedCollectionId(null);
  };

  // Check if an avatar is selected
  const isAvatarSelected = (avatar) => {
    return (selectedAvatars || []).some(a => a?.url === avatar?.url || a?.key === avatar?.key);
  };

  const handleGenerateAvatars = async () => {
    if (!avatarPrompt.trim() || avatarPrompt.trim().length < 10) return;
    setGeneratingAvatar(true);
    setGeneratedAvatars([]);
    
    try {
      const res = await fetch("/api/product-video/generate-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: avatarPrompt.trim(), variants: avatarVariantCount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      
      // Convert generated images to avatar objects
      const generatedAvatarObjects = (data.images || []).map((img, index) => ({
        url: img.url,
        file: dataUrlToFile(img.url, `avatar-generated-${index}.png`),
        name: `Generated ${index + 1}`,
        angle: img.angle,
        variant: img.variant
      }));
      
      setGeneratedAvatars(generatedAvatarObjects);
      toast.success(`Generated ${data.images.length} avatar(s)!`);
    } catch (err) {
      toast.error("Avatar generation failed", { description: err.message });
    } finally {
      setGeneratingAvatar(false);
    }
  };

  const selectAvatarFromGeneration = (av, index) => {
    toggleAvatarSelection(av);
  };

  return {
    avatarMode,
    setAvatarMode,
    selectedAvatars,
    setSelectedAvatars,
    selectedCollectionId,
    setSelectedCollectionId,
    selectCollection,
    isCollectionSelected,
    toggleAvatarSelection,
    clearSelectedAvatars,
    isAvatarSelected,
    uploadedAvatarFile,
    setUploadedAvatarFile,
    avatarPrompt,
    setAvatarPrompt,
    avatarVariantCount,
    setAvatarVariantCount,
    generatedAvatars,
    generatingAvatar,
    reAvatars,
    reAvatarsLoading,
    reAvatarsError,
    lightboxUrl,
    setLightboxUrl,
    handleGenerateAvatars,
    selectAvatarFromGeneration,
    uploadedAvatarFiles,
    setUploadedAvatarFiles,
    handleUploadFile,
    selectUploadedAvatar,
    toggleUploadedAvatar,
    removeUploadedAvatar,
    fetchReAvatars,
    library,
    selectLibraryAvatar,
    deleteLibraryAvatar,
  };
};