"use client";

import { useEffect, useState, useCallback, useRef } from "react";

const LIMIT_DESKTOP = 24;
const LIMIT_MOBILE = 6;

function getLimit() {
  if (typeof window !== "undefined" && window.innerWidth < 640) return LIMIT_MOBILE;
  return LIMIT_DESKTOP;
}

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
      let url = `/api/assets?page=${page}&limit=${getLimit()}`;
      if (typeFilter) url += `&type=${typeFilter}`;
      return url;
    },
    [typeFilter]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    pageRef.current = 1;
    try {
      const res = await fetch(buildUrl(1), { cache: "no-store" });
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
      const res = await fetch(buildUrl(nextPage), { cache: "no-store" });
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

  /**
   * Uploads straight from the browser to R2 via a presigned URL instead of
   * routing the file through this app's serverless function — Vercel caps
   * function request bodies at 4.5MB, which a real photo/avatar upload can
   * easily exceed and previously surfaced as a raw "Content Too Large" 413.
   */
  async function uploadAsset(file, name, type = "general", category = "general") {
    setUploading(true);
    try {
      const urlRes = await fetch("/api/assets/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, fileSize: file.size, category }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error(urlData.error);

      const putRes = await fetch(urlData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Upload to storage failed");

      const confirmRes = await fetch("/api/assets/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: urlData.key,
          url: urlData.publicUrl,
          name,
          type,
          originalName: file.name || "",
        }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) throw new Error(confirmData.error);

      await fetchData();
      return { success: true, asset: confirmData.asset };
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

  async function bulkDeleteAssets(ids) {
    try {
      const res = await fetch("/api/assets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      await fetchData();
      return { success: true, deletedCount: data.deletedCount };
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
    bulkDeleteAssets,
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
