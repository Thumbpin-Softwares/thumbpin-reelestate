"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  Play,
  ChevronLeft,
  ChevronRight,
  Video,
  ExternalLink,
  Eye,
  Calendar,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function HistoryPage() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const [view, setView] = useState("table");
  const [previewVideo, setPreviewVideo] = useState(null);

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
    async function load() {
      await fetchVideos();
    }
    load();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in pt-12 bg-[#fafbfc]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold font-heading tracking-tight">
            Video Generation History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading
              ? "Loading..."
              : `So far generated ${pagination.total} video${pagination.total !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === "table" ? "default" : "outline"}
            size="sm"
            className={
              view === "table"
                ? "bg-neutral-900 text-[#c7f038] border hover:bg-neutral-900 border-neutral-900"
                : "bg-none border hover:bg-neutral-900 hover:text-[#c7f038] duration-300 border-neutral-200"
            }
            onClick={() => setView("table")}
          >
            Table
          </Button>
          <Button
            variant={view === "grid" ? "default" : "outline"}
            size="sm"
            className={
              view === "grid"
                ? "bg-neutral-900 border border-neutral-900 hover:bg-neutral-900 text-[#c7f038]"
                : "bg-none border hover:bg-neutral-900 hover:text-[#c7f038] duration-300 border-neutral-200"
            }
            onClick={() => setView("grid")}
          >
            Grid
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && videos.length === 0 && (
        <Card className="border border-dashed border-border/60">
          <CardContent className="py-16 text-center">
            <Video className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              No videos yet
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Generate your first video to see it here
            </p>
          </CardContent>
        </Card>
      )}

      {/* Table View */}
      {!loading && videos.length > 0 && view === "table" && (
        <Card className="border border-border/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {videos.map((video) => (
                  <TableRow key={video.id}>
                    <TableCell>
                      <div className="w-9 h-9 rounded-md bg-neutral-900 flex items-center justify-center">
                        <Play className="w-3.5 h-3.5 text-[#c7f03a]" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium truncate max-w-62.5">
                        {video.name}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {video.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(video.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {video.url && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 cursor-pointer"
                              onClick={() => setPreviewVideo(video)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <a
                              href={video.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 cursor-pointer"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </a>
                            <a href={video.url} download>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 cursor-pointer"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </a>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Grid View */}
      {!loading && videos.length > 0 && view === "grid" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {videos.map((video) => (
            <Card
              key={video.id}
              className="group overflow-hidden border-border/50 bg-card hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <CardContent className="p-0">
                {/* Thumbnail */}
                <div className="relative aspect-video overflow-hidden bg-muted">
                  {video.url ? (
                    <video
                      src={video.url}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      preload="metadata"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="w-10 h-10 text-muted-foreground/40" />
                    </div>
                  )}

                  {/* Dark Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />

                  {/* Preview Button */}
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

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-medium text-sm line-clamp-1">
                    {video.name}
                  </h3>

                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {new Date(video.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <Badge variant="secondary" className="text-[11px]">
                      Generated
                    </Badge>

                    {video.url && (
                      <a href={video.url} download>
                        <Button variant="outline" size="sm" className="gap-2 bg-neutral-900 text-[#c6f12f]">
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
            {previewVideo?.url ? (
              previewVideo.type === "composite" ||
              previewVideo.url.match(/\.(png|jpg|jpeg|webp|gif)(\?|$)/i) ? (
                <div className="w-full rounded-xl overflow-hidden bg-muted flex items-center justify-center">
                  <img
                    src={previewVideo.url}
                    alt={previewVideo.name}
                    className="max-h-[70vh] w-auto mx-auto rounded-xl object-contain"
                  />
                </div>
              ) : (
                <div className="w-full rounded-xl overflow-hidden bg-black">
                  <video
                    src={previewVideo.url}
                    controls
                    autoPlay
                    className="w-full max-h-[70vh] object-contain"
                  />
                </div>
              )
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No preview available for this asset.
              </div>
            )}
            {previewVideo?.url && (
              <div className="flex gap-2 mt-3 justify-end">
                <a
                  href={previewVideo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs cursor-pointer gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open
                  </Button>
                </a>
                <a href={previewVideo.url} download={previewVideo.name}>
                  <Button
                    size="sm"
                    className="text-xs cursor-pointer gap-1.5 gradient-bg text-white"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </Button>
                </a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer h-8 text-xs"
            disabled={pagination.page <= 1}
            onClick={() => fetchVideos(pagination.page - 1)}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
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
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
