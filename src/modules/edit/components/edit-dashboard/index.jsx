"use client";

import { useState } from "react";
import { Pencil, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listDrafts, clearDraft } from "@/modules/edit/utils/draft";
import { VideoPicker } from "@/modules/edit/components/video-picker";

function thumbnailFor(draft) {
  return draft.compositionProps?.avatarVideoUrl || draft.compositionProps?.brollClips?.[0]?.url || "";
}

function timeAgo(ts) {
  const diff = Date.now() - (ts || 0);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Shown at /app/edit whenever no composition is currently open. Both
// "continue an existing draft" and "start editing a new clip" live on this
// one page — no separate screen to navigate to.
export function EditDashboard({ onOpen }) {
  const [drafts, setDrafts] = useState(() => listDrafts());
  const [pendingDelete, setPendingDelete] = useState(null);

  const draftAssetIds = drafts
    .map((d) => d.compositionProps?.assetId)
    .filter(Boolean);

  return (
    <div className="py-10 space-y-10 sm:px-8 px-0">
      <div className="border-b border-black pb-4">
        <h1 className="text-4xl font-heading tracking-tight">Edit a Video</h1>
        <p className="text-sm text-muted-foreground mt-1">Resume a saved draft, or pick a video below to start a new edit</p>
      </div>

      {drafts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Continue editing</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {drafts.map((draft) => {
              const thumb = thumbnailFor(draft);
              return (
                <div
                  key={draft.key}
                  className="group rounded-lg overflow-hidden border border-neutral-200 bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="relative aspect-video overflow-hidden">
                    {thumb ? (
                      <video src={thumb} className="w-full h-full object-cover" preload="metadata" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-8 h-8 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/20 sm:bg-black/0 sm:group-hover:bg-black/20 transition-colors" />
                    <button
                      onClick={() => onOpen(draft.compositionProps)}
                      className="absolute inset-0 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    >
                      <div className="h-9 px-4 rounded-md bg-white/90 backdrop-blur flex items-center gap-2 shadow-md">
                        <Pencil className="w-4 h-4 text-black" />
                        <span className="text-black text-sm font-medium">Resume</span>
                      </div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setPendingDelete(draft); }}
                      className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-white"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                  <div className="p-4">
                    <p className="font-medium text-sm line-clamp-1">{draft.compositionProps?.name || "Untitled reel"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Edited {timeAgo(draft.updatedAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {drafts.length > 0 && (
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Start a new edit</h2>
        )}
        <VideoPicker onSelect={onOpen} hideHeader={drafts.length > 0} excludeIds={draftAssetIds} />
      </div>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this draft?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes all overlays, music, cuts, trim, and captions saved for &quot;
            {pendingDelete?.compositionProps?.name || "this reel"}&quot;. This can&apos;t be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!pendingDelete) return;
                clearDraft(pendingDelete.key);
                setDrafts(listDrafts());
                setPendingDelete(null);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
