"use client";

import { useState, useEffect, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useAvatars } from "@/modules/ai-walkthrough/hooks/useAvatars";
import { StepUpload } from "@/modules/seedance-reel/components/StepUpload";
import { StepScript } from "@/modules/seedance-reel/components/StepScript";
import { GenerationProgress } from "@/modules/seedance-reel/components/GenerationProgress";

const STEPS = ["Upload & Presenter", "Script", "Generate"];
const RESUME_KEY = "home_tour_resume";

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

  const handleGenerate = ({ script, voiceId, language, tone }) => {
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
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-2 animate-fade-in">
      <div className="rounded-3xl p-5 sm:p-6">
        {step < 2 && (
          <div className="flex justify-center">
            <StepIndicator currentStep={step} />
          </div>
        )}
      </div>

      <div className="p-2 sm:p-6 lg:p-7">
        {step === 0 && (
          <StepUpload
            locationImages={locationImages}
            setLocationImages={setLocationImages}
            avatarHook={avatarHook}
            onNext={() => setStep(1)}
            isValid={step0Valid}
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
            apiBasePath="/api/home-tour"
            source="home-tour"
            jobIdKey="home_tour_job_id"
            resumeKey={RESUME_KEY}
          />
        )}
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
