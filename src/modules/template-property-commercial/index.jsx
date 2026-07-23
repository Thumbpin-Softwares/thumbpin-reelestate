"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAvatars } from "@/modules/common/hooks/useAvatars";
import { StepCapsule } from "@/modules/template/components/StepCapsule";
import { Breadcrumbs } from "@/modules/template/components/Breadcrumbs";
import { AddAssetsStep } from "@/modules/template/layout/AddAssetsStep";
import { StepScript } from "@/modules/template/layout/StepScript";
import { StepFinalize } from "@/modules/template/layout/StepFinalize";
import { StepGeneration } from "@/modules/template/layout/StepGeneration";
import { ModelTourGeneration } from "./components/ModelTourGeneration";
import { ModelTourGenerations } from "./components/ModelTourGenerations";
import { ModelTourFinalize } from "./components/ModelTourFinalize";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEP_LABELS = ["Add Assets", "Script", "Finalize"];

// Only Residential is wired to fal's omni-hometour-pipeline workflow (one
// direct call, no storyboard). Commercial and Plotted keep using the
// generic script -> images -> videos pipeline every other template uses.
const MODEL_TOUR_CLASSIFICATION = "residential";

// Persists the Add Assets / Script form (images already have permanent R2
// URLs by the time they're in state, avatar selection, and scriptValues) so
// a refresh doesn't lose progress. Only covers filling out the form —
// cleared the moment generation actually starts, since the generation phase
// has its own separate resume mechanism (jobId polling in ModelTourGeneration).
const FORM_STATE_KEY = "model-tour-form-state";

