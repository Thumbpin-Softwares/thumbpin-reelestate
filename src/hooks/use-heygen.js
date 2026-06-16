import { useState, useCallback, useEffect } from "react";

let avatarsCache = null;
let voicesCache = null;

export function useHeygen() {
  const [avatars, setAvatars] = useState(avatarsCache || []);
  const [photoAvatars, setPhotoAvatars] = useState([]);
  const [voices, setVoices] = useState(voicesCache || []);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAvatars = useCallback(async (force = false) => {
    if (avatarsCache && !force) return;
    setLoading(true);
    try {
      const res = await fetch("/api/heygen/avatars");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch avatars");
      const items = data.data?.avatars || [];
      avatarsCache = items;
      setAvatars(items);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, []);

  const fetchVoices = useCallback(async (force = false) => {
    if (voicesCache && !force) return;
    try {
      const res = await fetch("/api/heygen/voices");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch voices");
      const items = data.data?.voices || [];
      voicesCache = items;
      setVoices(items);
    } catch (err) { console.error("fetchVoices error:", err); }
  }, []);

  const fetchPhotoAvatars = useCallback(async () => {
    try {
      const res = await fetch("/api/avatar/list-groups");
      const data = await res.json();
      if (res.ok) setPhotoAvatars(data.groups || []);
    } catch (err) { console.error("fetchPhotoAvatars error:", err); }
  }, []);

  const uploadTalkingPhoto = async (file) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/heygen/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      return { success: true, talking_photo_id: data.talking_photo_id };
    } catch (err) {
      console.error("uploadTalkingPhoto error:", err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally { setUploading(false); }
  };

  useEffect(() => {
    fetchAvatars();
    fetchVoices();
    fetchPhotoAvatars();
  }, [fetchAvatars, fetchVoices, fetchPhotoAvatars]);

  return {
    avatars,
    photoAvatars,
    voices,
    loading: loading && avatars.length === 0,
    uploading,
    error,
    refreshAvatars: () => { fetchAvatars(true); fetchPhotoAvatars(); },
    refreshVoices: () => fetchVoices(true),
    uploadTalkingPhoto,
  };
}
