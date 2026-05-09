import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  PersonStanding,
  Upload,
  Sparkles,
  Loader2,
  CheckCircle2,
  ChevronRight,
  User,
  X,
  Building2,
} from "lucide-react";
import { AssetSelector } from "@/components/dashboard/asset-selector";
import MultiImageUploadBox from "@/modules/ai-walkthrough/components/MultiImageUploadBox";
import { dataUrlToFile } from "../../helpers/fileHelpers";
import { AVATAR_MODES } from "@/utils/constants";

export const Step0Upload = ({ 
  propertyImages, 
  setPropertyImages, 
  avatarHook, 
  propertyBriefHook, 
  onNext, 
  isValid 
}) => {
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const {
    avatarMode,
    setAvatarMode,
    selectedAvatars, // Changed from selectedAvatar to selectedAvatars
    setSelectedAvatars, // Changed from setSelectedAvatar to setSelectedAvatars
    uploadedAvatarFile,
    toggleAvatarSelection,  // Add this
    clearSelectedAvatars,   // Add this
    isAvatarSelected, 
    setUploadedAvatarFile,
    avatarPrompt,
    setAvatarPrompt,
    avatarVariantCount,
    setAvatarVariantCount,
    generatedAvatars,
    generatingAvatar,
    reAvatars,
    reAvatarsLoading,
    reAvatarsError,
    handleGenerateAvatars,
    selectAvatarFromGeneration,
  } = avatarHook;

  const { getFilledCount, setPropertyDrawerOpen } = propertyBriefHook;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Property Images Upload */}
      <MultiImageUploadBox
        images={propertyImages}
        onAdd={(file) => setPropertyImages((prev) => [...prev, file].slice(0, 3))}
        onRemove={(i) => setPropertyImages((prev) => prev.filter((_, idx) => idx !== i))}
        maxImages={3}
      />

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Choose Your Presenter</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Selected Avatars Counter */}
      {selectedAvatars.length > 0 && (
        <div className="flex items-center justify-between bg-primary/5 rounded-lg px-3 py-2 border border-primary/20">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">
              {selectedAvatars.length} avatar{selectedAvatars.length > 1 ? 's' : ''} selected
            </span>
          </div>
          <button
            onClick={clearSelectedAvatars}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Avatar selection */}
      <div className="space-y-4">
        <div className="flex gap-2">
          {AVATAR_MODES.map((mode) => {
            const IconComponent = mode.icon === "PersonStanding" ? PersonStanding : 
                                 mode.icon === "Upload" ? Upload : Sparkles;
            return (
              <button
                key={mode.id}
                onClick={() => { setAvatarMode(mode.id); clearSelectedAvatars(); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  avatarMode === mode.id ? "gradient-bg text-white shadow-md" : 
                  "border border-border hover:border-primary/40 text-muted-foreground"
                }`}
              >
                <IconComponent className="w-3.5 h-3.5" />
                {mode.label}
              </button>
            );
          })}
        </div>

        {/* Prebuilt Avatars */}
        {avatarMode === "prebuilt" && (
          <div>
            {reAvatarsLoading && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl bg-muted/60 animate-pulse" />
                ))}
              </div>
            )}

            {!reAvatarsLoading && reAvatarsError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex flex-col items-center gap-2">
                <p className="text-xs text-destructive">{reAvatarsError}</p>
                <button
                  onClick={() => setAvatarMode("prebuilt")}
                  className="text-xs text-primary underline cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {!reAvatarsLoading && !reAvatarsError && reAvatars.length === 0 && (
              <div className="rounded-xl border border-border/40 bg-muted/30 p-6 flex flex-col items-center gap-2">
                <PersonStanding className="w-6 h-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground text-center">
                  No RE avatars available yet. Ask your admin to upload some.
                </p>
              </div>
            )}

            {!reAvatarsLoading && !reAvatarsError && reAvatars.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {reAvatars.map((av) => {
                  const isSelected = isAvatarSelected(av);
                  return (
                    <div
                      key={av.id}
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all group cursor-pointer ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/30 scale-105"
                          : "border-border/50 hover:border-primary/50"
                      }`}
                      onClick={() => toggleAvatarSelection({ url: av.url, key: av.key, file: null, name: av.name })}
                    >
                      <img
                        src={av.url}
                        alt={av.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); setLightboxUrl(av.url); }}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full items-center justify-center hidden group-hover:flex transition-all cursor-pointer"
                        title="Expand"
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                      </button>
                      {isSelected && (
                        <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-white text-center truncate">{av.name}</p>
                      </div>
                      {isSelected && (
                        <div className="absolute bottom-0 left-0 right-0 bg-primary/80 px-1 py-0.5">
                          <p className="text-[8px] text-white text-center">Selected</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Upload Avatar */}
        {avatarMode === "upload" && (
          <div className="space-y-4">
            {uploadedAvatarFile ? (
              <div className="relative rounded-xl overflow-hidden border border-border/50 shadow-md bg-card group max-w-[200px]">
                <img src={URL.createObjectURL(uploadedAvatarFile)} alt="Avatar" className="w-full aspect-square object-cover" />
                <button
                  onClick={() => { setUploadedAvatarFile(null); clearSelectedAvatars(); }}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            ) : (
              <>
                <div
                  onClick={() => document.getElementById("avatar-upload-input")?.click()}
                  className="border-2 border-dashed border-border/50 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer"
                >
                  <User className="w-5 h-5 text-primary" />
                  <p className="text-xs text-muted-foreground">Upload a clear photo of the presenter</p>
                  <input 
                    id="avatar-upload-input" 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setUploadedAvatarFile(file);
                        const newAvatar = { url: URL.createObjectURL(file), file, name: "Custom", key: `upload-${Date.now()}` };
                        // For upload mode, we allow selecting this as one of the avatars
                        toggleAvatarSelection(newAvatar);
                      }
                    }} 
                  />
                </div>
                <AssetSelector type="avatars" onSelect={async (asset) => {
                  try {
                    const res = await fetch(asset.url);
                    const blob = await res.blob();
                    const file = new File([blob], asset.name, { type: blob.type });
                    const newAvatar = { url: URL.createObjectURL(file), file, name: asset.name, key: asset.id };
                    toggleAvatarSelection(newAvatar);
                  } catch (err) { 
                    toast.error("Failed to load asset"); 
                  }
                }} />
              </>
            )}
          </div>
        )}

        {/* Generate Avatar */}
        {avatarMode === "generate" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Describe the avatar</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                value={avatarPrompt}
                onChange={(e) => setAvatarPrompt(e.target.value)}
                placeholder="e.g., A confident Indian man in his 30s wearing formal business attire, warm professional smile..."
                maxLength={500}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Variants</Label>
                <div className="flex gap-1.5">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      onClick={() => setAvatarVariantCount(n)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        avatarVariantCount === n ? "gradient-bg text-white" : 
                        "border border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <Button 
                onClick={handleGenerateAvatars} 
                disabled={generatingAvatar || avatarPrompt.trim().length < 10} 
                className="gradient-bg text-white shadow-md cursor-pointer mt-4" 
                size="sm"
              >
                {generatingAvatar ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate</>
                )}
              </Button>
            </div>
            {generatedAvatars.length > 0 && (
              <div className="grid grid-cols-3 gap-3 pt-2">
                {generatedAvatars.map((av, i) => {
                  const isSelected = isAvatarSelected(av);
                  return (
                    <button
                      key={i}
                      onClick={() => toggleAvatarSelection(av)}
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                        isSelected ? 
                        "border-primary ring-2 ring-primary/30 scale-105" : 
                        "border-border/50 hover:border-primary/50"
                      }`}
                    >
                      <img src={av.url} alt={`V${i + 1}`} className="w-full h-full object-cover" />
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <Badge className="absolute top-1 left-1 bg-primary/80 text-white text-[8px] px-1 py-0 border-0">
                        V{i + 1}
                      </Badge>
                      {isSelected && (
                        <div className="absolute bottom-0 left-0 right-0 bg-primary/80 px-1 py-0.5">
                          <p className="text-[8px] text-white text-center">Selected</p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Property Details Drawer Trigger */}
      <button
        onClick={() => setPropertyDrawerOpen(true)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Property Details</span>
          <span className="text-xs text-muted-foreground">(optional — helps AI write better scripts)</span>
        </div>
        <div className="flex items-center gap-2">
          {getFilledCount() > 0 && (
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
              {getFilledCount()} filled
            </Badge>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </button>

      {/* Next Button - Updated validation */}
      <div className="flex justify-end">
        <Button 
          onClick={onNext} 
          disabled={!isValid || selectedAvatars.length === 0} 
          className="gradient-bg text-white shadow-md cursor-pointer px-6"
        >
          Create Composites<ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxUrl} alt="Avatar preview" className="w-full rounded-2xl shadow-2xl border border-white/10" />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-3 right-3 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};