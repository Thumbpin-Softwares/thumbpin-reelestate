"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, Loader2, Plus, X } from "lucide-react";
import { compressImage } from "@/utils/compress-image";

// Upload Modal — creates a new real estate avatar collection.
export function UploadModal({ onClose, onUploaded }) {
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

    await Promise.all(
      files.map(async (file) => {
        const compressed = await compressImage(file, 1200, 0.82);
        fd.append("files", compressed);
      })
    );
    fd.append("type", "real-estate");
    if (collectionName) fd.append("name", collectionName);

    try {
      const res = await fetch("/api/admin/avatars", {
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
