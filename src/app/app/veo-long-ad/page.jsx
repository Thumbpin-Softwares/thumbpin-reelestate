"use client";

import { useState, useEffect, Suspense } from "react";
import { Loader2, Clapperboard, ChevronRight } from "lucide-react";
import { useAvatars } from "@/modules/ai-walkthrough/hooks/useAvatars";
import { StepUpload } from "@/modules/veo-long-ad/components/StepUpload";
import { StepScript } from "@/modules/veo-long-ad/components/StepScript";
import { GenerationProgress } from "@/modules/veo-long-ad/components/GenerationProgress";

const STEPS = ["Upload & Presenter", "Script", "Generate"];

function StepIndicator({ currentStep = 1 }) {
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

            <span className="hidden sm:block text-xs font-medium">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function VeoLongAdContent() {
  const [step, setStep] = useState(0);
  const [locationImages, setLocationImages] = useState([]);
  const [generationParams, setGenerationParams] = useState(null);

  const avatarHook = useAvatars();

  // Derived: step 0 is valid when we have images + an avatar
  const step0Valid = locationImages.length >= 1 && avatarHook.selectedAvatars.length >= 1;

  const handleGenerate = ({ chunks, masterVoicePrompt, presenterDescription, language, videoModel }) => {
    const avatarImagesForGen = avatarHook.selectedAvatars.map((av) => ({
      file: av.file || null,
      url: av.url,
      name: av.name,
    }));
    setGenerationParams({ chunks, masterVoicePrompt, presenterDescription, language, videoModel, locationImages, avatarImages: avatarImagesForGen });
    setStep(2);
  };

  const handleReset = () => {
    setStep(0);
    setLocationImages([]);
    avatarHook.setSelectedAvatars([]);
    setGenerationParams(null);
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-2 animate-fade-in">
      {/* Header card */}
      <div className="rounded-3xl p-5 sm:p-6">
        {step < 2 && (
          <div className="flex justify-center">
            <StepIndicator currentStep={step} />
          </div>
        )}
      </div>

      {/* Main content card */}
      <div className="rounded-3xl border border-border/60 bg-card/85 backdrop-blur-md p-5 sm:p-6 lg:p-7 shadow-lg shadow-black/5">
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
            locationImages={locationImages}
            avatarImages={avatarHook.selectedAvatars}
            onBack={() => setStep(0)}
            onGenerate={handleGenerate}
          />
        )}

        {step === 2 && generationParams && (
          <GenerationProgress
            generationParams={generationParams}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}

export default function VeoLongAdPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <VeoLongAdContent />
    </Suspense>
  );
}
