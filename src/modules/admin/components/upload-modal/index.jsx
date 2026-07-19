"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { adminNotify } from "@/modules/admin/components/notification";
import { Upload, Loader2, Plus, X } from "lucide-react";
import { compressImage } from "@/utils/compress-image";

const MAX_FILES = 4;

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
    if (filesArray.length > MAX_FILES) {
      adminNotify.error(`You can upload up to ${MAX_FILES} images`);
    }
    const capped = filesArray.slice(0, MAX_FILES);
    setFiles(capped);

    const previewUrls = capped.map(file => URL.createObjectURL(file));
    setPreviews(previewUrls);
  }

  function removeFile(index) {
    URL.revokeObjectURL(previews[index]);
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (files.length === 0) return adminNotify.error("Select at least one file");

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

      adminNotify.success(`Created collection "${data.collection.name}" with ${data.collection.fileCount} images`);
      onUploaded();
      onClose();
    } catch (err) {
      adminNotify.error(err.message || "Upload failed");
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
            <label className="text-xs font-medium text-neutral-600 mb-2 block">
              Images (up to {MAX_FILES})
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFiles(e.dataTransfer.files);
              }}
              className="border-2 border-dashed bg-[#c7f038]/15 border-[#c7f038] rounded-xl p-6 text-center cursor-pointer transition-all"
            >
              {previews.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {previews.map((preview, idx) => (
                    <div key={idx} className="relative h-20 w-full rounded-lg overflow-hidden">
                      <Image
                        src={preview}
                        alt="Preview"
                        fill
                        unoptimized
                        sizes="120px"
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-neutral-600">
                  <Upload className="w-8 h-8" />
                  <p className="text-sm">Click or drag & drop images here</p>
                  <p className="text-xs">PNG, JPG, WEBP | Up to {MAX_FILES} images</p>
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
            <label className="text-xs font-medium text-neutral-600 mb-2 block">
              Collection Name
            </label>
            <input
              type="text"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              placeholder="e.g., Summer Collection 2024"
              required
              className="w-full bg-white border border-gray-200 rounded-md px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#c7f038] transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={uploading || files.length === 0}
            className="w-full bg-[#c7f038] disabled:opacity-75 text-black disabled:cursor-not-allowed py-2 rounded-md text-sm transition-all"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating Collection
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                Create Collection
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
