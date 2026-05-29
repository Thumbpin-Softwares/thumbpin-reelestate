"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import {
  Upload,
  Trash2,
  ImageIcon,
  Loader2,
  Plus,
  Home,
  ShoppingBag,
  X,
  Search,
  Grid3x3,
  Calendar,
  Image as ImageIcon2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Star
} from "lucide-react";

// Collection Card Component
function CollectionCard({ collection, onClick }) {
  return (
    <div 
      onClick={() => onClick(collection.id)}
      className="group cursor-pointer bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-400 hover:shadow-lg transition-all duration-200"
    >
      {/* Single Image */}
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        <img
          src={collection.coverImage}
          alt={collection.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            e.target.src = "https://placehold.co/400x400?text=No+Image";
          }}
        />
        {/* Optional: Show number of images badge */}
        {collection.fileCount > 1 && (
          <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
            +{collection.fileCount}
          </div>
        )}
      </div>

      {/* Collection Name */}
      <div className="p-3">
        <h3 className="font-medium text-gray-900 text-sm truncate text-center">
          {collection.name}
        </h3>
        <p className="text-xs text-gray-500 text-center mt-1">
          {collection.fileCount} image{collection.fileCount !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}

// Collection View Modal
function CollectionViewModal({ collection, onClose, onDelete, onThumbnailSet }) {
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
      onThumbnailSet?.(collection.id, fileKey);
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
              {collection.fileCount} images • {collection.type === 'product' ? 'Product Video' : 'Real Estate'}
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

// Upload Modal
function UploadModal({ onClose, onUploaded }) {
  const [type, setType] = useState("product");
  const [files, setFiles] = useState([]);
  const [collectionName, setCollectionName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState([]);
  const fileRef = useRef();

  function handleFiles(selectedFiles) {
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    const filesArray = Array.from(selectedFiles);
    setFiles(filesArray);
    
    const previewUrls = filesArray.map(file => URL.createObjectURL(file));
    setPreviews(previewUrls);
  }

  function removeFile(index) {
    URL.revokeObjectURL(previews[index]);
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (files.length === 0) return toast.error("Select at least one file");

    setUploading(true);
    const fd = new FormData();
    
    files.forEach(file => {
      fd.append("files", file);
    });
    fd.append("type", type);
    if (collectionName) fd.append("name", collectionName);

    try {
      const res = await fetch("/api/admin/avatars/upload", { 
        method: "POST", 
        body: fd 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success(`Created collection "${data.collection.name}" with ${data.collection.fileCount} images`);
      onUploaded();
      onClose();
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      previews.forEach(preview => URL.revokeObjectURL(preview));
    };
  }, [previews]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-gray-900 font-semibold text-lg">Create New Collection</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          {/* Type selector */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">
              Collection Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: "product", label: "Product Video", icon: ShoppingBag },
                { val: "real-estate", label: "Real Estate", icon: Home },
              ].map(({ val, label, icon: Icon }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setType(val)}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    type === val
                      ? "bg-gray-900 text-white border-gray-900"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* File upload */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">
              Images (multiple allowed)
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFiles(e.dataTransfer.files);
              }}
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-gray-400 transition-all"
            >
              {previews.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {previews.slice(0, 3).map((preview, idx) => (
                    <img key={idx} src={preview} className="h-20 w-full object-cover rounded-lg" alt="Preview" />
                  ))}
                  {previews.length > 3 && (
                    <div className="h-20 rounded-lg bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                      +{previews.length - 3}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <Upload className="w-8 h-8" />
                  <p className="text-sm">Click or drag & drop images here</p>
                  <p className="text-xs">PNG, JPG, WEBP | Multiple files allowed</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
            
            {files.length > 0 && (
              <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded-lg">
                    <span className="text-gray-600 truncate flex-1">{file.name}</span>
                    <span className="text-gray-400 ml-2">({(file.size / 1024).toFixed(0)} KB)</span>
                    {!uploading && (
                      <button 
                        type="button" 
                        onClick={() => removeFile(idx)} 
                        className="ml-2 text-gray-400 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Collection Name */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">
              Collection Name <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              placeholder="e.g., Summer Collection 2024"
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={uploading || files.length === 0}
            className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl text-sm transition-all"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating collection...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                Create Collection ({files.length} image{files.length !== 1 ? 's' : ''})
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// Main Page
export default function AdminAvatarsPage() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedCollection, setSelectedCollection] = useState(null);

  async function loadCollections() {
    setLoading(true);
    try {
      // Always fetch all collections first
      const res = await fetch("/api/admin/avatars");
      const data = await res.json();
      let allCollections = data.collections || [];
      
      // Filter on frontend based on active tab
      if (activeTab !== "all") {
        allCollections = allCollections.filter(c => c.type === activeTab);
      }
      
      console.log("Loaded collections:", allCollections);
      setCollections(allCollections);
    } catch (err) {
      console.error("Failed to load collections:", err);
      toast.error("Failed to load collections");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCollections();
  }, [activeTab]);

  async function fetchFullCollection(collectionId) {
    try {
      const res = await fetch(`/api/admin/avatars?collectionId=${collectionId}`);
      const data = await res.json();
      if (data.collection) {
        setSelectedCollection(data.collection);
      } else {
        toast.error("Failed to load collection details");
      }
    } catch (err) {
      console.error("Error fetching collection:", err);
      toast.error("Failed to load collection details");
    }
  }

  function handleDeleteCollection(collectionId) {
    setCollections(prev => prev.filter(c => c.id !== collectionId));
  }

  function handleThumbnailSet(collectionId, thumbnailKey) {
    setCollections(prev =>
      prev.map(c =>
        c.id === collectionId
          ? { ...c, coverImage: `/api/admin/r2?key=${encodeURIComponent(thumbnailKey)}`, thumbnailKey }
          : c
      )
    );
  }

  // Filter collections by search
  const filtered = search
    ? collections.filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase())
      )
    : collections;

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Avatar Collections
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage product video & real estate avatar collections
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Collection
        </button>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-1 shadow-sm">
          {[
            { key: "all", label: "All Collections", icon: Grid3x3 },
            { key: "product", label: "Product Video", icon: ShoppingBag },
            { key: "real-estate", label: "Real Estate", icon: Home },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === key
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search collections..."
            className="bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all w-56 shadow-sm"
          />
        </div>
      </div>

      {/* Collections Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="aspect-video bg-gray-100 animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-100 animate-pulse rounded w-3/4" />
                <div className="h-3 bg-gray-100 animate-pulse rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-200 rounded-2xl bg-white">
          <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {search ? "No collections match your search" : `No ${activeTab === "all" ? "" : activeTab} collections yet`}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {!search && "Create your first collection using the button above"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((collection) => (
            <CollectionCard 
              key={collection.id} 
              collection={collection} 
              onClick={fetchFullCollection}
            />
          ))}
        </div>
      )}

      {/* Collection View Modal */}
      {selectedCollection && (
        <CollectionViewModal
          collection={selectedCollection}
          onClose={() => setSelectedCollection(null)}
          onDelete={handleDeleteCollection}
          onThumbnailSet={handleThumbnailSet}
        />
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={loadCollections}
        />
      )}
    </div>
  );
}