// Property Commercial's own runner — wires the shared template pieces
// (StepCapsule, AddAssetsStep, StepScript, StepFinalize, StepGeneration) to
// this template's state. On successful storyboard generation, step 2
// (Finalize) takes over — the raw frames aren't shown to the user, they're
// just handed to StepFinalize, which renders them into images and, once the
// user hits Continue, hands those image frames off to step 3 (StepGeneration)
// to animate into final clips.
export default function PropertyCommercialRunner({ template }) {
  const [step, setStep] = useState(0);
  const [images, setImages] = useState([]);
  const [scriptValues, setScriptValues] = useState({});
  const [generatingScript, setGeneratingScript] = useState(false);
  const [storyboard, setStoryboard] = useState(null);
  const [renderedFrames, setRenderedFrames] = useState(null);
  const [modelTourScript, setModelTourScript] = useState(null);
  const [generatingModelTourScript, setGeneratingModelTourScript] = useState(false);
  const [modelTourGenerating, setModelTourGenerating] = useState(false);
  const [showGenerations, setShowGenerations] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const avatarHook = useAvatars();

  // Restore on mount: if a generation was already in flight, jump straight
  // to the generation screen (it resumes the job itself via its own jobId
  // polling). Otherwise restore whatever the user had filled in so far.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("model-tour-job-id")) {
        setModelTourGenerating(true);
        setHydrated(true);
        return;
      }

      const raw = sessionStorage.getItem(FORM_STATE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (typeof saved.step === "number") setStep(saved.step);
        if (Array.isArray(saved.images)) setImages(saved.images);
        if (saved.scriptValues) setScriptValues(saved.scriptValues);
        if (saved.modelTourScript) setModelTourScript(saved.modelTourScript);
        if (saved.avatarMode) avatarHook.setAvatarMode(saved.avatarMode);
        if (Array.isArray(saved.selectedAvatars)) avatarHook.setSelectedAvatars(saved.selectedAvatars);
        if (saved.selectedCollectionId) avatarHook.setSelectedCollectionId(saved.selectedCollectionId);
      }
    } catch (_) {}
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on every change, only once hydration has run (otherwise the
  // initial empty state would overwrite what was just restored) and only
  // while the user is still filling out the form — not during generation.
  useEffect(() => {
    if (!hydrated || modelTourGenerating) return;
    try {
      sessionStorage.setItem(
        FORM_STATE_KEY,
        JSON.stringify({
          step,
          images,
          scriptValues,
          modelTourScript,
          avatarMode: avatarHook.avatarMode,
          selectedAvatars: avatarHook.selectedAvatars,
          selectedCollectionId: avatarHook.selectedCollectionId,
        })
      );
    } catch (_) {}
  }, [hydrated, modelTourGenerating, step, images, scriptValues, modelTourScript, avatarHook.avatarMode, avatarHook.selectedAvatars, avatarHook.selectedCollectionId]);

  // Only count photos once their R2 upload has actually finished — those
  // public URLs are what the script generator reads to ground its
  // image_prompts in the real property, so Continue shouldn't be reachable
  // while any are still uploading (or failed).
  //
  // No gender pick here anymore — Commercial/Plotted (the only classification
  // that ever needed it, for Veo's native dialogue) are disabled in SiteForm
  // until their pipeline is reworked, and Residential's omni-hometour-pipeline
  // has no gender field at all.
  const uploadedImages = images.filter((img) => img.r2Url);
  const isValid =
    images.length >= 1 &&
    uploadedImages.length === images.length &&
    avatarHook.selectedAvatars.length >= 1;

  // Derived at render time, not synced into state via an effect — always
  // reflects whatever's finished uploading so far, no cascading setState.
  const scriptValuesWithImages = {
    ...scriptValues,
    propertyImages: uploadedImages.map((img) => img.r2Url),
    avatarImage: avatarHook.selectedAvatars[0]?.url,
  };

  const handleClear = () => {
    setImages([]);
    setScriptValues({});
    setModelTourScript(null);
    setStep(0);
    avatarHook.clearSelectedAvatars();
    try {
      sessionStorage.removeItem(FORM_STATE_KEY);
    } catch (_) {}
  };

  // Extra lock on top of the disabled button — a rapid double-click can
  // land before React commits the `disabled` state from setGeneratingScript,
  // so the ref is what actually guarantees only one request goes out.
  const generatingScriptRef = useRef(false);

  const handleGenerateScript = async () => {
    if (generatingScriptRef.current) return;
    generatingScriptRef.current = true;
    setGeneratingScript(true);
    try {
      const res = await fetch(`/api/template/generate-script/${template.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: scriptValuesWithImages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Script generation failed");
      setStoryboard(data.frames);
      setStep(2);
      toast.success("Storyboard generated!");
    } catch (err) {
      toast.error("Script generation failed", { description: err.message });
    } finally {
      setGeneratingScript(false);
      generatingScriptRef.current = false;
    }
  };

  // Residential skips the generic storyboard pipeline entirely — n8n's
  // model-tour workflow does gender-detection/scripting/TTS/video, split
  // across two calls: /model-tour/script (checkpoint, synchronous, returns
  // editable JSON) and /model-tour/generate (fires the actual render).
  const modelTourScriptRequest = {
    propertyName: scriptValues.projectName || "",
    type: scriptValues.propertyClassification || undefined,
    locationLandmarks: scriptValues.landmarks || "",
    connectivity: scriptValues.connectivity || "",
    language: scriptValues.language || "",
    tierClass: scriptValues.projectType || "",
    carpetArea: scriptValues.carpetArea || "",
    amenities: scriptValues.amenities || "",
    tonality: scriptValues.tonality || "",
    vibe: scriptValues.vibe || "",
    avatarImageUrls: avatarHook.selectedAvatars.map((a) => a.url).slice(0, 4),
    propertyImageUrls: uploadedImages.map((img) => img.r2Url).slice(0, 4),
  };

  const handleGenerateModelTourScript = async () => {
    setGeneratingModelTourScript(true);
    try {
      const res = await fetch("/api/model-tour/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modelTourScriptRequest),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Script generation failed");
      setModelTourScript(data.script);
      setStep(2);
    } catch (err) {
      toast.error("Script generation failed", { description: err.message });
    } finally {
      setGeneratingModelTourScript(false);
    }
  };

  const handleContinueFromScript = () => {
    if (scriptValues.propertyClassification === MODEL_TOUR_CLASSIFICATION) {
      handleGenerateModelTourScript();
    } else {
      handleGenerateScript();
    }
  };

  const handleConfirmGenerate = () => {
    try {
      sessionStorage.removeItem(FORM_STATE_KEY);
    } catch (_) {}
    setModelTourGenerating(true);
  };

  return (
    <div className="h-full max-w-4xl mx-auto px-4 py-12 flex flex-col animate-fade-in">
      <div className="shrink-0 flex items-center justify-between gap-2">
        <Breadcrumbs template={template} />
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowGenerations(true)}>
          <History className="w-3.5 h-3.5" />
          My Generations
        </Button>
      </div>
      <ModelTourGenerations open={showGenerations} onOpenChange={setShowGenerations} />

      {step < 3 && !modelTourGenerating && (
        <div className="shrink-0 flex justify-center py-3">
          <StepCapsule currentStep={step} steps={template.steps || STEP_LABELS} />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        <div className="min-h-full flex flex-col justify-center px-2 sm:px-6 lg:px-7 py-4 pb-20 md:pb-4">
          {modelTourGenerating ? (
            <ModelTourGeneration
              script={modelTourScript}
              onAbort={() => setModelTourGenerating(false)}
              onBackToForm={() => setModelTourGenerating(false)}
            />
          ) : (
            <>
          {step === 0 && (
            <AddAssetsStep
              images={images}
              setImages={setImages}
              avatarHook={avatarHook}
              isValid={isValid}
              onNext={() => setStep(1)}
              onClear={handleClear}
              prebuiltLabel="RE Agents"
              propertyUploadEndpoint="/api/model-tour/upload/property"
            />
          )}

          {step === 1 && (
            <StepScript
              values={scriptValuesWithImages}
              onChange={({ propertyImages, avatarImage, ...rest }) => setScriptValues(rest)}
              onBack={() => setStep(0)}
              onNext={handleContinueFromScript}
              loading={generatingScript || generatingModelTourScript}
              continueLabel={
                scriptValues.propertyClassification === MODEL_TOUR_CLASSIFICATION
                  ? "Review & Finalize"
                  : "Generate Storyboard"
              }
            />
          )}

          {step === 2 && scriptValues.propertyClassification === MODEL_TOUR_CLASSIFICATION && (
            <ModelTourFinalize
              images={images}
              selectedAvatars={avatarHook.selectedAvatars}
              script={modelTourScript}
              onChange={setModelTourScript}
              onBack={() => setStep(1)}
              onGenerate={handleConfirmGenerate}
            />
          )}

          {step === 2 && scriptValues.propertyClassification !== MODEL_TOUR_CLASSIFICATION && (
            <StepFinalize
              template={template}
              storyboard={storyboard}
              images={images}
              selectedAvatars={avatarHook.selectedAvatars}
              scriptValues={scriptValues}
              onBack={() => setStep(1)}
              onContinue={(frames) => {
                setRenderedFrames(frames);
                setStep(3);
              }}
            />
          )}

          {/* Unreachable while Commercial/Plotted are disabled in SiteForm — kept
              for when that pipeline is reworked and re-enabled. */}
          {step === 3 && (
            <StepGeneration
              template={template}
              renderedFrames={renderedFrames}
              onAbort={() => setStep(2)}
            />
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
