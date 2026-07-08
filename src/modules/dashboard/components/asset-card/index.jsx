"use client";

import { Eye, Trash2, Loader2 } from "lucide-react";

export function AssetCard({
  asset,
  showDelete = false,
  isSelected = false,
  deleting = false,
  onSelect,
  onPreview,
  onDelete,
}) {
  return (
    <div
      className={`group rounded-lg overflow-hidden border bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer ${
        isSelected ? "border-primary ring-2 ring-primary" : "border-neutral-200"
      }`}
      onClick={onSelect}
    >
      <div className="relative aspect-square overflow-hidden">
        <img
          src={asset.url || asset.image_url}
          alt={asset.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/20 sm:bg-black/0 sm:group-hover:bg-black/20 transition-colors" />

        <button
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          className="absolute inset-0 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        >
          <div className="h-9 px-4 rounded-md bg-white/90 backdrop-blur flex items-center gap-2 shadow-md">
            <Eye className="w-4 h-4 text-black" />
            <span className="text-black text-sm font-medium">Preview</span>
          </div>
        </button>

        {showDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={deleting}
            className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-white"
          >
            {deleting ? (
              <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            )}
          </button>
        )}
      </div>
      <div className="p-4">
        <p className="font-medium text-sm line-clamp-1">{asset.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {asset.is_custom ? "Added by you" : "Library Asset"}
        </p>
      </div>
    </div>
  );
}
