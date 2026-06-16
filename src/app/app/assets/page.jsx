"use client";

import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  CheckCircle,
  Trash2,
  Loader2,
  ImagePlus,
  Sparkles,
  Package,
  Video,
  PenLine,
  X,
} from "lucide-react";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// ─── Presenter Collection Card ────────────────────────────────────────────────
function PresenterCollectionCard({ asset, onRename, onDelete, deleting }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(asset.name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const urls = asset.metadata?.urls || [asset.url];

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === asset.name) {
      setEditing(false);
      setName(asset.name);
      return;
    }
    setSaving(true);
    try {
      await onRename(asset.id, trimmed);
      setEditing(false);
    } catch {
      toast.error("Rename failed");
      setName(asset.name);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="group border-border/50 overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1">
      <CardContent className="p-0">
        {/* 2×2 image grid */}
        <div className="grid grid-cols-2 aspect-square">
          {[0, 1, 2, 3].map((i) =>
            urls[i] ? (
              <div key={i} className="overflow-hidden relative">
                <img src={urls[i]} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div key={i} className="bg-muted/20 flex items-center justify-center">
                <ImagePlus className="w-4 h-4 text-muted-foreground/20" />
              </div>
            )
          )}
        </div>

        <div className="p-3 space-y-2">
          {/* Editable name */}
          <div className="flex items-center gap-1.5 min-w-0">
            {editing ? (
              <input
                ref={inputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={save}
                onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setEditing(false); setName(asset.name); } }}
                className="text-sm font-medium flex-1 min-w-0 border-b border-primary outline-none bg-transparent"
                autoFocus
              />
            ) : (
              <p className="text-sm font-medium truncate flex-1">{asset.name}</p>
            )}
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-muted-foreground" />
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <PenLine className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-[10px]">
              {urls.length} image{urls.length !== 1 ? "s" : ""}
            </Badge>
            <button
              onClick={() => onDelete(asset.id)}
              disabled={deleting === asset.id}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              {deleting === asset.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
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
    videos,
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

  const filteredVideos = videos.filter((a) =>
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
    const isVideo = asset.type === "video" || asset.type === "clip";

    return (
      <Card
        className={`group cursor-pointer border-border/50 hover:shadow-lg transition-all hover:-translate-y-1 overflow-hidden ${
          isSelected ? "ring-2 ring-primary border-primary" : ""
        } ${isVideo ? "aspect-[9/16]" : ""}`}
        onClick={() => { setSelectedAsset(asset); if (isVideo) setPreviewAsset(asset); }}
      >
        <CardContent className="p-0">
          <div className="aspect-square bg-gradient-to-br from-primary/10 to-accent/10 relative flex items-center justify-center overflow-hidden">
            {isVideo ? (
              <video
                src={asset.url}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                muted
                onMouseEnter={(e) => e.target.play()}
                onMouseLeave={(e) => { e.target.pause(); e.target.currentTime = 0; }}
              />
            ) : (
              <img
                src={asset.url || asset.image_url}
                alt={asset.name}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                className="w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center cursor-pointer hover:bg-white/30 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewAsset(asset);
                }}
              >
                <Eye className="w-4 h-4 text-white" />
              </button>
              {showDelete && (
                <button
                  className="w-8 h-8 rounded-full bg-red-500/30 backdrop-blur flex items-center justify-center cursor-pointer hover:bg-red-500/50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(asset.id);
                  }}
                  disabled={deleting === asset.id}
                >
                  {deleting === asset.id ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 text-white" />
                  )}
                </button>
              )}
            </div>
            
            <div className="absolute top-2 left-2">
              <Badge className="bg-primary/80 text-white text-[10px] px-1.5 py-0.5 border-0 flex items-center gap-1">
                {asset.type === "avatar" && <Sparkles className="w-2.5 h-2.5" />}
                {asset.type === "product" && <Package className="w-2.5 h-2.5" />}
                {isVideo && <Video className="w-2.5 h-2.5" />}
                {asset.type === "avatar" ? "Avatar" : asset.type === "product" ? "Product" : "Video"}
              </Badge>
            </div>

          </div>
          <div className="p-3">
            <p className="text-sm font-medium truncate">{asset.name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {asset.is_custom ? "Added by you" : "Library Asset"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in py-12 min-h-screen">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFileSelect(e, assetType)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading">
            Asset Library
          </h1>
          <p className="text-muted-foreground mt-1">
            Store and reuse your product images, avatars, and videos
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() => {
              setAssetType("product");
              fileInputRef.current?.click();
            }}
          >
            <Package className="w-4 h-4 mr-2" />
            Add Product Image
          </Button>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-0">
                <Skeleton className="aspect-square w-full" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="all" className="cursor-pointer">All Assets ({assets.length})</TabsTrigger>
            <TabsTrigger value="avatars" className="cursor-pointer">Avatars ({avatars.length})</TabsTrigger>
            <TabsTrigger value="products" className="cursor-pointer">Products ({productImages.length})</TabsTrigger>
            <TabsTrigger value="videos" className="cursor-pointer">Videos ({videos.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {assets.filter(a => a.name.toLowerCase().includes(search.toLowerCase())).map((asset) => (
                <AssetCard key={asset.id} asset={asset} showDelete={asset.is_custom} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="avatars" className="mt-6">
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
                  .map((asset) =>
                    asset.type === "presenter" ? (
                      <PresenterCollectionCard
                        key={asset.id}
                        asset={asset}
                        onRename={renameAsset}
                        onDelete={handleDelete}
                        deleting={deleting}
                      />
                    ) : (
                      <AssetCard key={asset.id} asset={asset} showDelete={asset.is_custom} />
                    )
                  )}
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
          
          <TabsContent value="videos" className="mt-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {videos.filter(a => a.name.toLowerCase().includes(search.toLowerCase())).map((asset) => (
                <AssetCard key={asset.id} asset={asset} showDelete={asset.is_custom} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {hasMore && !loading && (
        <div className="flex justify-center py-6">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="cursor-pointer">
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "Load more assets"
            )}
          </Button>
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
              previewAsset.type === "video" || previewAsset.type === "clip" ? (
                <video src={previewAsset.url} controls autoPlay className="max-w-full max-h-full object-contain" />
              ) : (
                <img src={previewAsset.url || previewAsset.image_url} alt={previewAsset.name} className="max-w-full max-h-full object-contain" />
              )
            )}
            <div className="absolute top-4 left-4">
              <Badge className="bg-black/50 text-white border-white/20 backdrop-blur">
                {previewAsset?.name}
              </Badge>
            </div>
          </div>
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
