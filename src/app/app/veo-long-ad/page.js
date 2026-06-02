"use client";

import { useState, useEffect, Suspense } from "react";
import { Loader2, Clapperboard, ChevronRight } from "lucide-react";
import { useAvatars } from "@/modules/ai-walkthrough/hooks/useAvatars";
import { StepUpload } from "@/modules/veo-long-ad/components/StepUpload";
import { StepScript } from "@/modules/veo-long-ad/components/StepScript";
import { GenerationProgress } from "@/modules/veo-long-ad/components/GenerationProgress";

const STEPS = ["Upload & Presenter", "Script", "Generate"];

function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, idx) => (
        <div key={idx} className="flex items-center">
          {idx > 0 && (
            <div className={`h-0.5 w-8 sm:w-12 transition-colors duration-300 ${
              idx <= currentStep ? "bg-primary" : "bg-border/40"
            }`} />
          )}
          <div className="flex flex-col items-center gap-1">
            <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all duration-300 ${
              idx < currentStep
                ? "bg-primary border-primary text-white"
                : idx === currentStep
                ? "border-primary text-primary bg-primary/10"
                : "border-border/50 text-muted-foreground"
            }`}>
              {idx < currentStep ? "✓" : idx + 1}
            </div>
            <span className={`text-[10px] font-medium whitespace-nowrap transition-colors ${
              idx === currentStep ? "text-primary" : "text-muted-foreground"
            }`}>
              {label}
            </span>
          </div>
        </div>
      ))}
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
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6 animate-fade-in">
      {/* Header card */}
      <div className="rounded-3xl border border-border/60 bg-card/85 backdrop-blur-md p-5 sm:p-6 shadow-lg shadow-black/5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl gradient-bg flex items-center justify-center shadow-md shrink-0">
            <Clapperboard className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold font-heading">Long-Form Veo Ad</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-300/30">
                🔒 Beta
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Script → 8s base clip → progressive Veo 3.1 extension → full long-form property ad
            </p>
          </div>
        </div>

        {step < 2 && (
          <div className="mt-5 flex justify-center">
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

      {/* How it works — only show before generation */}
      {step < 2 && (
        <div className="rounded-3xl border border-border/50 bg-muted/10 p-5 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">How it works</p>
          <div className="grid sm:grid-cols-4 gap-3">
            {[
              { n: 1, label: "Upload property exterior photos + choose presenter" },
              { n: 2, label: "Paste your script or let AI generate one" },
              { n: 3, label: "AI chunks script into 8-second Veo director prompts" },
              { n: 4, label: "Veo 3.1 generates & extends clips into a long-form ad" },
            ].map(({ n, label }) => (
              <div key={n} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-primary">{n}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
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
