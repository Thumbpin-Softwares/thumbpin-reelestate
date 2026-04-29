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
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
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
    fetchVideos();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold font-heading tracking-tight">Video History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Loading..." : `${pagination.total} video${pagination.total !== 1 ? "s" : ""} generated`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === "table" ? "default" : "outline"}
            size="sm"
            className="cursor-pointer h-8 text-xs"
            onClick={() => setView("table")}
          >
            Table
          </Button>
          <Button
            variant={view === "grid" ? "default" : "outline"}
            size="sm"
            className="cursor-pointer h-8 text-xs"
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
            <p className="text-sm font-medium text-muted-foreground">No videos yet</p>
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
                      <div className="w-9 h-9 rounded-md bg-primary/5 flex items-center justify-center">
                        <Play className="w-3.5 h-3.5 text-primary" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium truncate max-w-62.5">{video.name}</p>
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
                            <a href={video.url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer">
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </a>
                            <a href={video.url} download>
                              <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer">
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((video) => (
            <Card key={video.id} className="group border border-border/50 hover:shadow-md transition-all overflow-hidden">
              <CardContent className="p-0">
                <div className="aspect-video bg-linear-to-br from-primary/5 to-primary/10 relative flex items-center justify-center">
                  {video.url ? (
                    <video
                      src={video.url}
                      className="w-full h-full object-cover"
                      preload="metadata"
                    />
                  ) : (
                    <Play className="w-8 h-8 text-muted-foreground/30" />
                  )}
                  {video.url && (
                    <button
                      onClick={() => setPreviewVideo(video)}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Eye className="w-4 h-4 text-white" />
                    </button>
                  )}
                </div>
                <div className="p-3 space-y-1.5">
                  <p className="text-sm font-medium line-clamp-1">{video.name}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {new Date(video.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                    {video.url && (
                      <a href={video.url} download>
                        <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer">
                          <Download className="w-3.5 h-3.5" />
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Video Preview</DialogTitle>
          </DialogHeader>
          {previewVideo?.url ? (
            <div className="w-full rounded-xl overflow-hidden bg-black">
              <video src={previewVideo.url} controls className="w-full h-full" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No preview available.</p>
          )}
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
