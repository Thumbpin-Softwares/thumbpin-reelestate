"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssets } from "@/hooks/use-assets";
import { toast } from "sonner";
import {
  Search,
  Upload,
  Eye,
  Trash2,
  Loader2,
  ImagePlus,
  PenLine,
  ChevronLeft,
  ChevronRight,
  Star,
  X,
} from "lucide-react";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// ─── Collection Card ──────────────────────────────────────────────────────────
// Same design as the "Choose Your Presenter" step in the pipeline: a cover
// thumbnail with a "View" pill that only appears on hover (always visible on
// touch), opening a swipeable carousel with all the collection's photos.
// Used for both your own avatar collections (editable) and the shared RE
// Agents pool (view-only).
function CollectionCard({
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
    <div className="group relative rounded-2xl overflow-hidden border-2 border-border/40 hover:border-[#c7f038] bg-card shadow-sm hover:shadow-md transition-all">
      <div className="aspect-[4/5] overflow-hidden">
        <img src={cover} alt={name} className="w-full h-full object-cover" />
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

// ─── Avatar Collection Upload Modal ──────────────────────────────────────────
function AvatarCollectionModal({ open, onClose, onUploaded }) {
  const [items, setItems] = useState([]);
  const [collectionName, setCollectionName] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const MAX = 4;

  function addFiles(files) {
    const incoming = Array.from(files)
      .filter((f) => ALLOWED_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE)
      .slice(0, MAX - items.length);

    if (Array.from(files).some((f) => f.size > MAX_FILE_SIZE)) {
      toast.error("Some files were skipped — max 10 MB each");
    }

    const next = incoming.map((f) => ({
      file: f,
      preview: URL.createObjectURL(f),
    }));
    setItems((prev) => [...prev, ...next].slice(0, MAX));
  }

  function removeItem(i) {
    setItems((prev) => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, idx) => idx !== i);
    });
  }

  async function handleUpload() {
    if (!items.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      items.forEach((item, i) => fd.append(`presenterImage_${i}`, item.file));
      fd.append("name", collectionName.trim() || `My Avatars — ${new Date().toLocaleDateString()}`);

      const res = await fetch("/api/veo-long-ad/presenter/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      toast.success(`Collection "${data.name}" saved!`);
      onUploaded();
      handleClose();
    } catch (err) {
      toast.error("Upload failed", { description: err.message });
    } finally {
      setUploading(false);
    }
  }

  function handleClose() {
    if (uploading) return;
    items.forEach((it) => URL.revokeObjectURL(it.preview));
    setItems([]);
    setCollectionName("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImagePlus className="w-4 h-4" />
            Upload Avatar Collection
          </DialogTitle>
          <DialogDescription>
            Group up to 4 photos of the same person — saved as one collection for use in ad generation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          {items.length < MAX && (
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              onClick={() => inputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
              onDragOver={(e) => e.preventDefault()}
            >
              <ImagePlus className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium">Click or drag images here</p>
              <p className="text-xs text-muted-foreground mt-1">
                JPEG, PNG, WebP · max 10 MB each · {MAX - items.length} slot{MAX - items.length !== 1 ? "s" : ""} remaining
              </p>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>
          )}

          {/* Preview grid */}
          {items.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {items.map((item, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                  <img src={item.preview} alt="" className="w-full h-full object-cover" />
                  {!uploading && (
                    <button
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeItem(i)}
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Collection name */}
          {items.length > 0 && (
            <Input
              placeholder="Collection name (e.g. Johns Photos)"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              disabled={uploading}
            />
          )}

          <Button
            className="w-full bg-neutral-900 text-[#c7f038] cursor-pointer"
            onClick={handleUpload}
            disabled={items.length === 0 || uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading collection...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Save as Collection{items.length > 0 ? ` (${items.length} photo${items.length !== 1 ? "s" : ""})` : ""}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function AssetLibraryPage() {
  const {
    assets,
    avatars,
    customAvatars,
    libraryAvatars,
    productImages,
    loading,
    loadingMore,
    hasMore,
    uploading,
    fetchError,
    uploadAsset,
    deleteAsset,
    loadMore,
    refetch,
  } = useAssets();

  const [search, setSearch] = useState("");
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [previewAsset, setPreviewAsset] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState("avatar");
  const [deleting, setDeleting] = useState(null);
  const fileInputRef = useRef(null);

  // Avatar collection upload modal
  const [avatarCollectionOpen, setAvatarCollectionOpen] = useState(false);

  // Shared "RE Agents" avatar pool — same source as the AI Walkthrough
  // pipeline's "Choose Your Presenter" step (admin-curated collections +
  // everyone's uploads), view-only here since it's not user-owned.
  const [reAgents, setReAgents] = useState([]);
  const [reAgentsLoading, setReAgentsLoading] = useState(true);
  const [reAgentsError, setReAgentsError] = useState(null);

  // Collection photo preview — swipeable carousel, same UX as the pipeline's
  // "Choose Your Presenter" step.
  const [previewCollection, setPreviewCollection] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [loadedPreviewUrls, setLoadedPreviewUrls] = useState(() => new Set());
  const touchStartXRef = useRef(null);

  useEffect(() => {
    if (!previewCollection?.images?.length) return;
    let cancelled = false;
    setLoadedPreviewUrls(new Set());
    previewCollection.images.forEach((img) => {
      if (!img.url) return;
      const el = new window.Image();
      el.onload = () => {
        if (cancelled) return;
        setLoadedPreviewUrls((prev) => {
          if (prev.has(img.url)) return prev;
          const next = new Set(prev);
          next.add(img.url);
          return next;
        });
      };
      el.src = img.url;
    });
    return () => { cancelled = true; };
  }, [previewCollection]);

  const handlePreviewTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handlePreviewTouchEnd = (e) => {
    const startX = touchStartXRef.current;
    const count = previewCollection?.images?.length || 0;
    touchStartXRef.current = null;
    if (startX === null || count < 2) return;

    const deltaX = e.changedTouches[0].clientX - startX;
    const SWIPE_THRESHOLD = 40;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;

    if (deltaX < 0) setPreviewIndex((i) => (i + 1) % count);
    else setPreviewIndex((i) => (i - 1 + count) % count);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadReAgents() {
      setReAgentsLoading(true);
      setReAgentsError(null);
      setReAgents([]);
      try {
        const res = await fetch("/api/avatars/re");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (cancelled) return;

          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";

          for (const block of blocks) {
            for (const line of block.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              try {
                const event = JSON.parse(line.slice(6));
                if (event.type === "avatar") {
                  setReAgents((prev) =>
                    prev.some((a) => a.id === event.avatar.id) ? prev : [...prev, event.avatar]
                  );
                  setReAgentsLoading(false);
                } else if (event.type === "done") {
                  setReAgentsLoading(false);
                } else if (event.type === "error") {
                  setReAgentsError(event.message || "Failed to load RE Agents");
                  setReAgentsLoading(false);
                }
              } catch (_) {}
            }
          }
        }
      } catch (err) {
        if (!cancelled) setReAgentsError("Failed to load RE Agents");
      } finally {
        if (!cancelled) setReAgentsLoading(false);
      }
    }

    loadReAgents();
    return () => { cancelled = true; };
  }, []);

  const filteredLibrary = libraryAvatars.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.ethnicity?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredCustom = customAvatars.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredProducts = productImages.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  function handleFileSelect(e, type = "avatar") {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Invalid file type", { description: "Please use JPEG, PNG, or WebP images." });
      return;
    }

    setUploadFile(file);
    setUploadPreview(URL.createObjectURL(file));
    setAssetName(file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "));
    setAssetType(type);
    setUploadModalOpen(true);
  }

  async function handleUpload() {
    if (!uploadFile) return;

    const result = await uploadAsset(uploadFile, assetName, assetType, assetType === "avatar" ? "avatars" : "products");

    if (result.success) {
      toast.success("Asset uploaded! 🎉");
      closeUploadModal();
    } else {
      toast.error("Upload failed", { description: result.error });
    }
  }

  function closeUploadModal() {
    setUploadModalOpen(false);
    setUploadFile(null);
    setUploadPreview(null);
    setAssetName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function renameAsset(id, newName) {
    const res = await fetch(`/api/assets?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (!res.ok) throw new Error("Rename failed");
    await refetch();
  }

  async function setThumbnail(assetId, url) {
    try {
      const res = await fetch(`/api/assets?id=${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnailUrl: url }),
      });
      if (!res.ok) throw new Error("Failed to set thumbnail");
      await refetch();
      // Reflect the new order in the open carousel immediately.
      setPreviewCollection((prev) =>
        prev ? { ...prev, images: [{ url }, ...prev.images.filter((img) => img.url !== url)] } : prev
      );
      setPreviewIndex(0);
      toast.success("Thumbnail updated");
    } catch (err) {
      toast.error("Failed to set thumbnail", { description: err.message });
    }
  }

  async function handleDelete(id) {
    setDeleting(id);
    const result = await deleteAsset(id);

    if (result.success) {
      toast.success("Asset deleted");
      if (selectedAsset?.id === id) setSelectedAsset(null);
      if (previewAsset?.id === id) setPreviewAsset(null);
    } else {
      toast.error("Delete failed", { description: result.error });
    }
    setDeleting(null);
  }

  function AssetCard({ asset, showDelete = false }) {
    const isSelected = selectedAsset?.id === asset.id;

    return (
      <div
        className={`group rounded-lg overflow-hidden border bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer ${
          isSelected ? "border-primary ring-2 ring-primary" : "border-neutral-200"
        }`}
        onClick={() => setSelectedAsset(asset)}
      >
        <div className="relative aspect-square overflow-hidden">
          <img
            src={asset.url || asset.image_url}
            alt={asset.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/20 sm:bg-black/0 sm:group-hover:bg-black/20 transition-colors" />

          <button
            onClick={(e) => { e.stopPropagation(); setPreviewAsset(asset); }}
            className="absolute inset-0 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          >
            <div className="h-9 px-4 rounded-md bg-white/90 backdrop-blur flex items-center gap-2 shadow-md">
              <Eye className="w-4 h-4 text-black" />
              <span className="text-black text-sm font-medium">Preview</span>
            </div>
          </button>

          {showDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(asset.id); }}
              disabled={deleting === asset.id}
              className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-white"
            >
              {deleting === asset.id ? (
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

  return (
    <div className="space-y-6 animate-fade-in sm:pt-0 pt-4 min-h-screen">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFileSelect(e, assetType)}
      />

      <div className="flex flex-col pt-12 sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading">
            Asset Library
          </h1>
          <p className="text-muted-foreground mt-1">
            Store and reuse your product images and avatars
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="cursor-pointer bg-neutral-900 text-[#c7f038] shadow-lg"
            onClick={() => setAvatarCollectionOpen(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Add Avatar Collection
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search your library..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {hasMore && search && (
          <p className="text-xs text-muted-foreground mt-1.5 pl-1">
            Searching loaded assets only — load more below to expand results
          </p>
        )}
      </div>

      {fetchError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <strong>Assets failed to load:</strong> {fetchError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-[#c7f038]" />
        </div>
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="bg-muted/50 p-1 max-w-full overflow-x-auto justify-start">
            <TabsTrigger value="all" className="cursor-pointer shrink-0">All Assets ({assets.filter((a) => a.type !== "video" && a.type !== "clip").length})</TabsTrigger>
            <TabsTrigger value="prebuilt" className="cursor-pointer shrink-0">Prebuilt Avatars ({reAgents.length})</TabsTrigger>
            <TabsTrigger value="mine" className="cursor-pointer shrink-0">My Avatars ({avatars.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {assets
                .filter((a) => a.type !== "video" && a.type !== "clip")
                .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
                .map((asset) => (
                  <AssetCard key={asset.id} asset={asset} showDelete={asset.is_custom} />
                ))}
            </div>
          </TabsContent>

          <TabsContent value="prebuilt" className="mt-6">
            {reAgentsLoading && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="aspect-[4/5] rounded-2xl bg-muted/60 animate-pulse" />
                ))}
              </div>
            )}

            {!reAgentsLoading && reAgentsError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive">
                {reAgentsError}
              </div>
            )}

            {!reAgentsLoading && !reAgentsError && reAgents.length === 0 && (
              <div className="rounded-xl border border-border/40 bg-muted/30 p-6 text-xs text-muted-foreground text-center">
                No prebuilt avatars available yet.
              </div>
            )}

            {!reAgentsLoading && !reAgentsError && reAgents.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {reAgents
                  .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
                  .map((collection) => (
                    <CollectionCard
                      key={`re:${collection.id}`}
                      name={collection.name}
                      images={collection.images}
                      coverUrl={collection.coverImage}
                      onView={() => { setPreviewCollection(collection); setPreviewIndex(0); }}
                    />
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="mine" className="mt-6">
            {avatars.length === 0 && !search ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-border flex items-center justify-center">
                  <ImagePlus className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">No avatars yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Upload a set of photos of the same person — they are grouped as a collection and used as presenter reference images in ad generation
                  </p>
                </div>
                <Button
                  size="sm"
                  className="bg-neutral-900 text-[#c7f038] cursor-pointer"
                  onClick={() => setAvatarCollectionOpen(true)}
                >
                  <ImagePlus className="w-3.5 h-3.5 mr-1.5" />
                  Upload Your First Collection
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {avatars
                  .filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
                  .map((asset) => {
                    if (asset.type !== "presenter") {
                      return <AssetCard key={asset.id} asset={asset} showDelete={asset.is_custom} />;
                    }
                    const urls = asset.metadata?.urls || [asset.url];
                    const collection = { id: asset.id, name: asset.name, images: urls.map((url) => ({ url })), editable: true };
                    return (
                      <CollectionCard
                        key={asset.id}
                        name={asset.name}
                        images={collection.images}
                        editable
                        onRename={(newName) => renameAsset(asset.id, newName)}
                        onDelete={() => handleDelete(asset.id)}
                        deleting={deleting === asset.id}
                        onView={() => { setPreviewCollection(collection); setPreviewIndex(0); }}
                      />
                    );
                  })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="products" className="mt-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {productImages.filter(a => a.name.toLowerCase().includes(search.toLowerCase())).map((asset) => (
                <AssetCard key={asset.id} asset={asset} showDelete={asset.is_custom} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {hasMore && !loading && (
        <div className="flex justify-center py-6">
          <button onClick={loadMore} disabled={loadingMore} className="cursor-pointer bg-linear-to-b from-black to-neutral-600 text-white px-4 py-2 rounded-full">
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "Load more assets"
            )}
          </button>
        </div>
      )}

      {/* Preview Modal */}
      <Dialog open={!!previewAsset} onOpenChange={(open) => !open && setPreviewAsset(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-border/50">
          <DialogTitle className="sr-only">
            {previewAsset?.name || "Asset preview"}
          </DialogTitle>
          <div className="relative w-full h-[80vh] flex items-center justify-center">
            {previewAsset && (
              <img src={previewAsset.url || previewAsset.image_url} alt={previewAsset.name} className="max-w-full max-h-full object-contain" />
            )}
            <div className="absolute top-4 left-4">
              <Badge className="bg-black/50 text-white border-white/20 backdrop-blur">
                {previewAsset?.name}
              </Badge>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Collection photo preview — carousel, same UX as the pipeline's
          "Choose Your Presenter" step: arrows + swipe + dot indicators. */}
      <Dialog open={!!previewCollection} onOpenChange={(open) => !open && setPreviewCollection(null)}>
        <DialogContent
          showCloseButton={false}
          className="max-w-none sm:max-w-lg md:max-w-sm w-full h-full sm:h-[80vh] p-0 sm:p-6 gap-0 border-0 flex flex-col"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          <DialogHeader className="absolute top-0 left-0 right-0 z-20 p-4 sm:static sm:p-0 bg-white sm:bg-none">
            <DialogTitle className="text-white sm:py-4 py-0 sm:text-foreground text-base sm:text-lg font-medium truncate pr-10">
              {previewCollection?.name}
            </DialogTitle>
          </DialogHeader>

          {previewCollection?.images?.length > 0 && (
            <div className="flex-1 sm:flex-none flex flex-col justify-center h-full sm:h-auto space-y-0 sm:space-y-3">
              <div
                className="relative flex-1 sm:flex-none sm:h-[60vh] md:h-[65vh] overflow-hidden bg-black sm:bg-white sm:rounded-xl touch-pan-y select-none"
                onTouchStart={handlePreviewTouchStart}
                onTouchEnd={handlePreviewTouchEnd}
              >
                <img
                  src={previewCollection.images[previewIndex]?.url}
                  alt={`${previewCollection.name} ${previewIndex + 1}`}
                  className="absolute inset-0 w-full h-full object-contain"
                  draggable={false}
                />

                {!loadedPreviewUrls.has(previewCollection.images[previewIndex]?.url) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 sm:bg-muted/60">
                    <Loader2 className="w-6 h-6 sm:w-5 sm:h-5 animate-spin text-white/70 sm:text-neutral-500" />
                  </div>
                )}

                {previewCollection.editable && (
                  previewIndex === 0 ? (
                    <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/50 text-white/90 text-[11px] font-medium backdrop-blur-sm">
                      <Star className="w-3 h-3 fill-current" />
                      Thumbnail
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setThumbnail(previewCollection.id, previewCollection.images[previewIndex]?.url)}
                      className="absolute top-2 left-2 sm:top-3 sm:left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white text-black text-[11px] font-medium shadow-lg hover:bg-[#c7f038] transition-colors"
                    >
                      <Star className="w-3 h-3" />
                      Set as thumbnail
                    </button>
                  )
                )}

                {previewCollection.images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewIndex((i) => (i - 1 + previewCollection.images.length) % previewCollection.images.length)
                      }
                      className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 sm:bg-black/50 hover:bg-black/70 active:scale-90 flex items-center justify-center text-white transition-all backdrop-blur-sm"
                      aria-label="Previous photo"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewIndex((i) => (i + 1) % previewCollection.images.length)}
                      className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 sm:bg-black/50 hover:bg-black/70 active:scale-90 flex items-center justify-center text-white transition-all backdrop-blur-sm"
                      aria-label="Next photo"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 sm:hidden text-white/50 text-xs font-medium bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm pointer-events-none">
                      Swipe to navigate
                    </div>
                  </>
                )}
              </div>

              {previewCollection.images.length > 1 && (
                <div className="flex items-center justify-center gap-2 sm:gap-1.5 py-4 sm:py-0 bg-black sm:bg-transparent">
                  {previewCollection.images.map((img, idx) => (
                    <button
                      key={img.url || idx}
                      type="button"
                      onClick={() => setPreviewIndex(idx)}
                      aria-label={`Go to photo ${idx + 1}`}
                      className={`h-2.5 sm:h-2 rounded-full transition-all ${
                        idx === previewIndex
                          ? "w-8 sm:w-6 bg-white sm:bg-neutral-900"
                          : "w-2.5 sm:w-2 bg-white/40 sm:bg-neutral-300 hover:bg-white/60 sm:hover:bg-neutral-400"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setPreviewCollection(null)}
            className="absolute top-2 right-2 sm:top-3 sm:right-3 z-30 w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-black/40 sm:bg-black/10 hover:bg-black/60 flex items-center justify-center text-white/90 sm:text-neutral-500 sm:hover:text-neutral-900 active:scale-90 transition-all"
            aria-label="Close preview"
          >
            <X className="w-7 h-7 sm:w-4 sm:h-4" />
          </button>
        </DialogContent>
      </Dialog>

      {/* Upload Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={(open) => !open && closeUploadModal()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Upload {assetType === "avatar" ? "Avatar" : "Product Image"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="aspect-square rounded-xl bg-muted flex items-center justify-center overflow-hidden">
              {uploadPreview && <img src={uploadPreview} className="w-full h-full object-cover" />}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</label>
              <Input value={assetName} onChange={(e) => setAssetName(e.target.value)} />
            </div>
            <Button className="w-full gradient-bg text-white" onClick={handleUpload} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload to Library
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Avatar Collection Upload Modal */}
      <AvatarCollectionModal
        open={avatarCollectionOpen}
        onClose={() => setAvatarCollectionOpen(false)}
        onUploaded={() => refetch()}
      />
    </div>
  );
}
