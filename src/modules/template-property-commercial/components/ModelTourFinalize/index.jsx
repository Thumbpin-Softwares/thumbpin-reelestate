"use client";

import { CheckCircle2, ChevronLeft, ChevronRight, ImagePlus, User2 } from "lucide-react";
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
  carpetArea: "Carpet Area",
  amenities: "Amenities",
  features: "Features",
  gatedCommunity: "Gated Community",
  waterSupplyAreaType: "Water Supply & Area Type",
  nearbySettlements: "Nearby Settlements",
  language: "Speaker Language",
  vibe: "Vibe",
};

const FIELD_ORDER = [
  "propertyClassification", "projectName", "projectType", "projectArea", "location",
  "tonality", "landmarks", "connectivity",
  "carpetArea", "amenities", "features", "gatedCommunity", "waterSupplyAreaType", "nearbySettlements",
  "language", "vibe",
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

// Review step for the residential (omni-hometour-pipeline) flow — recaps
// what the user picked in Add Assets (photos + presenter) and Script (site
// details form) before the "Generate" click actually fires the workflow.
// Unlike the generic pipeline's StepFinalize, there's nothing async to run
// here (no storyboard/image rendering) — it's a pure summary + confirm.
export function ModelTourFinalize({ images = [], selectedAvatars = [], scriptValues = {}, onBack, onGenerate }) {
  const propertyPhotos = images.filter((img) => img.r2Url || img.url);
  const scriptFields = FIELD_ORDER
    .filter((key) => scriptValues[key] !== undefined && scriptValues[key] !== "" && scriptValues[key] !== null)
    .map((key) => ({ key, label: FIELD_LABELS[key] || key, value: scriptValues[key] }));
  Object.keys(scriptValues).forEach((key) => {
    if (key === "propertyImages" || key === "avatarImage" || FIELD_ORDER.includes(key)) return;
    if (scriptValues[key] === undefined || scriptValues[key] === "" || scriptValues[key] === null) return;
    scriptFields.push({ key, label: FIELD_LABELS[key] || key, value: scriptValues[key] });
  });

  return (
    <div className="space-y-6 animate-fade-in">
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

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="cursor-pointer">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>

        <Button
          onClick={onGenerate}
          className="bg-neutral-900 text-[#c7f038] hover:opacity-90 hover:bg-neutral-900 shadow-lg gap-2 px-6"
        >
          Generate Video
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
