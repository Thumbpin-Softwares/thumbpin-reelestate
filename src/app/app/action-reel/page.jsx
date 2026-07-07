"use client";

import { useState, useEffect, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useAvatars } from "@/modules/ai-walkthrough/hooks/useAvatars";
import { StepUpload } from "@/modules/seedance-reel/components/StepUpload";
import { StepScript } from "@/modules/action-reel/components/StepScript";
import { GenerationProgress } from "@/modules/action-reel/components/GenerationProgress";

const STEPS = ["Add Assets", "Script", "Generate"];
const RESUME_KEY = "action_reel_resume";

function StepIndicator({ currentStep = 0 }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-neutral-100 p-2">
      {STEPS.map((label, idx) => {
        const active = idx === currentStep;
        const completed = idx < currentStep;
        return (
          <div
            key={idx}
            className={`flex items-center gap-2 rounded-full px-3 py-2 transition-all duration-300 ${
              active
                ? "bg-[#c7f038] text-black"
                : completed
                ? "bg-black text-white"
                : "bg-transparent text-neutral-500"
            }`}
          >
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                active
                  ? "bg-black text-white"
                  : completed
                  ? "bg-white text-black"
                  : "bg-neutral-200"
              }`}
            >
              {completed ? "✓" : idx + 1}
            </div>
            <span className="hidden sm:block text-xs font-medium">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function ActionReelContent() {
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

  const handleGenerate = ({ script, voiceId, language, tone, customVoiceFile }) => {
    const avatarUrls = avatarHook.selectedAvatars
      .slice(0, 3)
      .map((av) => av.url)
      .filter(Boolean);

    setGenerationParams({
      script,
      voiceId,
      language,
      tone,
      locationImages,
      avatarUrls,
      customVoiceFile,
    });
    setStep(2);

    try {
      sessionStorage.setItem(
        RESUME_KEY,
        JSON.stringify({ generationParams: { script, voiceId, language, tone, avatarUrls } })
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
          <StepIndicator currentStep={step} />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        <div className="min-h-full flex flex-col justify-center px-2 sm:px-6 lg:px-7 py-4 pb-20 md:pb-4">
          {step === 0 && (
            <StepUpload
              locationImages={locationImages}
              setLocationImages={setLocationImages}
              avatarHook={avatarHook}
              onNext={() => setStep(1)}
              isValid={step0Valid}
              orderHint="location-first"
            />
          )}

          {step === 1 && (
            <StepScript
              onBack={() => setStep(0)}
              onGenerate={handleGenerate}
            />
          )}

          {step === 2 && generationParams && (
            <GenerationProgress
              generationParams={generationParams}
              onReset={handleReset}
              apiBasePath="/api/action-reel"
              source="action-reel"
              jobIdKey="action_reel_job_id"
              resumeKey={RESUME_KEY}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function ActionReelPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <ActionReelContent />
    </Suspense>
  );
}
