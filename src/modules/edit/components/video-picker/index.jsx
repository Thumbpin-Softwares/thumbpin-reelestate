"use client";

import { useState } from "react";
import { Player } from "@remotion/player";
import {
  Check,
  CheckSquare,
  Eye,
  Loader2,
  Pencil,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EDITABLE_SOURCES, buildCompositionFromAsset } from "@/lib/editable-sources";
import { ActionReelComposition, calcActionReelDurationInFrames } from "@/lib/remotion/ActionReelComposition";
import { SeedanceReelComposition, calcSeedanceReelDurationInFrames } from "@/lib/remotion/SeedanceReelComposition";

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

  return { videos, setVideos, pagination, fetching, load };
}

export function VideoPicker({ onSelect, hideHeader = false, excludeIds = [] }) {
  const { videos: allVideos, setVideos, pagination, fetching, load } = useVideos();
  const [previewVideo, setPreviewVideo] = useState(null);
  // Multi-clip sources (asset.url is only the FIRST clip — the merged reel
  // isn't rendered until the editor's Export) get reconstructed and played as
  // a real Remotion composition here, instead of just the raw asset.url.
  const [previewComposition, setPreviewComposition] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectingId, setSelectingId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

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

  function closePreview() {
    setPreviewVideo(null);
    setPreviewComposition(null);
  }

  async function openPreview(video) {
    setPreviewVideo(video);
    setPreviewComposition(null);
    const sourceConfig = EDITABLE_SOURCES[video.metadata?.source];
    if (!sourceConfig) return; // single-clip asset — asset.url already is the whole video

    setPreviewLoading(true);
    try {
      const props = await buildCompositionFromAsset(video);
      if (!props) return;
      const isActionReelType = sourceConfig.compositionType === "action-reel";
      const durationInFrames = isActionReelType
        ? calcActionReelDurationInFrames({
            part1Duration: props.part1Duration,
            part2Duration: props.part2Duration,
          })
        : calcSeedanceReelDurationInFrames({
            avatarDuration: props.avatarDuration,
            brollClips:     props.brollClips,
            ctaDuration:    props.ctaDuration,
          });
      setPreviewComposition({ isActionReelType, props, durationInFrames });
    } catch (err) {
      console.error("[VideoPicker] Failed to build preview composition:", err);
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleDownload(url, name) {
    const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name || "video.mp4")}`;
    window.location.href = proxyUrl;
  }

  function toggleSelectMode() {
    setSelectMode((prev) => !prev);
    setSelectedIds(new Set());
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    try {
      const res = await fetch("/api/assets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");

      setVideos((prev) => (prev || []).filter((v) => !ids.includes(v.id)));
      toast.success(`${ids.length} video${ids.length !== 1 ? "s" : ""} deleted`);
    } catch (err) {
      toast.error("Delete failed", { description: err.message });
    } finally {
      setBulkDeleting(false);
      setBulkDeleteConfirmOpen(false);
      setSelectedIds(new Set());
      setSelectMode(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/assets?id=${pendingDelete.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete reel");
      }
      setVideos((prev) => (prev || []).filter((v) => v.id !== pendingDelete.id));
      toast.success("Reel deleted");
      setPendingDelete(null);
    } catch (err) {
      toast.error("Delete failed", { description: err.message });
    } finally {
      setDeleting(false);
    }
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

      {/* Select / bulk-delete toolbar */}
      {!loading && videos.length > 0 && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground tabular-nums">
            Showing {videos.length} of {pagination.total}
          </span>
          <div className="flex items-center gap-2 flex-wrap">
          {selectMode && (
            <>
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selected
              </span>
              <Button
                size="sm"
                variant="destructive"
                className="cursor-pointer"
                disabled={selectedIds.size === 0}
                onClick={() => setBulkDeleteConfirmOpen(true)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Delete Selected
              </Button>
            </>
          )}
          <Button variant="outline" className="cursor-pointer" onClick={toggleSelectMode}>
            <CheckSquare className="w-4 h-4 mr-2" />
            {selectMode ? "Cancel" : "Select"}
          </Button>
          </div>
        </div>
      )}

      {/* Video grid */}
      {!loading && videos.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {videos.map((video) => {
            const canEdit = !!EDITABLE_SOURCES[video.metadata?.source];
            const selected = selectedIds.has(video.id);
            return (
              <div
                key={video.id}
                onClick={() => { if (selectMode) toggleSelected(video.id); }}
                className={`group relative overflow-hidden rounded-3xl border bg-white/80 backdrop-blur-xl ring-1 shadow-[0_10px_40px_rgba(0,0,0,0.06)] hover:shadow-[0_20px_60px_rgba(199,240,56,0.18)] hover:-translate-y-1 transition-all duration-300 ${
                  selectMode ? "cursor-pointer" : ""
                } ${
                  selected ? "border-[#c7f038] ring-2 ring-[#c7f038]" : "border-white/60 ring-[#c7f038]/10 hover:ring-[#c7f038]/40"
                }`}
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
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" />

                  {selectMode ? (
                    <div
                      className={`absolute top-2 right-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        selected ? "bg-[#c7f038] border-[#c7f038]" : "bg-black/40 border-white/70"
                      }`}
                    >
                      {selected && <Check className="w-3.5 h-3.5 text-black" />}
                    </div>
                  ) : canEdit ? (
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
                          onClick={(e) => { e.stopPropagation(); openPreview(video); }}
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
                  {!selectMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setPendingDelete(video); }}
                      className="absolute top-2 left-2 z-10 h-8 w-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-white"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  )}
                </div>

                {/* Info */}
                <div className="p-5 bg-white/70 backdrop-blur-sm">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs" onClick={closePreview}>
          <div className="bg-white rounded-xl overflow-hidden w-xs mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 pb-2 pt-4 flex items-center justify-between border-b border-neutral-100">
              <p className="text-sm font-semibold truncate pr-4">{previewVideo.name || "Preview"}</p>
              <button onClick={closePreview} className="text-neutral-400 hover:text-black text-lg leading-none">✕</button>
            </div>
            <div className="px-4 pb-4">
              {previewVideo.url && (
                <div className="relative">
                  {previewLoading ? (
                    <div className="w-full aspect-9/16 max-h-[75vh] flex items-center justify-center bg-black rounded-md">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  ) : previewComposition ? (
                    // Full multi-clip reel, reconstructed from metadata — asset.url
                    // alone is only the first clip, so a plain <video> here would
                    // silently cut the preview off after part 1.
                    <div className="w-full max-h-[75vh] mx-auto rounded-md overflow-hidden bg-black" style={{ aspectRatio: "9/16" }}>
                      <Player
                        component={previewComposition.isActionReelType ? ActionReelComposition : SeedanceReelComposition}
                        inputProps={previewComposition.props}
                        durationInFrames={previewComposition.durationInFrames}
                        compositionWidth={1080}
                        compositionHeight={1920}
                        fps={30}
                        style={{ width: "100%", height: "100%" }}
                        controls
                        autoPlay
                        loop
                        clickToPlay
                      />
                    </div>
                  ) : (
                    <video src={previewVideo.url} controls autoPlay className="w-full rounded-md bg-black max-h-[75vh] object-contain" />
                  )}
                  <button
                    onClick={() => handleDownload(previewVideo.url, previewVideo.name)}
                    title={previewComposition ? "Download part 1 only — export the full reel from the editor" : "Download"}
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

      {/* Delete confirmation */}
      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this reel?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes &quot;{pendingDelete?.name || "this reel"}&quot; from your videos. This can&apos;t be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" disabled={deleting} onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDeleteConfirm} className="gap-2">
              {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirmation */}
      <Dialog open={bulkDeleteConfirmOpen} onOpenChange={(open) => !bulkDeleting && setBulkDeleteConfirmOpen(open)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} video{selectedIds.size !== 1 ? "s" : ""}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes the selected video{selectedIds.size !== 1 ? "s" : ""}. This can&apos;t be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" disabled={bulkDeleting} onClick={() => setBulkDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={bulkDeleting} onClick={handleBulkDelete} className="gap-2">
              {bulkDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Delete Selected
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
