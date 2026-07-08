"use client";

import { useState, useEffect, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { StepUpload } from "@/modules/news-anchor/components/StepUpload";
import { StepBroll } from "@/modules/news-anchor/components/StepBroll";
import { StepIndicator } from "@/modules/pipeline/components/StepIndicator";
import { loadDraft, saveDraft, clearDraft } from "@/modules/news-anchor/utils/draft";

const STEP_LABELS = ["Add Media", "Generate B-Roll"];

function NewsAnchorContent() {
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [mediaItems, setMediaItems] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  // Only the step position is persisted across a refresh — the media files
  // themselves are local blobs (often large video files) that don't belong
  // in sessionStorage, so a refresh mid-upload starts the media list over.
  useEffect(() => {
    const draft = loadDraft();
    if (draft && typeof draft.step === "number" && draft.step === 0) {
      setStep(0);
      setMaxStep(0);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveDraft({ step, maxStep });
  }, [hydrated, step, maxStep]);

  const step0Valid = mediaItems.length >= 1;

  const goToStep = (next) => {
    setStep(next);
    setMaxStep((prev) => Math.max(prev, next));
  };

  const handleReset = () => {
    setStep(0);
    setMaxStep(0);
    setMediaItems([]);
    clearDraft();
  };

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full max-w-4xl mx-auto px-4 flex flex-col animate-fade-in">
      <div className="shrink-0 flex justify-center py-3">
        <StepIndicator currentStep={step} maxStep={maxStep} steps={STEP_LABELS} onStepClick={setStep} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        <div className="min-h-full flex flex-col justify-center px-2 sm:px-6 lg:px-7 py-4 pb-20 md:pb-4">
          {/* Step 0 stays mounted (hidden, not unmounted) so the media list
             survives going back from Step 1. */}
          <div style={{ display: step === 0 ? "block" : "none" }}>
            <StepUpload
              mediaItems={mediaItems}
              setMediaItems={setMediaItems}
              onNext={() => goToStep(1)}
              isValid={step0Valid}
              onClear={handleReset}
            />
          </div>

          {step === 1 && (
            <StepBroll
              mediaItems={mediaItems}
              onBack={() => setStep(0)}
              onReset={handleReset}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function NewsAnchorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <NewsAnchorContent />
    </Suspense>
  );
}
