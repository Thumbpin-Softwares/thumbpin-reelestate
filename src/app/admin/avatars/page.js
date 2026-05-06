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
  AlertTriangle,
  Search,
} from "lucide-react";

function AvatarCard({ avatar, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/avatars", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: avatar.type, filename: avatar.filename }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success(`Deleted ${avatar.filename}`);
      onDelete(avatar.id);
    } catch (err) {
      console.error("Delete error:", err);
      toast.error(err.message || "Failed to delete avatar");
      setDeleting(false);
    }
  }

  return (
    <div className="group relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-400 transition-all duration-200 shadow-sm">
      {/* Image */}
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        <img
          src={avatar.url}
          alt={avatar.displayName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            e.target.style.display = "none";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Footer */}
      <div className="p-3 flex items-center justify-between">
        <p className="text-xs text-gray-600 font-medium truncate max-w-[120px]">
          {avatar.filename}
        </p>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-1.5 rounded-lg text-xs font-medium transition-all text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Delete"
        >
          {deleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

function UploadModal({ onClose, onUploaded }) {
  const [type, setType] = useState("product");
  const [file, setFile] = useState(null);
  const [customName, setCustomName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef();

  function handleFile(f) {
    if (!f) return;
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return toast.error("Select a file first");

    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    if (customName) fd.append("name", customName);

    try {
      const res = await fetch("/api/admin/avatars/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Uploaded ${data.filename}`);
      onUploaded();
      onClose();
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 rounded-2xl w-full max-w-md p-6 shadow-xl animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-gray-900 font-semibold text-base font-heading">Upload Avatar</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          {/* Type */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">
              Avatar Type
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
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    type === val
                      ? "bg-gray-900 text-white border-gray-900"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* File Drop Zone */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">Image File</label>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files[0]);
              }}
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-gray-400 bg-gray-50/50 transition-all"
            >
              {preview ? (
                <img src={preview} alt="preview" className="h-28 mx-auto rounded-lg object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <Upload className="w-8 h-8" />
                  <p className="text-sm">Click or drag & drop image here</p>
                  <p className="text-xs">PNG, JPG, WEBP supported</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => handleFile(e.target.files[0])}
              />
            </div>
            {file && (
              <p className="text-xs text-gray-500 mt-1">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>
            )}
          </div>

          {/* Custom Name */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">
              Custom Name <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. avatar9"
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={uploading || !file}
            className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl text-sm transition-all"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" />
                Upload Avatar
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminAvatarsPage() {
  const [data, setData] = useState({ product: [], realEstate: [] });
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [activeTab, setActiveTab] = useState("product");
  const [search, setSearch] = useState("");

  async function loadAvatars() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/avatars");
      const json = await res.json();
      setData({ product: json.product || [], realEstate: json.realEstate || [] });
    } catch (err) {
      toast.error("Failed to load avatars");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const abortController = new AbortController();

    async function loadAvatarsWithAbort() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/avatars", { signal: abortController.signal });
        const json = await res.json();
        if (!abortController.signal.aborted) {
          setData({ product: json.product || [], realEstate: json.realEstate || [] });
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          toast.error("Failed to load avatars");
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadAvatarsWithAbort();

    return () => abortController.abort();
  }, []);

  function handleDeleted(id) {
    setData((prev) => ({
      product: prev.product.filter((a) => a.id !== id),
      realEstate: prev.realEstate.filter((a) => a.id !== id),
    }));
  }

  const list = activeTab === "product" ? data.product : data.realEstate;
  const filtered = list.filter((a) =>
    a.filename.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-heading tracking-tight">
            Avatar Manager
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage product video & real estate avatars
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          id="admin-upload-avatar"
          className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Upload Avatar
        </button>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-1 shadow-sm">
          {[
            { key: "product", label: "Product Video", icon: ShoppingBag, count: data.product.length },
            { key: "real-estate", label: "Real Estate", icon: Home, count: data.realEstate.length },
          ].map(({ key, label, icon: Icon, count }) => (
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
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === key ? "bg-white text-gray-600 shadow-sm border border-gray-100" : "bg-gray-50 text-gray-400"
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search avatars..."
            className="bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 transition-all w-56 shadow-sm"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="aspect-square bg-gray-100 animate-pulse" />
              <div className="p-3 h-10 bg-white" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-200 rounded-2xl bg-white">
          <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {search ? "No avatars match your search" : "No avatars yet"}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {!search && "Upload your first avatar using the button above"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filtered.map((avatar) => (
            <AvatarCard key={avatar.id} avatar={avatar} onDelete={handleDeleted} />
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={loadAvatars}
        />
      )}
    </div>
  );
}