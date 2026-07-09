"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssets } from "@/hooks/use-assets";
import { toast } from "sonner";
import { appNotify } from "@/modules/common/components/notification";
import { CollectionCard } from "@/modules/common/components/collection-card";
import { AvatarCollectionModal } from "@/modules/dashboard/components/avatar-collection-modal";
import { AssetCard } from "@/modules/dashboard/components/asset-card";
import {
  Search,
  Upload,
  Loader2,
  ImagePlus,
  ChevronLeft,
  ChevronRight,
  Star,
  X,
  CheckSquare,
  Trash2,
} from "lucide-react";
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];


export default function AssetLibraryPage() {
  const {
    assets,
    avatars,
    productImages,
    loading,
    loadingMore,
    hasMore,
    uploading,
    fetchError,
    uploadAsset,
    deleteAsset,
    bulkDeleteAssets,
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

  // Bulk select / delete
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Avatar collection upload modal
  const [avatarCollectionOpen, setAvatarCollectionOpen] = useState(false);
  const filteredAvatars = avatars.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()),
  );
  const [reAgents, setReAgents] = useState([]);
  const [reAgentsLoading, setReAgentsLoading] = useState(true);
  const [reAgentsError, setReAgentsError] = useState(null);
  const [previewCollection, setPreviewCollection] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewImageLoading, setPreviewImageLoading] = useState(false);
  const touchStartXRef = useRef(null);


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
                    prev.some((a) => a.id === event.avatar.id)
                      ? prev
                      : [...prev, event.avatar],
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
    return () => {
      cancelled = true;
    };
  }, []);

  function handleFileSelect(e, type = "avatar") {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Invalid file type", {
        description: "Please use JPEG, PNG, or WebP images.",
      });
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

    const result = await uploadAsset(
      uploadFile,
      assetName,
      assetType,
      assetType === "avatar" ? "avatars" : "products",
    );

    if (result.success) {
      toast.success("Asset uploaded! 🎉");
      await refetch();
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
        prev
          ? {
              ...prev,
              images: [
                { url },
                ...prev.images.filter((img) => img.url !== url),
              ],
            }
          : prev,
      );
      setPreviewIndex(0);
      toast.success("Thumbnail updated");
    } catch (err) {
      toast.error("Failed to set thumbnail", { description: err.message });
    }
  }

  async function handleDelete(id, name) {
    setDeleting(id);
    const result = await deleteAsset(id);

    if (result.success) {
      appNotify.success(name || "Asset", {
        description: "This asset was permanently deleted and cannot be recovered.",
      });
      if (selectedAsset?.id === id) setSelectedAsset(null);
      if (previewAsset?.id === id) setPreviewAsset(null);
    } else {
      appNotify.error("Delete failed", { description: result.error });
    }
    setDeleting(null);
  }

  function toggleSelectMode() {
    setSelectMode((prev) => !prev);
    setSelectedIds(new Set());
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const result = await bulkDeleteAssets(ids);

    if (result.success) {
      appNotify.success(`${ids.length} asset${ids.length !== 1 ? "s" : ""} deleted`, {
        description: "These assets were permanently deleted and cannot be recovered.",
      });
    } else {
      appNotify.error("Delete failed", { description: result.error });
    }

    setBulkDeleting(false);
    setBulkDeleteConfirmOpen(false);
    setSelectedIds(new Set());
    setSelectMode(false);
  }

  // Wraps any asset — single image or multi-photo presenter — as a
  // "collection" so it can render through CollectionCard uniformly.
  function toCollection(asset) {
    if (asset.type === "presenter") {
      const urls = asset.metadata?.urls || [asset.url];
      return {
        id: asset.id,
        name: asset.name,
        images: urls.map((url) => ({ url })),
      };
    }
    return {
      id: asset.id,
      name: asset.name,
      images: [{ url: asset.url || asset.image_url }],
    };
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
          <h1 className="text-2xl sm:text-4xl font-light">
            Asset Library
          </h1>
          <p className="text-muted-foreground mt-1">
            Store and reuse your product images and avatars
          </p>
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
              Searching loaded assets only load more below to expand results
            </p>
          )}
        </div>
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
          <TabsList className="p-1 max-w-full space-x-2 overflow-x-auto justify-start">
            <TabsTrigger value="all" className="cursor-pointer data-[state=active]:bg-[black] data-[state=active]:text-[#c7f038] px-4 rounded-full py-2 bg-[#c7f038] text-black shrink-0">
              All Assets (
              {
                assets.filter((a) => a.type !== "video" && a.type !== "clip")
                  .length
              }
              )
            </TabsTrigger>
            <TabsTrigger value="prebuilt" className="bg-[#c7f038] data-[state=active]:bg-[black] data-[state=active]:text-[#c7f038] px-4 rounded-full py-2 text-black cursor-pointer shrink-0">
              Prebuilt Avatars ({reAgents.length})
            </TabsTrigger>
            <TabsTrigger value="mine" className="bg-[#c7f038] data-[state=active]:bg-[black] data-[state=active]:text-[#c7f038] px-4 rounded-full py-2 text-black cursor-pointer shrink-0">
              My Avatars ({avatars.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <div className="flex items-center justify-end gap-2 mb-4 px-4 flex-wrap">
              {selectMode && (
                <>
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size} selected
                  </span>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="cursor-pointer"
                    disabled={selectedIds.size === 0}
                    onClick={() => setBulkDeleteConfirmOpen(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Delete Selected
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                className="cursor-pointer"
                onClick={toggleSelectMode}
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                {selectMode ? "Cancel" : "Select"}
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {assets
                .filter((a) => a.type !== "video" && a.type !== "clip")
                .filter((a) =>
                  a.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((asset) => {
                  const collection = toCollection(asset);
                  return (
                    <CollectionCard
                      key={asset.id}
                      name={asset.name}
                      images={collection.images}
                      editable={asset.is_custom}
                      onRename={(newName) => renameAsset(asset.id, newName)}
                      onDelete={() => handleDelete(asset.id, asset.name)}
                      deleting={deleting === asset.id}
                      onView={() => {
                        setPreviewImageLoading(true);
                        setPreviewCollection(collection);
                        setPreviewIndex(0);
                      }}
                      selectMode={selectMode}
                      selected={selectedIds.has(asset.id)}
                      onToggleSelect={() => toggleSelected(asset.id)}
                    />
                  );
                })}
            </div>
          </TabsContent>

          <TabsContent value="prebuilt" className="mt-6">
            {reAgentsLoading && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-9/16 rounded-2xl bg-muted/60 animate-pulse"
                  />
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
                  .filter((a) =>
                    a.name.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((collection) => (
                    <CollectionCard
                      key={`re:${collection.id}`}
                      name={collection.name}
                      images={collection.images}
                      coverUrl={collection.coverImage}
                      onView={() => {
                        setPreviewImageLoading(true);
                        setPreviewCollection(collection);
                        setPreviewIndex(0);
                      }}
                    />
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="mine">
            <div className="flex items-center justify-between gap-2 mb-4 px-4 flex-wrap">
              <div className="text-sm text-neutral-600">
                {filteredAvatars.length}{" "}
                {filteredAvatars.length === 1 ? "Avatar" : "Avatars"} Added
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {selectMode && (
                  <>
                    <span className="text-sm text-muted-foreground">
                      {selectedIds.size} selected
                    </span>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="cursor-pointer"
                      disabled={selectedIds.size === 0}
                      onClick={() => setBulkDeleteConfirmOpen(true)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Delete Selected
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  onClick={toggleSelectMode}
                >
                  <CheckSquare className="w-4 h-4 mr-2" />
                  {selectMode ? "Cancel" : "Select"}
                </Button>
                <Button
                  className="cursor-pointer bg-[#c7f038] hover:bg-[#c7f038] text-black"
                  onClick={() => setAvatarCollectionOpen(true)}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Add Avatar Collection
                </Button>
              </div>
            </div>
            {avatars.length === 0 && !search ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-border flex items-center justify-center">
                  <ImagePlus className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">No avatars yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Upload a set of photos of the same person they are grouped
                    as a collection and used as presenter reference images in ad
                    generation
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
                  .filter((a) =>
                    a.name.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((asset) => {
                    if (asset.type !== "presenter") {
                      return (
                        <AssetCard
                          key={asset.id}
                          asset={asset}
                          showDelete={asset.is_custom}
                          isSelected={selectedAsset?.id === asset.id}
                          deleting={deleting === asset.id}
                          onSelect={() => setSelectedAsset(asset)}
                          onPreview={() => setPreviewAsset(asset)}
                          onDelete={() => handleDelete(asset.id, asset.name)}
                          selectMode={selectMode}
                          selected={selectedIds.has(asset.id)}
                          onToggleSelect={() => toggleSelected(asset.id)}
                        />
                      );
                    }
                    const urls = asset.metadata?.urls || [asset.url];
                    const collection = {
                      id: asset.id,
                      name: asset.name,
                      images: urls.map((url) => ({ url })),
                      editable: true,
                    };
                    return (
                      <CollectionCard
                        key={asset.id}
                        name={asset.name}
                        images={collection.images}
                        editable
                        onRename={(newName) => renameAsset(asset.id, newName)}
                        onDelete={() => handleDelete(asset.id, asset.name)}
                        deleting={deleting === asset.id}
                        onView={() => {
                          setPreviewImageLoading(true);
                          setPreviewCollection(collection);
                          setPreviewIndex(0);
                        }}
                        selectMode={selectMode}
                        selected={selectedIds.has(asset.id)}
                        onToggleSelect={() => toggleSelected(asset.id)}
                      />
                    );
                  })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="products" className="mt-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {productImages
                .filter((a) =>
                  a.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    showDelete={asset.is_custom}
                    isSelected={selectedAsset?.id === asset.id}
                    deleting={deleting === asset.id}
                    onSelect={() => setSelectedAsset(asset)}
                    onPreview={() => setPreviewAsset(asset)}
                    onDelete={() => handleDelete(asset.id, asset.name)}
                    selectMode={selectMode}
                    selected={selectedIds.has(asset.id)}
                    onToggleSelect={() => toggleSelected(asset.id)}
                  />
                ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {hasMore && !loading && (
        <div className="flex justify-center py-6">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="cursor-pointer bg-linear-to-b from-black to-neutral-600 text-white px-4 py-2 rounded-full"
          >
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
      <Dialog
        open={!!previewAsset}
        onOpenChange={(open) => !open && setPreviewAsset(null)}
      >
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-border/50">
          <DialogTitle className="sr-only">
            {previewAsset?.name || "Asset preview"}
          </DialogTitle>
          <div className="relative w-full h-[80vh] flex items-center justify-center">
            {previewAsset && (
              <div className="relative w-full h-full">
                <Image
                  src={previewAsset.url || previewAsset.image_url}
                  alt={previewAsset.name}
                  fill
                  unoptimized
                  sizes="100vw"
                  className="object-contain"
                />
              </div>
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
      <Dialog
        open={!!previewCollection}
        onOpenChange={(open) => !open && setPreviewCollection(null)}
      >
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
                <Image
                  src={previewCollection.images[previewIndex]?.url}
                  alt={`${previewCollection.name} ${previewIndex + 1}`}
                  fill
                  unoptimized
                  sizes="100vw"
                  className="object-contain"
                  draggable={false}
                  onLoad={() => setPreviewImageLoading(false)}
                />

                {previewImageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 sm:bg-muted/60">
                    <Loader2 className="w-6 h-6 sm:w-5 sm:h-5 animate-spin text-white/70 sm:text-neutral-500" />
                  </div>
                )}

                {previewCollection.editable &&
                  (previewIndex === 0 ? (
                    <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/50 text-white/90 text-[11px] font-medium backdrop-blur-sm">
                      <Star className="w-3 h-3 fill-current" />
                      Thumbnail
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setThumbnail(
                          previewCollection.id,
                          previewCollection.images[previewIndex]?.url,
                        )
                      }
                      className="absolute top-2 left-2 sm:top-3 sm:left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white text-black text-[11px] font-medium shadow-lg hover:bg-[#c7f038] transition-colors"
                    >
                      <Star className="w-3 h-3" />
                      Set as thumbnail
                    </button>
                  ))}

                {previewCollection.images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewIndex(
                          (i) =>
                            (i - 1 + previewCollection.images.length) %
                            previewCollection.images.length,
                        )
                      }
                      className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 sm:bg-black/50 hover:bg-black/70 active:scale-90 flex items-center justify-center text-white transition-all backdrop-blur-sm"
                      aria-label="Previous photo"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewIndex(
                          (i) => (i + 1) % previewCollection.images.length,
                        )
                      }
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
      <Dialog
        open={uploadModalOpen}
        onOpenChange={(open) => !open && closeUploadModal()}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Upload {assetType === "avatar" ? "Avatar" : "Product Image"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative aspect-square rounded-xl bg-muted flex items-center justify-center overflow-hidden">
              {uploadPreview && (
                <Image
                  src={uploadPreview}
                  alt="Upload preview"
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 100vw, 320px"
                  className="object-cover"
                />
              )}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Name
              </label>
              <Input
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
              />
            </div>
            <Button
              className="w-full gradient-bg text-white"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
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

      {/* Bulk delete confirmation */}
      <Dialog open={bulkDeleteConfirmOpen} onOpenChange={(open) => !bulkDeleting && setBulkDeleteConfirmOpen(open)}>
        <DialogContent className="max-w-sm rounded-3xl border border-[#c7f038]/20 bg-white backdrop-blur-2xl shadow-[0_20px_60px_rgba(199,240,56,0.18)]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight">Delete {selectedIds.size} asset{selectedIds.size !== 1 ? "s" : ""}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-neutral-600">
            This will permanently delete the selected asset{selectedIds.size !== 1 ? "s" : ""}. This action can&apos;t be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              className="cursor-pointer rounded-xl bg-red-500 text-white hover:bg-red-600 hover:text-white"
              disabled={bulkDeleting}
              onClick={() => setBulkDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer gap-2 rounded-xl bg-[#c7f038] text-black hover:bg-[#b7df33]"
              disabled={bulkDeleting}
              onClick={handleBulkDelete}
            >
              {bulkDeleting ? (
                <>
                  Deleting...
                </>
              ) : (
                <>
                  Delete
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
