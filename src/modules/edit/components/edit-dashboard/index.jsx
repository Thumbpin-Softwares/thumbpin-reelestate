"use client";

import { useState } from "react";
import { Check, CheckSquare, Pencil, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listDrafts, clearDraft } from "@/modules/edit/utils/draft";
import { VideoPicker } from "@/modules/edit/components/video-picker";

function thumbnailFor(draft) {
  return (
    draft.compositionProps?.avatarVideoUrl ||
    draft.compositionProps?.brollClips?.[0]?.url ||
    draft.compositionProps?.part1VideoUrl ||
    ""
  );
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

// Shown at /dashboard/edit whenever no composition is currently open. Both
// "continue an existing draft" and "start editing a new clip" live on this
// one page — no separate screen to navigate to.
export function EditDashboard({ onOpen }) {
  const [drafts, setDrafts] = useState(() => listDrafts());
  const [pendingDelete, setPendingDelete] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const draftAssetIds = drafts
    .map((d) => d.compositionProps?.assetId)
    .filter(Boolean);

  function toggleSelectMode() {
    setSelectMode((prev) => !prev);
    setSelectedKeys(new Set());
  }

  function toggleSelected(key) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleBulkDelete() {
    for (const key of selectedKeys) clearDraft(key);
    setDrafts(listDrafts());
    setBulkDeleteConfirmOpen(false);
    setSelectedKeys(new Set());
    setSelectMode(false);
  }

  return (
    <div className="py-10 space-y-10">
      <div className="flex flex-col pt-4">
        <h1 className="text-2xl sm:text-4xl font-light">Edit a Video</h1>
        <p className="text-muted-foreground mt-1">Resume a saved draft, or pick a video below to start a new edit</p>
      </div>

      {drafts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Continue editing</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {selectMode && (
                <>
                  <span className="text-sm text-muted-foreground">
                    {selectedKeys.size} selected
                  </span>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="cursor-pointer"
                    disabled={selectedKeys.size === 0}
                    onClick={() => setBulkDeleteConfirmOpen(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Delete Selected
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" className="cursor-pointer" onClick={toggleSelectMode}>
                <CheckSquare className="w-4 h-4 mr-2" />
                {selectMode ? "Cancel" : "Select"}
              </Button>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {drafts.map((draft) => {
              const thumb = thumbnailFor(draft);
              const selected = selectedKeys.has(draft.key);
              return (
                <div
                  key={draft.key}
                  onClick={() => { if (selectMode) toggleSelected(draft.key); }}
                  className={`group relative rounded-3xl overflow-hidden border bg-white/80 backdrop-blur-xl ring-1 shadow-[0_10px_40px_rgba(0,0,0,0.06)] hover:shadow-[0_20px_60px_rgba(199,240,56,0.18)] hover:-translate-y-1 transition-all duration-300 ${
                    selectMode ? "cursor-pointer" : ""
                  } ${
                    selected ? "border-[#c7f038] ring-2 ring-[#c7f038]" : "border-white/60 ring-[#c7f038]/10 hover:ring-[#c7f038]/40"
                  }`}
                >
                  <div className="relative aspect-video overflow-hidden">
                    {thumb ? (
                      <video src={thumb} className="w-full h-full object-cover" preload="metadata" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-8 h-8 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-linear-to-t from-black/35 via-transparent to-transparent opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" />

                    {selectMode ? (
                      <div
                        className={`absolute top-2 right-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          selected ? "bg-[#c7f038] border-[#c7f038]" : "bg-black/40 border-white/70"
                        }`}
                      >
                        {selected && <Check className="w-3.5 h-3.5 text-black" />}
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => onOpen(draft.compositionProps)}
                          className="absolute inset-0 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        >
                          <div className="h-10 px-5 rounded-xl bg-[#c7f038] text-black backdrop-blur flex items-center gap-2 shadow-lg font-medium">
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
                      </>
                    )}
                  </div>
                  <div className="p-5 bg-white/70 backdrop-blur-sm">
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
        <VideoPicker onSelect={onOpen} hideHeader excludeIds={draftAssetIds} />
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl border border-white/20 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Delete this draft?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This removes all overlays, music, cuts, trim, and captions saved for &quot;{pendingDelete.compositionProps?.name || "this reel"}&quot;. This can&apos;t be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPendingDelete(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => {
                clearDraft(pendingDelete.key);
                setDrafts(listDrafts());
                setPendingDelete(null);
              }}>Delete</Button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl border border-white/20 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Delete {selectedKeys.size} draft{selectedKeys.size !== 1 ? "s" : ""}?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This removes all overlays, music, cuts, trim, and captions saved for the selected draft{selectedKeys.size !== 1 ? "s" : ""}. This can&apos;t be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setBulkDeleteConfirmOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleBulkDelete}>Delete Selected</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
