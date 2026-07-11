"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronLeft, ChevronRight, ImagePlus, Loader2, User2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const FIELD_LABELS = {
  propertyClassification: "Classification",
  projectName: "Project Name",
  projectType: "Project Type",
  projectArea: "Project Area",
  location: "Location",
  tonality: "Tonality",
  landmarks: "Landmarks",
  connectivity: "Connectivity",
  shopType: "Shop Type",
  shopBuiltUpArea: "Shop Built-up Area",
  footfall: "Footfall",
  brandRelationships: "Brand Relationships",
  revenuePotential: "Revenue Potential",
  carpetArea: "Carpet Area",
  amenities: "Amenities",
  features: "Features",
  gatedCommunity: "Gated Community",
  waterSupplyAreaType: "Water Supply & Area Type",
  nearbySettlements: "Nearby Settlements",
  language: "Speaker Language",
};

// Order the recap follows — anything in scriptValues not listed here still
// renders, just appended after these in whatever order it comes in.
const FIELD_ORDER = [
  "propertyClassification", "projectName", "projectType", "projectArea", "location",
  "tonality", "landmarks", "connectivity",
  "shopType", "shopBuiltUpArea", "footfall", "brandRelationships", "revenuePotential",
  "carpetArea", "amenities", "features", "gatedCommunity", "waterSupplyAreaType", "nearbySettlements",
  "language",
];

function Section({ icon: Icon, title, children }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#c7f038]" />
        </div>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// Step 2 for every template's pipeline. Recaps what the user picked in
// Add Assets (photos + presenter) and Script (site details form), then
// turns the storyboard's text frames into actual Nano Banana images via
// /api/template/generate-images/[slug] and shows the finished storyboard.
// Continue hands the rendered image frames off to the runner, which moves
// on to StepGeneration (Phase 4: animating each frame into a clip).
export function StepFinalize({ template, storyboard, images = [], selectedAvatars = [], scriptValues = {}, onBack, onContinue }) {
  const [renderedFrames, setRenderedFrames] = useState(null);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [imagesError, setImagesError] = useState(null);

  // Set synchronously the instant a request starts — state flags like
  // `generatingImages` aren't set until React commits the re-render, so two
  // effect firings back-to-back (Strict Mode's dev double-invoke, or any
  // other double-mount) can both pass a state-only guard before either
  // commits. This ref is what actually stops the second fetch from firing —
  // this project's real fal.ai cost leak on this exact effect shape.
  //
  // Because this ref guarantees the fetch below only ever fires once, ever,
  // there is no second/newer request that could make this one "stale" — so
  // its result must always be applied when it resolves. (A previous version
  // of this effect also tracked a `cancelled` flag via the cleanup function,
  // a pattern meant to discard a superseded request's result — but combined
  // with this ref, it instead discarded the ONLY request's result during
  // Strict Mode's dev-only mount→cleanup→mount cycle: the cleanup marked
  // the one real fetch "cancelled" before it resolved, so a successful
  // response never reached setRenderedFrames. Removed for that reason.)
  const startedRef = useRef(false);

  useEffect(() => {
    if (!storyboard?.length || startedRef.current) return;
    startedRef.current = true;

    (async () => {
      setGeneratingImages(true);
      setImagesError(null);
      try {
        // Asset-anchored: each `storyboard` frame already carries its own
        // avatar_url/reference_image_url (assigned once, when the script
        // was generated) — nothing extra to send here.
        const res = await fetch(`/api/template/generate-images/${template.slug}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ frames: storyboard }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Image generation failed");
        setRenderedFrames(data.frames);
      } catch (err) {
        setImagesError(err.message);
        toast.error("Storyboard image generation failed", { description: err.message });
      } finally {
        setGeneratingImages(false);
      }
    })();
    // Intentionally mount-only (startedRef enforces that) — images/selectedAvatars
    // are read once at that point, not tracked as reactive deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyboard, template.slug]);

  const propertyPhotos = images.filter((img) => img.r2Url || img.url);
  const scriptFields = FIELD_ORDER
    .filter((key) => scriptValues[key] !== undefined && scriptValues[key] !== "" && scriptValues[key] !== null)
    .map((key) => ({ key, label: FIELD_LABELS[key] || key, value: scriptValues[key] }));
  Object.keys(scriptValues).forEach((key) => {
    if (key === "propertyImages" || FIELD_ORDER.includes(key)) return;
    if (scriptValues[key] === undefined || scriptValues[key] === "" || scriptValues[key] === null) return;
    scriptFields.push({ key, label: FIELD_LABELS[key] || key, value: scriptValues[key] });
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Assets recap ── */}
      <Section icon={ImagePlus} title="Property Photos">
        {propertyPhotos.length === 0 ? (
          <p className="text-xs text-neutral-400">No photos uploaded.</p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {propertyPhotos.map((img, idx) => (
              <div key={img.id || idx} className="aspect-square rounded-lg overflow-hidden border border-border/40">
                <img src={img.r2Url || img.url} alt={img.name} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={User2} title="Presenter / Avatar">
        {selectedAvatars.length === 0 ? (
          <p className="text-xs text-neutral-400">No presenter selected.</p>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl overflow-hidden border border-border/40 shrink-0">
              <img src={selectedAvatars[0].url} alt={selectedAvatars[0].name} className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-900">{selectedAvatars[0].name || "Custom presenter"}</p>
              <p className="text-xs text-neutral-500">
                {selectedAvatars.length} angle{selectedAvatars.length !== 1 ? "s" : ""} selected
              </p>
            </div>
          </div>
        )}
      </Section>

      {/* ── Script recap ── */}
      <Section icon={CheckCircle2} title="Site Details">
        {scriptFields.length === 0 ? (
          <p className="text-xs text-neutral-400">No details submitted.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 rounded-xl border border-border/50 p-3 bg-card/50">
            {scriptFields.map((f) => (
              <div key={f.key} className="text-xs">
                <span className="text-neutral-400">{f.label}: </span>
                <span className="text-neutral-800 font-medium">{String(f.value)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Storyboard ── */}
      <Section icon={ImagePlus} title="Storyboard">
        {generatingImages && (
          <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Rendering storyboard frames...
          </div>
        )}

        {!generatingImages && imagesError && (
          <p className="text-xs text-red-500">{imagesError}</p>
        )}

        {!generatingImages && renderedFrames && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {renderedFrames.map((f) => (
              <div key={f.frame} className="rounded-xl border border-border/40 overflow-hidden bg-card/50">
                <div className="aspect-9/16 bg-black">
                  <img src={f.imageUrl} alt={`Frame ${f.frame}`} className="w-full h-full object-cover" />
                </div>
                <div className="p-2 space-y-1">
                  <p className="text-[10px] font-semibold text-neutral-500">Frame {f.frame}</p>
                  <p className="text-[11px] text-neutral-700 leading-snug">{f.narration}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="cursor-pointer">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>

        <Button
          onClick={() => onContinue?.(renderedFrames)}
          disabled={!renderedFrames || generatingImages || !!imagesError}
          className="bg-neutral-900 text-[#c7f038] hover:opacity-90 hover:bg-neutral-900 disabled:opacity-70 shadow-lg gap-2 px-6"
        >
          Continue to Generate Video
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
