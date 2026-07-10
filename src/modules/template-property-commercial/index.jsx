"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useAvatars } from "@/modules/ai-walkthrough/hooks/useAvatars";
import { StepCapsule } from "@/modules/template/components/StepCapsule";
import { Breadcrumbs } from "@/modules/template/components/Breadcrumbs";
import { AddAssetsStep } from "@/modules/template/layout/AddAssetsStep";
import { StepScript } from "@/modules/template/layout/StepScript";
import { StepFinalize } from "@/modules/template/layout/StepFinalize";
import { StepGeneration } from "@/modules/template/layout/StepGeneration";

const STEP_LABELS = ["Add Assets", "Script", "Finalize"];

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
  const avatarHook = useAvatars();

  // Only count photos once their R2 upload has actually finished — those
  // public URLs are what the script generator reads to ground its
  // image_prompts in the real property, so Continue shouldn't be reachable
  // while any are still uploading (or failed).
  const uploadedImages = images.filter((img) => img.r2Url);
  const isValid = images.length >= 1 && uploadedImages.length === images.length && avatarHook.selectedAvatars.length >= 1;

  // Derived at render time, not synced into state via an effect — always
  // reflects whatever's finished uploading so far, no cascading setState.
  const scriptValuesWithImages = {
    ...scriptValues,
    propertyImages: uploadedImages.map((img) => img.r2Url),
  };

  const handleClear = () => {
    setImages([]);
    avatarHook.clearSelectedAvatars();
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

  return (
    <div className="h-full max-w-4xl mx-auto px-4 py-12 flex flex-col animate-fade-in">
      <div className="shrink-0">
        <Breadcrumbs template={template} />
      </div>

      {step < 3 && (
        <div className="shrink-0 flex justify-center py-3">
          <StepCapsule currentStep={step} steps={template.steps || STEP_LABELS} />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        <div className="min-h-full flex flex-col justify-center px-2 sm:px-6 lg:px-7 py-4 pb-20 md:pb-4">
          {step === 0 && (
            <AddAssetsStep
              images={images}
              setImages={setImages}
              avatarHook={avatarHook}
              isValid={isValid}
              onNext={() => setStep(1)}
              onClear={handleClear}
              prebuiltLabel="RE Agents"
            />
          )}

          {step === 1 && (
            <StepScript
              values={scriptValuesWithImages}
              onChange={({ propertyImages, ...rest }) => setScriptValues(rest)}
              onBack={() => setStep(0)}
              onNext={handleGenerateScript}
              loading={generatingScript}
              continueLabel="Generate Storyboard"
            />
          )}

          {step === 2 && (
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

          {step === 3 && (
            <StepGeneration
              template={template}
              renderedFrames={renderedFrames}
              onAbort={() => setStep(2)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
