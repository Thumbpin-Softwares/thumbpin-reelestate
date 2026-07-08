"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Eye, Trash2, Loader2, PenLine } from "lucide-react";

// Same design as the "Choose Your Presenter" step in the pipeline: a cover
// thumbnail with a "View" pill that only appears on hover (always visible on
// touch), opening a swipeable carousel with all the collection's photos.
// Used for both a user's own avatar collections (editable) and the shared RE
// Agents pool (view-only).
export function CollectionCard({
  name,
  images,
  coverUrl,
  editable = false,
  onRename,
  onDelete,
  deleting = false,
  onView,
}) {
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const cover = coverUrl || images[0]?.url;
  const count = images.length;

  async function save() {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      setNameValue(name);
      return;
    }
    setSaving(true);
    try {
      await onRename(trimmed);
      setEditing(false);
    } catch {
      toast.error("Rename failed");
      setNameValue(name);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="group relative rounded-2xl overflow-hidden bg-card shadow-sm hover:shadow-md transition-all">
      <div className="relative aspect-9/16 overflow-hidden">
        <Image
          src={cover}
          alt={name}
          fill
          unoptimized
          sizes="(max-width: 640px) 50vw, 25vw"
          className="object-cover"
        />
      </div>
      <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />

      {count > 1 && (
        <div className="absolute top-2 left-2 z-10 rounded-full bg-black/70 px-2 py-1 text-[10px] text-white">
          {count} photos
        </div>
      )}

      <div className="absolute inset-0 z-0 flex items-center justify-center bg-black/40 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onView(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black text-xs font-medium shadow-lg hover:bg-[#c7f038] transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          View
        </button>
      </div>

      {editable && (
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className="w-6 h-6 rounded-full flex items-center justify-center bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <PenLine className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            disabled={deleting}
            className="w-6 h-6 rounded-full flex items-center justify-center bg-black/50 text-white hover:bg-destructive transition-colors"
          >
            {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          </button>
        </div>
      )}

      {editing ? (
        <input
          ref={inputRef}
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setEditing(false); setNameValue(name); } }}
          className="absolute bottom-2 left-2 right-2 z-20 text-[11px] font-medium bg-black/70 text-white border-b border-white/60 outline-none px-1 py-0.5 rounded"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <p className="absolute bottom-2 left-2 right-2 z-10 text-[11px] text-white font-medium truncate pointer-events-none">
          {saving ? "Saving…" : name}
        </p>
      )}
    </div>
  );
}
