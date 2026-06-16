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
  ChevronDown,
  User,
  X,
  Building2,
  Images,
  BookMarked,
  Trash2,
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
  const [expandedCollection, setExpandedCollection] = useState(null);

  const {
    avatarMode,
    setAvatarMode,
    selectedAvatars,
    setSelectedAvatars,
    selectedCollectionId,
    selectCollection,
    isCollectionSelected,
    uploadedAvatarFile,
    toggleAvatarSelection,
    clearSelectedAvatars,
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
    uploadedAvatarFiles,
    setUploadedAvatarFiles,
    handleUploadFile,
    selectUploadedAvatar,
    toggleUploadedAvatar,
    removeUploadedAvatar,
    fetchReAvatars,
    library,
    selectLibraryAvatar,
    deleteLibraryAvatar,
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

      {/* Selected Avatar Indicator */}
      {selectedAvatars.length > 0 && (
        <div className="flex items-center justify-between bg-primary/5 rounded-lg px-3 py-2 border border-primary/20">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">
              1 avatar selected
              {selectedAvatars.length > 1 && (
                <span className="text-xs text-muted-foreground ml-1">({selectedAvatars.length} poses)</span>
              )}
            </span>
          </div>
          <button
            onClick={clearSelectedAvatars}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* Avatar selection */}
      <div className="space-y-4">
        <div className="flex gap-2">
          {AVATAR_MODES.map((mode) => {
            const IconComponent = mode.icon === "PersonStanding" ? PersonStanding :
                                 mode.icon === "BookMarked" ? BookMarked :
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

        {/* Prebuilt Avatars — Collection-based */}
        {avatarMode === "prebuilt" && (
          <div>
            {reAvatarsLoading && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] rounded-xl bg-muted/60 animate-pulse" />
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {reAvatars.map((collection) => {
                  const isSelected = isCollectionSelected(collection.id);
                  const isExpanded = expandedCollection === collection.id;
                  
                  return (
                    <div key={collection.id} className="group/coll space-y-2">
                      {/* Collection Card */}
                      <div
                        className={`relative rounded-2xl overflow-hidden border-2 transition-all cursor-pointer ${
                          isSelected
                            ? "border-primary ring-4 ring-primary/20 scale-[1.02] shadow-xl"
                            : "border-border/40 hover:border-primary/40 bg-card shadow-sm hover:shadow-md"
                        }`}
                        onClick={() => selectCollection(collection)}
                      >
                        {/* Cover Image */}
                        <div className="aspect-[4/5] overflow-hidden">
                          <img
                            src={collection.coverImage}
                            alt={collection.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover/coll:scale-110"
                          />
                        </div>
                        
                        {/* Selection check */}
                        {isSelected && (
                          <div className="absolute top-3 left-3 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg animate-in zoom-in-50">
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          </div>
                        )}

                        {/* Collection Badge */}
                        {(collection.id?.startsWith("db-") || collection.id?.startsWith("legacy-")) ? (
                          <Badge className="absolute top-3 right-3 bg-emerald-600 hover:bg-emerald-600 text-white border-0 text-[9px] font-bold tracking-wider py-0.5 px-1.5 shadow-sm">
                            YOUR UPLOAD
                          </Badge>
                        ) : (
                          <Badge className="absolute top-3 right-3 bg-black/60 text-white border-0 text-[9px] backdrop-blur-md font-bold tracking-wider py-0.5">
                            COLLECTION
                          </Badge>
                        )}

                        {/* Info bar */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 py-4">
                          <p className="text-xs text-white font-bold truncate leading-tight mb-1">{collection.name}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Images className="w-3 h-3 text-white/70" />
                              <p className="text-[10px] text-white/80 font-medium">
                                {collection.imageCount} {collection.imageCount === 1 ? "angle" : "angles"}
                              </p>
                            </div>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedCollection(isExpanded ? null : collection.id);
                              }}
                              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                isExpanded ? 'bg-primary text-white' : 'bg-white/20 text-white hover:bg-white/40'
                              }`}
                            >
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="absolute bottom-0 left-0 right-0 bg-primary px-2 py-1.5 translate-y-full group-hover/coll:translate-y-0 transition-transform">
                            <p className="text-[10px] text-white text-center font-bold tracking-tight">SELECTED PRESENTER</p>
                          </div>
                        )}
                      </div>

                      {/* Expanded poses gallery */}
                      {isExpanded && collection.imageCount > 1 && (
                        <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-muted/30 border border-border/30 animate-in slide-in-from-top-2 duration-300">
                          {collection.images.map((img, i) => (
                            <div
                              key={i}
                              className="relative aspect-square rounded-lg overflow-hidden border border-border/30 group/pose cursor-zoom-in"
                              onClick={(e) => { e.stopPropagation(); setLightboxUrl(img.url); }}
                            >
                              <img
                                src={img.url}
                                alt={`Pose ${i + 1}`}
                                className="w-full h-full object-cover transition-transform hover:scale-110"
                              />
                              <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors" />
                              <Badge className="absolute bottom-1 right-1 bg-black/70 text-white text-[8px] px-1 py-0 border-0 pointer-events-none">
                                {i === 0 ? "Front" : i === 1 ? "3/4" : "Side"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Your Library */}
        {avatarMode === "library" && (
          <div className="animate-in fade-in duration-300">
            {reAvatarsLoading && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl bg-muted/60 animate-pulse" />
                ))}
              </div>
            )}

            {!reAvatarsLoading && library.length === 0 && (
              <div className="rounded-xl border border-border/40 bg-muted/30 p-8 flex flex-col items-center gap-2">
                <BookMarked className="w-6 h-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground text-center">
                  No saved avatars yet. Upload a photo or generate one with AI — it'll appear here.
                </p>
              </div>
            )}

            {!reAvatarsLoading && library.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {library.map((item) => {
                  const isSelected = selectedAvatars.some((a) => a.key === item.id);
                  return (
                    <div
                      key={item.id}
                      className={`group relative rounded-2xl overflow-hidden border-2 transition-all cursor-pointer aspect-square ${
                        isSelected
                          ? "border-primary ring-4 ring-primary/20 scale-[1.02] shadow-xl"
                          : "border-border/40 hover:border-primary/40 bg-card shadow-sm hover:shadow-md"
                      }`}
                      onClick={() => selectLibraryAvatar(item)}
                    >
                      <img
                        src={item.url}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />

                      {isSelected && (
                        <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md animate-in zoom-in-50">
                          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}

                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteLibraryAvatar(item.id);
                        }}
                        className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer shadow-md"
                        title="Remove from library"
                      >
                        <Trash2 className="w-3 h-3 text-white" />
                      </button>

                      {/* Name strip */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 py-2">
                        <p className="text-[10px] text-white font-semibold truncate leading-tight">
                          {item.name}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Upload Avatar */}
        {avatarMode === "upload" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Grid of uploaded avatars */}
            {uploadedAvatarFiles.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Custom Presenters ({uploadedAvatarFiles.length}/5)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {uploadedAvatarFiles.map((upload) => {
                    const isSelected = selectedAvatars.some(
                      (a) => a.key === upload.id || a.url === upload.url
                    );
                    return (
                      <div
                        key={upload.id}
                        onClick={() => toggleUploadedAvatar(upload)}
                        className={`group relative rounded-2xl overflow-hidden border-2 transition-all cursor-pointer aspect-square ${
                          isSelected
                            ? "border-primary ring-4 ring-primary/20 scale-[1.02] shadow-xl"
                            : "border-border/40 hover:border-primary/40 bg-card shadow-sm hover:shadow-md"
                        }`}
                      >
                        <img
                          src={upload.url}
                          alt={upload.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        
                        {/* Selected Check Badge */}
                        {isSelected && (
                          <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md animate-in zoom-in-50">
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}

                        {/* Custom Presenter Emerald Badge */}
                        <Badge className="absolute top-2 right-2 bg-emerald-600 hover:bg-emerald-600 text-white border-0 text-[8px] font-bold py-0.5 px-1.5 shadow-sm">
                          YOUR UPLOAD
                        </Badge>

                        {/* Loading Spinner for Upload state */}
                        {upload.isUploading && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-1.5 animate-in fade-in">
                            <Loader2 className="w-6 h-6 text-primary animate-spin" />
                            <span className="text-[10px] text-white font-medium">Saving...</span>
                          </div>
                        )}

                        {/* Remove close button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeUploadedAvatar(upload.id);
                          }}
                          className="absolute bottom-2 right-2 w-6 h-6 bg-black/70 hover:bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer shadow-md"
                          title="Remove custom presenter"
                        >
                          <X className="w-3.5 h-3.5 text-white" />
                        </button>

                        {/* Footer name strip */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 py-2">
                          <p className="text-[10px] text-white font-semibold truncate leading-tight">
                            {upload.name}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dropzone trigger / library selector */}
            {uploadedAvatarFiles.length < 5 && (
              <div className="space-y-4">
                <div
                  onClick={() => document.getElementById("avatar-upload-input")?.click()}
                  className="border-2 border-dashed border-border/50 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 hover:border-primary/55 hover:bg-primary/5 transition-all cursor-pointer group bg-card/50"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-foreground">Upload a Presenter Photo</p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      Supports PNG, JPG, or JPEG. Clear face with good lighting works best.
                    </p>
                  </div>
                  <input 
                    id="avatar-upload-input" 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleUploadFile(file);
                        // Reset input value so same file can be uploaded again if deleted
                        e.target.value = "";
                      }
                    }} 
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Or choose from your assets</Label>
                  <AssetSelector
                    type="avatars"
                    onSelect={async (asset) => {
                      try {
                        const res = await fetch(asset.url);
                        const blob = await res.blob();
                        const file = new File([blob], asset.name || "Library Avatar", { type: blob.type });
                        
                        if (uploadedAvatarFiles.length >= 5) {
                          toast.error("You can upload up to 5 custom presenters.");
                          return;
                        }
                        
                        const id = asset.id || asset._id || `lib-${Date.now()}`;
                        const newUpload = {
                          id,
                          file,
                          url: asset.url,
                          name: asset.name || "Library Avatar",
                          isUploading: false,
                          isSaved: true
                        };
                        
                        const updatedFiles = [...uploadedAvatarFiles, newUpload];
                        setUploadedAvatarFiles(updatedFiles);
                        
                        // Select it
                        const avatarObj = {
                          url: asset.url,
                          file: file,
                          name: asset.name,
                          key: id,
                          angle: "front",
                        };
                        setSelectedAvatars([avatarObj]);
                        setUploadedAvatarFile(file);
                        toast.success(`Selected "${asset.name}" from library!`);
                      } catch (err) { 
                        toast.error("Failed to load asset"); 
                      }
                    }}
                  />
                </div>
              </div>
            )}
            
            {uploadedAvatarFiles.length >= 5 && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-center animate-in slide-in-from-top-2 duration-300">
                <p className="text-xs text-amber-500 font-medium">
                  Maximum of 5 custom presenters reached. Remove one to upload another.
                </p>
              </div>
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

      {/* Next Button */}
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