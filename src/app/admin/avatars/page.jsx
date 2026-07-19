"use client";
import { useEffect, useState } from "react";
import { adminNotify } from "@/modules/admin/components/notification";
import { ImageIcon, Plus, Search } from "lucide-react";
import { UploadModal } from "@/modules/admin/components/upload-modal";
import { CollectionViewModal } from "@/modules/admin/components/collection-view-modal";
import { CollectionCard } from "@/modules/admin/components/collection-card";

export default function AdminAvatarsPage() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCollection, setSelectedCollection] = useState(null);

  async function fetchCollections() {
    const res = await fetch("/api/admin/avatars");
    const data = await res.json();
    return data.collections || [];
  }

  async function loadCollections() {
    setLoading(true);
    try {
      setCollections(await fetchCollections());
    } catch (err) {
      console.error("Failed to load collections:", err);
      adminNotify.error("Failed to load collections");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchCollections()
      .then((collections) => {
        if (!cancelled) setCollections(collections);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load collections:", err);
        adminNotify.error("Failed to load collections");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function openCollection(collectionId) {
    const collection = collections.find((c) => c.id === collectionId);
    if (collection) {
      setSelectedCollection(collection);
    } else {
      adminNotify.error("Failed to load collection details");
    }
  }

  function handleDeleteCollection(collectionId) {
    setCollections(prev => prev.filter(c => c.id !== collectionId));
  }

  function handleThumbnailSet(collectionId, thumbnailKey, coverImage) {
    setCollections(prev =>
      prev.map(c =>
        c.id === collectionId
          ? { ...c, coverImage, thumbnailKey }
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
          <h1 className="text-4xl font-semibold text-black tracking-tight">
            Avatar Collections
          </h1>
          <p className="text-neutral-600 mt-1">
            Manage real estate avatar collections
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center justify-between flex-row-reverse">
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 bg-[#c7f038] text-black text-sm px-4 py-2 rounded-md transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Collection
        </button>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search collections..."
            className="bg-white border border-gray-200 rounded-md pl-9 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#c7f038] focus:border-2 transition-all w-84"
          />
        </div>
      </div>

      {/* Collections Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="aspect-9/16 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-200 rounded-2xl bg-white">
          <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {search ? "No collections match your search" : "No collections yet"}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {!search && "Create your first collection using the button above"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((collection) => (
            <CollectionCard 
              key={collection.id} 
              collection={collection} 
              onClick={openCollection}
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