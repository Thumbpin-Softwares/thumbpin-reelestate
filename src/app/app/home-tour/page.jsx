"use client";

import { useState, useEffect, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useAvatars } from "@/modules/ai-walkthrough/hooks/useAvatars";
import { StepUpload } from "@/modules/seedance-reel/components/StepUpload";
import { StepScript } from "@/modules/seedance-reel/components/StepScript";
import { GenerationProgress } from "@/modules/home-tour/components/GenerationProgress";
import { StepIndicator } from "@/modules/pipeline/components/StepIndicator";

const RESUME_KEY = "home_tour_resume";

function HomeTourContent() {
  const [step, setStep] = useState(0);
  const [locationImages, setLocationImages] = useState([]);
  const [generationParams, setGenerationParams] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  const avatarHook = useAvatars();

  // Restore step 2 (Generate) on refresh — location image Files can't survive
  // a reload, but GenerationProgress doesn't need them once a job has already
  // started; it resumes the existing job instead of re-submitting.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(RESUME_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.generationParams) {
          setGenerationParams(saved.generationParams);
          setStep(2);
        }
      }
    } catch (_) {}
    setHydrated(true);
  }, []);

  const step0Valid = locationImages.length >= 1 && avatarHook.selectedAvatars.length >= 1;

  const handleGenerate = ({ script, voiceId, language, tone, voiceSettings }) => {
    const avatarUrls = avatarHook.selectedAvatars
      .slice(0, 3)
      .map((av) => av.url)
      .filter(Boolean);

    setGenerationParams({
      script,
      voiceId,
      language,
      tone,
      voiceSettings,
      locationImages,
      avatarUrls,
    });
    setStep(2);

    try {
      sessionStorage.setItem(
        RESUME_KEY,
        JSON.stringify({ generationParams: { script, voiceId, language, tone, voiceSettings, avatarUrls } })
      );
    } catch (_) {}
  };

  const handleReset = () => {
    setStep(0);
    setLocationImages([]);
    avatarHook.setSelectedAvatars([]);
    setGenerationParams(null);
    try { sessionStorage.removeItem(RESUME_KEY); } catch (_) {}
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
      {step < 2 && (
        <div className="shrink-0 flex justify-center py-3">
          <StepIndicator currentStep={step} onStepClick={setStep} />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        <div className="min-h-full flex flex-col justify-center px-2 sm:px-6 lg:px-7 py-4 pb-20 md:pb-4">
          {/* Steps 0/1 stay mounted (hidden, not unmounted) so their internal
             state — script text, presenter selection, etc. — survives going back. */}
          <div style={{ display: step === 0 ? "block" : "none" }}>
            <StepUpload
              locationImages={locationImages}
              setLocationImages={setLocationImages}
              avatarHook={avatarHook}
              onNext={() => setStep(1)}
              isValid={step0Valid}
            />
          </div>

          <div style={{ display: step === 1 ? "block" : "none" }}>
            <StepScript
              onBack={() => setStep(0)}
              onGenerate={handleGenerate}
            />
          </div>

          {step === 2 && generationParams && (
            <GenerationProgress
              generationParams={generationParams}
              onReset={handleReset}
              apiBasePath="/api/home-tour"
              source="home-tour"
              jobIdKey="home_tour_job_id"
              resumeKey={RESUME_KEY}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function HomeTourPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <HomeTourContent />
    </Suspense>
  );
}
