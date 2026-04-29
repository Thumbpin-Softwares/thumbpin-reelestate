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
  CheckCircle2,
  AlertTriangle,
  Search,
} from "lucide-react";

function AvatarCard({ avatar, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/avatars", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: avatar.type, filename: avatar.filename }),
      });
      if (!res.ok) throw new Error("Delete failed");
      toast.success(`Deleted ${avatar.filename}`);
      onDelete(avatar.id);
    } catch {
      toast.error("Failed to delete avatar");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="group relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-600 transition-all duration-200">
      {/* Image */}
      <div className="aspect-square bg-slate-800 relative overflow-hidden">
        <img
          src={avatar.url}
          alt={avatar.displayName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            e.target.style.display = "none";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Footer */}
      <div className="p-3 flex items-center justify-between">
        <p className="text-xs text-slate-300 font-medium truncate max-w-[120px]">
          {avatar.filename}
        </p>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
            confirmDelete
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : "text-slate-500 hover:bg-red-500/10 hover:text-red-400"
          }`}
          title={confirmDelete ? "Click again to confirm" : "Delete"}
        >
          {deleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : confirmDelete ? (
            <AlertTriangle className="w-3.5 h-3.5" />
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-semibold text-base font-heading">Upload Avatar</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          {/* Type */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-2 block">
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
                      ? "bg-indigo-600/15 border-indigo-500/40 text-indigo-400"
                      : "border-slate-700 text-slate-400 hover:border-slate-600"
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
            <label className="text-xs font-medium text-slate-400 mb-2 block">Image File</label>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files[0]);
              }}
              className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-500/50 transition-all"
            >
              {preview ? (
                <img src={preview} alt="preview" className="h-28 mx-auto rounded-lg object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-500">
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
              <p className="text-xs text-slate-500 mt-1">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>
            )}
          </div>

          {/* Custom Name */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-2 block">
              Custom Name <span className="text-slate-600">(optional)</span>
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. avatar9"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={uploading || !file}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl text-sm transition-all"
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
    } catch {
      toast.error("Failed to load avatars");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAvatars();
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
          <h1 className="text-2xl font-bold text-white font-heading tracking-tight">
            Avatar Manager
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage product video & real estate avatars
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          id="admin-upload-avatar"
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          Upload Avatar
        </button>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
          {[
            { key: "product", label: "Product Video", icon: ShoppingBag, count: data.product.length },
            { key: "real-estate", label: "Real Estate", icon: Home, count: data.realEstate.length },
          ].map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === key
                  ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === key ? "bg-indigo-600/20 text-indigo-400" : "bg-slate-800 text-slate-500"
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search avatars..."
            className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors w-56"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="aspect-square bg-slate-800 animate-pulse" />
              <div className="p-3 h-10 bg-slate-900" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl">
          <ImageIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">
            {search ? "No avatars match your search" : "No avatars yet"}
          </p>
          <p className="text-slate-600 text-sm mt-1">
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
