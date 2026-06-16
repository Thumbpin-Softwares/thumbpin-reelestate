"use client";

import { useState, useRef } from "react";
import { useHeygen } from "@/hooks/use-heygen";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Upload,
  User,
  Check,
  Loader2,
  Image as ImageIcon,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

export function HeygenAvatarSelector({ selectedId, onSelect, onTalkingPhotoUpload }) {
  const { avatars, loading, uploading, uploadTalkingPhoto } = useHeygen();
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(24);
  const fileInputRef = useRef(null);

  const filteredAvatars = avatars.filter((a) =>
    a.avatar_name?.toLowerCase().includes(search.toLowerCase())
  );

  const paginatedAvatars = filteredAvatars.slice(0, visibleCount);
  const hasMore = visibleCount < filteredAvatars.length;

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await uploadTalkingPhoto(file);
    if (result.success) {
      toast.success("Talking photo created!");
      if (onTalkingPhotoUpload) {
        onTalkingPhotoUpload(result.talking_photo_id);
      }
    } else {
      toast.error("Upload failed", { description: result.error });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search Heygen avatars..."
            className="pl-9 h-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisibleCount(24); // Reset pagination on search
            }}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Upload Photo
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleFileUpload}
        />
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[350px] overflow-y-auto p-1 scrollbar-hide">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))
        ) : (
          paginatedAvatars.map((avatar) => (
            <Card
              key={avatar.avatar_id}
              className={`relative aspect-square cursor-pointer overflow-hidden transition-all hover:ring-2 hover:ring-primary/50 group ${
                selectedId === avatar.avatar_id
                  ? "ring-2 ring-primary bg-primary/5"
                  : "border-border/50"
              }`}
              onClick={() => onSelect(avatar.avatar_id)}
            >
              <CardContent className="p-0 h-full">
                {avatar.preview_image_url ? (
                  <img
                    src={avatar.preview_image_url}
                    alt={avatar.avatar_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <User className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[10px] text-white truncate text-center font-medium">
                    {avatar.avatar_name}
                  </p>
                </div>
                {selectedId === avatar.avatar_id && (
                  <div className="absolute top-1 right-1 bg-primary text-white rounded-full p-0.5 shadow-md">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}

        {hasMore && !loading && (
          <div className="col-span-full pt-2 flex justify-center">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
              onClick={() => setVisibleCount(prev => prev + 24)}
            >
              Load more avatars
            </Button>
          </div>
        )}
      </div>

      {filteredAvatars.length === 0 && !loading && (
        <div className="text-center py-8 border-2 border-dashed rounded-lg border-border/50">
          <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-20" />
          <p className="text-sm text-muted-foreground">No avatars found</p>
        </div>
      )}
    </div>
  );
}
