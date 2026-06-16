import {
  X,
  ImagePlus,
  MapPin,
  Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRef } from "react";

export default function MultiImageUploadBox({ images, onAdd, onRemove, maxImages = 3 }) {
  const inputRef = useRef(null);

  function handleFiles(files) {
    const valid = Array.from(files).filter((f) => f.type.startsWith("image/"));
    valid.forEach((f) => {
      if (images.length < maxImages) onAdd(f);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Building2 className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Property Images</span>
        <Badge variant="outline" className="text-[10px] ml-auto">{images.length}/{maxImages}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Upload 1-{maxImages} property images. A composite will be created for each.
      </p>

      {images.length > 0 && (
        <div className={`grid gap-3 ${images.length === 1 ? "grid-cols-1 max-w-xs mx-auto" : images.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {images.map((img, i) => (
            <div key={i} className="relative rounded-xl overflow-hidden border border-border/50 shadow-md group aspect-[4/3]">
              <img src={URL.createObjectURL(img)} alt={`Property ${i + 1}`} className="w-full h-full object-cover" />
              <button
                onClick={() => onRemove(i)}
                className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <X className="w-3 h-3 text-white" />
              </button>
              <Badge className="absolute top-2 left-2 bg-black/70 text-white border-0 text-[10px] backdrop-blur-sm">
                <MapPin className="w-2.5 h-2.5 mr-0.5" /> Property {i + 1}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {images.length < maxImages && (
        <div
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary", "bg-primary/5"); }}
          onDragLeave={(e) => { e.currentTarget.classList.remove("border-primary", "bg-primary/5"); }}
          onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-primary", "bg-primary/5"); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-border/50 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer"
        >
          <ImagePlus className="w-5 h-5 text-primary" />
          <p className="text-xs text-muted-foreground">
            {images.length === 0 ? "Upload property images (1-3)" : `Add more (${maxImages - images.length} remaining)`}
          </p>
          <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); }} />
        </div>
      )}
    </div>
  );
}