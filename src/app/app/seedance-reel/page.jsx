"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useAvatars } from "@/modules/ai-walkthrough/hooks/useAvatars";
import { dataUrlToFile } from "@/modules/ai-walkthrough/helpers/fileHelpers";
import { compressImage } from "@/utils/compress-image";
import { StepUpload } from "@/modules/seedance-reel/components/StepUpload";
import { StepScript, SCRIPT_DRAFT_KEY } from "@/modules/seedance-reel/components/StepScript";
import { StepFinalize } from "@/modules/seedance-reel/components/StepFinalize";
import { GenerationProgress } from "@/modules/seedance-reel/components/GenerationProgress";
import { StepIndicator } from "@/modules/pipeline/components/StepIndicator";
import { loadDraft, saveDraft, clearDraft, fileToDataUrl } from "@/modules/seedance-reel/utils/draft";

const RESUME_KEY = "seedance_resume";
const STEP_LABELS = ["Add Assets", "Script", "Finalize"];

function SeedanceReelContent() {
  const [step, setStep] = useState(0);
  // Furthest step the user has actually filled in — lets the capsule jump
  // forward to it again (not just back) without redoing already-done steps.
  const [maxStep, setMaxStep] = useState(0);
  const [locationImages, setLocationImages] = useState([]);
  const [scriptParams, setScriptParams] = useState(null);
  const [quality, setQuality] = useState("auto");
  const [finalizeScript, setFinalizeScript] = useState("");
  const [generationParams, setGenerationParams] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  const avatarHook = useAvatars();
  const skipImageSave = useRef(false);

  // Restore on refresh. An in-flight generation job always wins — it's
  // resumed directly by GenerationProgress. Otherwise fall back to the
  // lighter draft (photos, presenter, script, finalize choices) that's
  // continuously saved as the user moves through Upload → Script → Finalize.
  useEffect(() => {
    try {
      const resumeRaw = sessionStorage.getItem(RESUME_KEY);
      if (resumeRaw) {
        const saved = JSON.parse(resumeRaw);
        if (saved?.generationParams) {
          setGenerationParams(saved.generationParams);
          setStep(3);
          setMaxStep(3);
          setHydrated(true);
          return;
        }
      }
    } catch (_) {}

    const draft = loadDraft();
    if (draft) {
      if (draft.scriptParams) setScriptParams(draft.scriptParams);
      if (draft.quality) setQuality(draft.quality);
      if (typeof draft.finalizeScript === "string") setFinalizeScript(draft.finalizeScript);
      if (typeof draft.step === "number" && draft.step < 3) {
        setStep(draft.step);
        setMaxStep(Math.max(draft.maxStep || 0, draft.step));
      }

      if (draft.avatarMode) avatarHook.setAvatarMode(draft.avatarMode);
      if (draft.selectedCollectionId) avatarHook.setSelectedCollectionId(draft.selectedCollectionId);
      if (draft.selectedAvatars?.length) avatarHook.setSelectedAvatars(draft.selectedAvatars);

      if (draft.locationImages?.length) {
        skipImageSave.current = true;
        setLocationImages(
          draft.locationImages.map((d, i) => {
            const file = dataUrlToFile(d.dataUrl, d.name || `photo-${i}.jpg`);
            return { file, url: URL.createObjectURL(file), name: d.name };
          })
        );
      }
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the small fields as they change.
  useEffect(() => {
    if (!hydrated) return;
    saveDraft({ step, maxStep, scriptParams, quality, finalizeScript });
  }, [hydrated, step, maxStep, scriptParams, quality, finalizeScript]);

  useEffect(() => {
    if (!hydrated) return;
    saveDraft({
      avatarMode: avatarHook.avatarMode,
      selectedCollectionId: avatarHook.selectedCollectionId,
      selectedAvatars: avatarHook.selectedAvatars,
    });
  }, [hydrated, avatarHook.avatarMode, avatarHook.selectedCollectionId, avatarHook.selectedAvatars]);

  // Photos need compressing to data URLs before they can live in sessionStorage —
  // skip the round-trip right after we've just restored them from a draft.
  useEffect(() => {
    if (!hydrated) return;
    if (skipImageSave.current) { skipImageSave.current = false; return; }
    let cancelled = false;
    (async () => {
      const out = [];
      for (const img of locationImages) {
        if (!img.file) continue;
        try {
          const compressed = await compressImage(img.file, 900, 0.6);
          const dataUrl = await fileToDataUrl(compressed);
          out.push({ dataUrl, name: img.name });
        } catch (_) {}
      }
      if (!cancelled) saveDraft({ locationImages: out });
    })();
    return () => { cancelled = true; };
  }, [hydrated, locationImages]);

  const step0Valid = locationImages.length >= 1 && avatarHook.selectedAvatars.length >= 1;

  // Forward progress also raises maxStep, so the capsule lets the user
  // jump back to this step later without losing the ability to return.
  const goToStep = (next) => {
    setStep(next);
    setMaxStep((prev) => Math.max(prev, next));
  };

  // StepScript hands off the finished script/voice — move to the Finalize
  // review screen instead of generating immediately.
  const handleScriptDone = (params) => {
    setScriptParams(params);
    setFinalizeScript(params.script);
    goToStep(2);
  };

  // Finalize's own "Generate" button is what actually kicks off the pipeline.
  const handleGenerate = () => {
    const { voiceId, language, voiceSettings } = scriptParams || {};
    const script = finalizeScript?.trim() || scriptParams?.script;
    const avatarUrls = avatarHook.selectedAvatars
      .slice(0, 3)
      .map((av) => av.url)
      .filter(Boolean);

    setGenerationParams({
      script,
      voiceId,
      language,
      voiceSettings,
      quality,
      locationImages,
      avatarUrls,
    });
    goToStep(3);

    try {
      sessionStorage.setItem(
        RESUME_KEY,
        JSON.stringify({ generationParams: { script, voiceId, language, voiceSettings, quality, avatarUrls } })
      );
    } catch (_) {}
    clearDraft();
    try { sessionStorage.removeItem(SCRIPT_DRAFT_KEY); } catch (_) {}
  };

  const handleReset = () => {
    setStep(0);
    setMaxStep(0);
    setLocationImages([]);
    avatarHook.setSelectedAvatars([]);
    setScriptParams(null);
    setFinalizeScript("");
    setQuality("auto");
    setGenerationParams(null);
    try { sessionStorage.removeItem(RESUME_KEY); } catch (_) {}
    clearDraft();
    try { sessionStorage.removeItem(SCRIPT_DRAFT_KEY); } catch (_) {}
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
      {step < 3 && (
        <div className="shrink-0 flex justify-center py-3">
          <StepIndicator currentStep={step} maxStep={maxStep} steps={STEP_LABELS} onStepClick={setStep} />
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
              onNext={() => goToStep(1)}
              isValid={step0Valid}
            />
          </div>

          <div style={{ display: step === 1 ? "block" : "none" }}>
            <StepScript
              onBack={() => setStep(0)}
              onGenerate={handleScriptDone}
            />
          </div>

          {step === 2 && scriptParams && (
            <StepFinalize
              locationImages={locationImages}
              selectedAvatars={avatarHook.selectedAvatars}
              scriptParams={scriptParams}
              script={finalizeScript}
              onScriptChange={setFinalizeScript}
              quality={quality}
              onQualityChange={setQuality}
              onBack={() => setStep(1)}
              onGenerate={handleGenerate}
            />
          )}

          {step === 3 && generationParams && (
            <GenerationProgress
              generationParams={generationParams}
              onReset={handleReset}
              source="seedance-reel"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function SeedanceReelPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <SeedanceReelContent />
    </Suspense>
  );
}
