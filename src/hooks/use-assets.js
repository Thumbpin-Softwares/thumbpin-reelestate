"use client";

import { useEffect, useState, useCallback, useRef } from "react";

const LIMIT = 24;

function mapAsset(a) {
  return {
    id: a._id,
    name: a.name,
    url: a.url,
    type: a.type,
    is_custom: true,
    metadata: a.metadata || {},
    image_url: a.url,
    ethnicity: a.metadata?.ethnicity || "Custom",
  };
}

export function useAssets(typeFilter = null) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const pageRef = useRef(1);

  const buildUrl = useCallback(
    (page) => {
      let url = `/api/assets?page=${page}&limit=${LIMIT}`;
      if (typeFilter) url += `&type=${typeFilter}`;
      return url;
    },
    [typeFilter]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    pageRef.current = 1;
    try {
      const res = await fetch(buildUrl(1));
      const data = await res.json();

      if (!res.ok) {
        setFetchError(`${res.status}: ${data.error || "Failed to fetch assets"}`);
        return;
      }

      setFetchError(null);
      setAssets((data.assets || []).map(mapAsset));
      setHasMore(data.hasMore || false);
    } catch (error) {
      setFetchError(error.message);
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = pageRef.current + 1;
    pageRef.current = nextPage;
    try {
      const res = await fetch(buildUrl(nextPage));
      const data = await res.json();

      if (!res.ok) {
        setFetchError(`${res.status}: ${data.error || "Failed to fetch assets"}`);
        return;
      }

      setFetchError(null);
      setAssets((prev) => [...prev, ...(data.assets || []).map(mapAsset)]);
      setHasMore(data.hasMore || false);
    } catch (error) {
      setFetchError(error.message);
    } finally {
      setLoadingMore(false);
    }
  }, [buildUrl, hasMore, loadingMore]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function uploadAsset(file, name, type = "general", category = "general") {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name);
      formData.append("type", type);
      formData.append("category", category);

      const uploadRes = await fetch("/api/assets/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error);

      await fetchData();
      return { success: true, asset: uploadData.asset };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setUploading(false);
    }
  }

  async function deleteAsset(id) {
    try {
      const res = await fetch(`/api/assets?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await fetchData();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return {
    assets,
    avatars: assets.filter((a) => a.type === "avatar" || a.type === "presenter"),
    customAvatars: assets.filter((a) => a.type === "avatar" || a.type === "presenter"),
    libraryAvatars: [],
    productImages: assets.filter((a) => a.type === "product" || a.type === "image"),
    backgrounds: assets.filter((a) => a.type === "background"),
    composites: assets.filter((a) => a.type === "composite"),
    videos: assets.filter((a) => a.type === "video" || a.type === "clip"),
    voices: [],
    loading,
    loadingMore,
    hasMore,
    uploading,
    fetchError,
    uploadAsset,
    deleteAsset,
    loadMore,
    refetch: fetchData,
  };
}

export function useAvatarsAndVoices() {
  const { avatars, customAvatars, loading, uploading, uploadAsset, deleteAsset, refetch } =
    useAssets("avatar");

  return {
    avatars,
    customAvatars,
    libraryAvatars: [],
    voices: [],
    loading,
    uploading,
    uploadAvatar: (file, name) => uploadAsset(file, name, "avatar"),
    deleteAvatar: deleteAsset,
    refetch,
  };
}
