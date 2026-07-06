"use client";

import { useState } from "react";
import {
  Eye,
  Loader2,
  Pencil,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EDITABLE_SOURCES, buildCompositionFromAsset } from "@/lib/editable-sources";

function useVideos() {
  const [videos, setVideos] = useState(null); // null = loading
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [fetching, setFetching] = useState(false);

  async function load(page = 1) {
    setFetching(true);
    try {
      const res = await fetch(`/api/user/videos?page=${page}&limit=12`);
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos || []);
        setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
      }
    } catch (err) {
      console.error("Failed to fetch videos:", err);
      setVideos([]);
    } finally {
      setFetching(false);
    }
  }

  // Trigger initial load once on first render via a lazy ref trick
  const [started, setStarted] = useState(false);
  if (!started) {
    setStarted(true);
    load(1);
  }

  return { videos, pagination, fetching, load };
}

export function VideoPicker({ onSelect, hideHeader = false, excludeIds = [] }) {
  const { videos: allVideos, pagination, fetching, load } = useVideos();
  const [previewVideo, setPreviewVideo] = useState(null);
  const [selectingId, setSelectingId] = useState(null);

  const videos = allVideos && excludeIds.length > 0
    ? allVideos.filter((v) => !excludeIds.includes(v.id))
    : allVideos;

  async function handleEditClick(video) {
    if (selectingId) return;
    setSelectingId(video.id);
    try {
      const compositionProps = await buildCompositionFromAsset(video);
      if (!compositionProps) return;
      onSelect(compositionProps);
    } finally {
      setSelectingId(null);
    }
  }

  function handleDownload(url, name) {
    const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name || "video.mp4")}`;
    window.location.href = proxyUrl;
  }

  const loading = videos === null;

  return (
    <div className={hideHeader ? "space-y-6" : "py-10 space-y-6 sm:px-8 px-0"}>
      {/* Header */}
      {!hideHeader && (
        <div className="border-b border-black pb-4">
          <h1 className="text-4xl font-heading tracking-tight">Edit a Video</h1>
          <p className="text-sm text-muted-foreground mt-1">Pick a video below to open it in the editor</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && videos.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/60 py-20 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Video className="w-6 h-6 text-muted-foreground/50" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">No videos yet</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Generate your first video to see it here</p>
          </div>
        </div>
      )}

      {/* Video grid */}
      {!loading && videos.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {videos.map((video) => {
            const canEdit = !!EDITABLE_SOURCES[video.metadata?.source];
            return (
              <div
                key={video.id}
                className="group rounded-lg overflow-hidden border border-neutral-200 bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video overflow-hidden">
                  {video.url ? (
                    <video
                      src={video.url}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      preload="metadata"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 sm:bg-black/0 sm:group-hover:bg-black/20 transition-colors" />
                  {canEdit ? (
                    <>
                      <button
                        onClick={() => handleEditClick(video)}
                        disabled={!!selectingId}
                        className="absolute inset-0 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      >
                        <div className="h-9 px-4 rounded-md bg-white/90 backdrop-blur flex items-center gap-2 shadow-md">
                          {selectingId === video.id ? (
                            <Loader2 className="w-4 h-4 text-black animate-spin" />
                          ) : (
                            <Pencil className="w-4 h-4 text-black" />
                          )}
                          <span className="text-black text-sm font-medium">Edit</span>
                        </div>
                      </button>
                      {video.url && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewVideo(video); }}
                          className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        >
                          <Eye className="w-3.5 h-3.5 text-black" />
                        </button>
                      )}
                    </>
                  ) : video.url && (
                    <button
                      onClick={() => setPreviewVideo(video)}
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <div className="h-11 w-11 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-md">
                        <Eye className="w-4 h-4 text-black" />
                      </div>
                    </button>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <p className="font-medium text-sm line-clamp-1">{video.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(video.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2 sm:pb-0 pb-8">
          <Button
            variant="outline"
            size="sm"
            className="bg-neutral-900 text-[#c7f038] hover:opacity-90 hover:bg-neutral-900 shadow-lg gap-2 px-6"
            disabled={fetching || pagination.page <= 1}
            onClick={() => load(pagination.page - 1)}
          >
            Prev
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums px-1">
            {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="bg-neutral-900 text-[#c7f038] hover:opacity-90 hover:bg-neutral-900 shadow-lg gap-2 px-6"
            disabled={fetching || pagination.page >= pagination.totalPages}
            onClick={() => load(pagination.page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Preview modal */}
      {!!previewVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs" onClick={() => setPreviewVideo(null)}>
          <div className="bg-white rounded-xl overflow-hidden w-xs mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 pb-2 pt-4 flex items-center justify-between border-b border-neutral-100">
              <p className="text-sm font-semibold truncate pr-4">{previewVideo.name || "Preview"}</p>
              <button onClick={() => setPreviewVideo(null)} className="text-neutral-400 hover:text-black text-lg leading-none">✕</button>
            </div>
            <div className="px-4 pb-4">
              {previewVideo.url && (
                <div className="relative">
                  <video src={previewVideo.url} controls autoPlay className="w-full rounded-md bg-black max-h-[75vh] object-contain" />
                  <button
                    onClick={() => handleDownload(previewVideo.url, previewVideo.name)}
                    className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-md hover:bg-white transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
