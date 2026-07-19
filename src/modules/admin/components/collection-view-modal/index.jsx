"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Trash2,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Star,
} from "lucide-react";

// Collection View Modal — full-file gallery for a real estate avatar collection.
export function CollectionViewModal({ collection, onClose, onDelete, onThumbnailSet }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [settingThumbnail, setSettingThumbnail] = useState(false);
  const [thumbnailKey, setThumbnailKey] = useState(collection.thumbnailKey || null);

  // Safety check
  if (!collection || !collection.files || collection.files.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Invalid Collection</h3>
            <p className="text-gray-600 mb-4">This collection has no images or is corrupted.</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  async function handleSetThumbnail(fileKey) {
    if (settingThumbnail || thumbnailKey === fileKey) return;
    setSettingThumbnail(true);
    try {
      const res = await fetch("/api/admin/avatars", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionId: collection.id, thumbnailKey: fileKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setThumbnailKey(fileKey);
      onThumbnailSet?.(collection.id, fileKey, data.coverImage);
      toast.success("Thumbnail updated");
    } catch {
      toast.error("Failed to set thumbnail");
    } finally {
      setSettingThumbnail(false);
    }
  }

  async function handleDeleteCollection() {
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/avatars", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionId: collection.id,
          type: collection.type
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Deleted collection "${collection.name}"`);
      onDelete(collection.id);
      onClose();
    } catch (err) {
      toast.error("Failed to delete collection");
    } finally {
      setDeleting(false);
    }
  }

  function nextImage() {
    setCurrentIndex((prev) => (prev + 1) % collection.files.length);
  }

  function prevImage() {
    setCurrentIndex((prev) => (prev - 1 + collection.files.length) % collection.files.length);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{collection.name}</h2>
            <p className="text-sm text-gray-500">
              {collection.fileCount} images
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteCollection}
              disabled={deleting}
              className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
              title="Delete Collection"
            >
              {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image Gallery */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Main Image with Navigation */}
          <div className="relative mb-6">
            {collection.files.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all z-10"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all z-10"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            <img
              src={collection.files[currentIndex]?.url}
              alt={`Image ${currentIndex + 1}`}
              className="w-full h-auto max-h-[60vh] object-contain rounded-lg bg-gray-100"
              onError={(e) => {
                e.target.src = "https://placehold.co/800x600?text=Image+Not+Found";
              }}
            />

            {/* Image Counter */}
            {collection.files.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                {currentIndex + 1} / {collection.files.length}
              </div>
            )}
          </div>

          {/* Set as thumbnail button for current image */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => handleSetThumbnail(collection.files[currentIndex]?.key)}
              disabled={settingThumbnail || thumbnailKey === collection.files[currentIndex]?.key || (!thumbnailKey && currentIndex === 0)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
            >
              {settingThumbnail ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Star className={`w-3.5 h-3.5 ${thumbnailKey === collection.files[currentIndex]?.key || (!thumbnailKey && currentIndex === 0) ? "fill-amber-400 text-amber-400" : ""}`} />
              )}
              {thumbnailKey === collection.files[currentIndex]?.key || (!thumbnailKey && currentIndex === 0)
                ? "Current thumbnail"
                : "Set as thumbnail"}
            </button>
          </div>

          {/* Thumbnails */}
          {collection.files.length > 1 && (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
              {collection.files.map((file, idx) => {
                const isThumb = thumbnailKey ? thumbnailKey === file.key : idx === 0;
                return (
                  <div key={file.id || idx} className="relative group">
                    <button
                      onClick={() => setCurrentIndex(idx)}
                      className={`relative w-full aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        currentIndex === idx
                          ? "border-gray-900 ring-2 ring-gray-900/20"
                          : "border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      <img
                        src={file.url}
                        alt={`Thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = "https://placehold.co/100x100?text=Error";
                        }}
                      />
                    </button>
                    {/* Star badge — filled if this is the thumbnail */}
                    <button
                      onClick={() => handleSetThumbnail(file.key)}
                      disabled={settingThumbnail || isThumb}
                      title={isThumb ? "Collection thumbnail" : "Set as thumbnail"}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-black/50 hover:bg-black/80 transition-all disabled:cursor-default opacity-0 group-hover:opacity-100 disabled:opacity-100"
                    >
                      <Star className={`w-3 h-3 ${isThumb ? "fill-amber-400 text-amber-400" : "text-white"}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
