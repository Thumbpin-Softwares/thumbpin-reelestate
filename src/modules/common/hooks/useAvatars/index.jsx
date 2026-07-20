import { useState, useEffect } from 'react';

export const useAvatars = () => {
  const [avatarMode, setAvatarMode] = useState("prebuilt");
  // selectedAvatars now stores all images from the selected collection/avatar
  const [selectedAvatars, setSelectedAvatars] = useState([]);
  // Track which collection is selected (for prebuilt mode)
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);
  // reAvatars now stores collections: [{id, name, coverImage, images: [...]}]
  const [reAvatars, setReAvatars] = useState([]);
  const [reAvatarsLoading, setReAvatarsLoading] = useState(false);
  const [reAvatarsError, setReAvatarsError] = useState(null);

  // Fetch RE avatars via SSE — collections appear one by one as they're resolved
  const fetchReAvatars = async () => {
    setReAvatarsLoading(true);
    setReAvatarsError(null);
    setReAvatars([]);

    try {
      const res = await fetch("/api/avatars/re");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          for (const line of block.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "avatar") {
                setReAvatars((prev) =>
                  prev.some((a) => a.id === event.avatar.id)
                    ? prev
                    : [...prev, event.avatar]
                );
                setReAvatarsLoading(false); // hide spinner on first card
              } else if (event.type === "done") {
                setReAvatarsLoading(false);
              } else if (event.type === "error") {
                setReAvatarsError(event.message || "Failed to load avatars");
                setReAvatarsLoading(false);
              }
            } catch (_) {}
          }
        }
      }
    } catch (err) {
      console.error("[RE Avatars] stream error:", err);
      setReAvatarsError("Failed to load avatars");
    } finally {
      setReAvatarsLoading(false);
    }
  };

  useEffect(() => {
    fetchReAvatars();
  }, []);

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

  // Clear all selected avatars
  const clearSelectedAvatars = () => {
    setSelectedAvatars([]);
    setSelectedCollectionId(null);
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
    clearSelectedAvatars,
    reAvatars,
    reAvatarsLoading,
    reAvatarsError,
    fetchReAvatars,
  };
};
