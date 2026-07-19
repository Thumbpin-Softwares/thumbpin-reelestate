"use client";

import Image from "next/image";
import { Eye } from "lucide-react";

// Collection Card Component — matches the client-side prebuilt avatar
// library's CollectionCard (client/src/modules/common/components/collection-card).
export function CollectionCard({ collection, onClick }) {
  return (
    <div
      onClick={() => onClick(collection.id)}
      className="group relative cursor-pointer rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-all"
    >
      <div className="relative aspect-9/16 overflow-hidden bg-gray-100">
        <Image
          src={collection.coverImage}
          alt={collection.name}
          fill
          unoptimized
          sizes="(max-width: 640px) 50vw, 25vw"
          className="object-cover"
          onError={(e) => {
            e.target.src = "https://placehold.co/400x700?text=No+Image";
          }}
        />
      </div>
      <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />

      {collection.fileCount > 1 && (
        <div className="absolute top-2 left-2 z-10 rounded-full bg-black/70 px-2 py-1 text-[10px] text-white">
          {collection.fileCount} photos
        </div>
      )}

      <div className="absolute inset-0 z-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black text-xs font-medium shadow-lg hover:bg-gray-100 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          View
        </button>
      </div>

      <p className="absolute bottom-2 left-2 right-2 z-10 text-[11px] text-white font-medium truncate pointer-events-none">
        {collection.name}
      </p>
    </div>
  );
}
