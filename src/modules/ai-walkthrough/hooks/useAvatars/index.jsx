import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { dataUrlToFile } from '../../helpers/fileHelpers';

export const useAvatars = () => {
  const [avatarMode, setAvatarMode] = useState("prebuilt");
  const [selectedAvatars, setSelectedAvatars] = useState([]);
  const [uploadedAvatarFile, setUploadedAvatarFile] = useState(null);
  const [avatarPrompt, setAvatarPrompt] = useState("");
  const [avatarVariantCount, setAvatarVariantCount] = useState(3); // Changed default to 3
  const [generatedAvatars, setGeneratedAvatars] = useState([]);
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [reAvatars, setReAvatars] = useState([]);
  const [reAvatarsLoading, setReAvatarsLoading] = useState(false);
  const [reAvatarsError, setReAvatarsError] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  // Fetch RE avatars
  useEffect(() => {
    if (avatarMode !== "prebuilt") return;
    let cancelled = false;
    setReAvatarsLoading(true);
    setReAvatarsError(null);
    
    fetch("/api/avatars/re")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setReAvatars(data.avatars ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[RE Avatars] fetch error:", err);
        setReAvatarsError("Failed to load avatars");
      })
      .finally(() => { if (!cancelled) setReAvatarsLoading(false); });
      
    return () => { cancelled = true; };
  }, [avatarMode]);

  // Helper to toggle avatar selection (max 3)
  const toggleAvatarSelection = (avatar) => {
    setSelectedAvatars(prev => {
      if (!prev) return [avatar];
      
      const isSelected = prev.some(a => a?.url === avatar?.url || a?.key === avatar?.key);
      
      if (isSelected) {
        // Remove avatar
        return prev.filter(a => a?.url !== avatar?.url && a?.key !== avatar?.key);
      } else if (prev.length < 3) {
        // Add avatar if less than 3
        return [...prev, avatar];
      } else {
        toast.warning("Maximum 3 avatars can be selected");
        return prev;
      }
    });
  };

  // Clear all selected avatars
  const clearSelectedAvatars = () => {
    setSelectedAvatars([]);
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
    // Instead of setting single, toggle selection
    toggleAvatarSelection(av);
  };

  return {
    avatarMode,
    setAvatarMode,
    selectedAvatars,
    setSelectedAvatars,
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
    selectAvatarFromGeneration
  };
};