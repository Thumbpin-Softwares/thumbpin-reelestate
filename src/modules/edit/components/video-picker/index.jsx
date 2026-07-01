"use client";

import { useEffect, useState } from "react";
import {
  Download,
  ExternalLink,
  Eye,
  Loader2,
  Pencil,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EDITABLE_SOURCES, buildCompositionFromAsset } from "@/lib/editable-sources";

export function VideoPicker({ onSelect }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [previewVideo, setPreviewVideo] = useState(null);
  const [selectingId, setSelectingId] = useState(null);

  async function fetchVideos(page = 1) {
    setLoading(true);
    try {
      const res = await fetch(`/api/user/videos?page=${page}&limit=12`);
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos || []);
        setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
      }
    } catch (err) {
      console.error("Failed to fetch videos:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchVideos();
  }, []);

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

  return (
    <div className="space-y-6 animate-fade-in pt-12 bg-[#fafbfc]">
      <div>
        <h1 className="text-2xl font-semibold font-heading tracking-tight">Edit a video</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a video below to open it in the editor
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && videos.length === 0 && (
        <Card className="border border-dashed border-border/60">
          <CardContent className="py-16 text-center">
            <Video className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No videos yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Generate your first video to see it here
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && videos.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {videos.map((video) => {
            const canEdit = !!EDITABLE_SOURCES[video.metadata?.source];
            return (
              <Card
                key={video.id}
                className="group overflow-hidden border-border/50 bg-card hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <CardContent className="p-0">
                  <div className="relative aspect-video overflow-hidden bg-muted">
                    {video.url ? (
                      <video
                        src={video.url}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        preload="metadata"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-10 h-10 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    {video.url && (
                      <button
                        onClick={() => setPreviewVideo(video)}
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <div className="h-12 w-12 rounded-full bg-white/90 backdrop-blur flex items-center justify-center">
                          <Eye className="w-5 h-5 text-black" />
                        </div>
                      </button>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="font-medium text-sm line-clamp-1">{video.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(video.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <Badge variant="secondary" className="text-[11px]">
                        {canEdit ? "Editable" : video.type}
                      </Badge>

                      {canEdit ? (
                        <Button
                          size="sm"
                          className="gap-2 bg-neutral-900 text-[#c7f038]"
                          disabled={selectingId === video.id}
                          onClick={() => handleEditClick(video)}
                        >
                          {selectingId === video.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Pencil className="w-3.5 h-3.5" />
                          )}
                          Edit
                        </Button>
                      ) : (
                        video.url && (
                          <a href={video.url} download>
                            <Button variant="outline" size="sm" className="gap-2">
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </Button>
                          </a>
                        )
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!previewVideo} onOpenChange={() => setPreviewVideo(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-base font-semibold truncate pr-6">
              {previewVideo?.name || "Preview"}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-3">
            {previewVideo?.url && (
              <div className="w-full rounded-xl overflow-hidden bg-black">
                <video
                  src={previewVideo.url}
                  controls
                  autoPlay
                  className="w-full max-h-[70vh] object-contain"
                />
              </div>
            )}
            {previewVideo?.url && (
              <div className="flex gap-2 mt-3 justify-end">
                <a href={previewVideo.url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="text-xs cursor-pointer gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" /> Open
                  </Button>
                </a>
                <a href={previewVideo.url} download={previewVideo.name}>
                  <Button size="sm" className="text-xs cursor-pointer gap-1.5 gradient-bg text-white">
                    <Download className="w-3.5 h-3.5" /> Download
                  </Button>
                </a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer h-8 text-xs"
            disabled={pagination.page <= 1}
            onClick={() => fetchVideos(pagination.page - 1)}
          >
            Previous
          </Button>
          <Badge variant="secondary" className="text-xs">
            Page {pagination.page} of {pagination.totalPages}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer h-8 text-xs"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchVideos(pagination.page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
