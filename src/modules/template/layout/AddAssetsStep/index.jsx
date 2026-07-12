"use client";

import { useState } from "react";
import { ChevronRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PropertyImages } from "@/modules/template/components/PropertyImages";
import { ModelSelector } from "@/modules/template/components/ModelSelector";

// Step 0 for every template's pipeline: property photos + presenter/avatar,
// side by side. This is the one shared "Add Assets" step — a template just
// supplies its own state (images, avatarHook) and copy (max photos, the
// prebuilt-avatar label, its own upload endpoint); the layout, validation
// wiring, and clear-confirm flow are identical everywhere, so adding
// template #51 means composing this, not rebuilding it.
//
// Asset-anchored architecture: the backend never guesses the presenter's
// gender (no vision classification, no hardcoding) — the user picks it
// right here, once, when they choose their avatar. `avatarGender`/
// `setAvatarGender` are optional so templates that don't need Veo's native
// dialogue (and therefore don't need a gender flag at all) can omit them.
export function AddAssetsStep({
  images,
  setImages,
  avatarHook,
  onNext,
  isValid,
  onClear,
  max = 10,
  helpHref,
  prebuiltLabel,
  uploadEndpoint,
  continueLabel = "Continue to Script",
  avatarGender,
  setAvatarGender,
}) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid md:grid-cols-2 gap-6">
        <PropertyImages images={images} setImages={setImages} max={max} helpHref={helpHref} />
        <div className="space-y-3">
          <ModelSelector avatarHook={avatarHook} prebuiltLabel={prebuiltLabel} uploadEndpoint={uploadEndpoint} />
          {setAvatarGender && avatarHook.selectedAvatars.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Presenter gender:</span>
              {["Male", "Female"].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setAvatarGender(g)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    avatarGender === g
                      ? "bg-primary text-white shadow"
                      : "border border-border/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        {onClear ? (
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="text-sm rounded-md text-white bg-red-500 px-6 py-2 transition-colors"
          >
            Clear all data
          </button>
        ) : (
          <span />
        )}

        <Button
          onClick={onNext}
          disabled={!isValid}
          className="bg-neutral-900 text-[#c7f038] hover:opacity-90 hover:bg-neutral-900 disabled:opacity-70 shadow-lg gap-2 px-6"
        >
          {continueLabel}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <DialogTitle>Clear all data?</DialogTitle>
            </div>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This clears all saved photos, presenter selection, and script data for this reel. This can&apos;t be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowClearConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowClearConfirm(false);
                onClear();
              }}
            >
              Clear all data
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
