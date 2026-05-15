"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Info, Building2 } from "lucide-react";

// Hooks
import { usePropertyBrief } from "@/modules/ai-walkthrough/hooks/usePropertyBrief";
import { useAvatars } from "@/modules/ai-walkthrough/hooks/useAvatars";
import { useComposites } from "@/modules/ai-walkthrough/hooks/useComposites";
import { useScript } from "@/modules/ai-walkthrough/hooks/useScript";
import { useSession } from "@/modules/ai-walkthrough/hooks/useSession";
import { useVideoGeneration } from "@/modules/ai-walkthrough/hooks/useVideoGeneration";

// Components
import { StepIndicator } from "@/modules/ai-walkthrough/components/StepIndicator";
import { SessionStatus } from "@/modules/ai-walkthrough/components/SessionStatus";
import { PropertyDrawer } from "@/modules/ai-walkthrough/components/PropertyDrawer";
import { Step0Upload } from "@/modules/ai-walkthrough/components/Step0Upload";
import { Step1Composites } from "@/modules/ai-walkthrough/components/Step1Composites";
import { Step2Script } from "@/modules/ai-walkthrough/components/Step2Script";
import { VideoResults } from "@/modules/ai-walkthrough/components/VideoResults";

// Utils & Constants
import { STEPS, STORAGE_KEY, AMENITIES } from "@/utils/constants";
import { safeLocalStorage } from "@/modules/ai-walkthrough/helpers/fileHelpers";
import {
  saveSessionProgress,
  loadSessionProgress,
  saveImagesToDB,
} from "../../../utils/indexedDB";

function RealEstateVideoContent() {
  const searchParams = useSearchParams();
  const initialScript = searchParams.get("script");
  const [sessionId, setSessionId] = useState(null);
  const [isClient, setIsClient] = useState(false);
  const [propertyImages, setPropertyImages] = useState([]);

  // ========== INITIALIZE ALL HOOKS ==========
  const { step, setStep } = useSession(sessionId, isClient);
  const propertyBriefHook = usePropertyBrief();
  const avatarHook = useAvatars();
  
  // FIX: Pass selectedAvatars (array) instead of selectedAvatar (single)
  const compositesHook = useComposites(propertyImages, avatarHook.selectedAvatars);
  
  const scriptHook = useScript(
    compositesHook.selectedCompositeArray, 
    propertyBriefHook.propertyBrief
  );
  const videoHook = useVideoGeneration(
    compositesHook.selectedCompositeArray, 
    scriptHook,
    sessionId
  );

  // ========== SESSION MANAGEMENT ==========
  useEffect(() => {
    setIsClient(true);
    const saved = safeLocalStorage.getItem("currentSessionId");
    setSessionId(saved || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  }, []);

  // Load session
  useEffect(() => {
    if (!sessionId || !isClient) return;

    const loadSession = async () => {
      try {
        const savedData = await loadSessionProgress(sessionId);
        
        if (savedData?.propertyBrief) {
          const isRecent = Date.now() - savedData.propertyBrief.lastUpdated < 24 * 60 * 60 * 1000;
          
          if (isRecent) {
            if (savedData.propertyBrief) propertyBriefHook.setPropertyBrief(savedData.propertyBrief);
            if (savedData.avatarData) {
              avatarHook.setAvatarMode(savedData.avatarData.avatarMode);
              // FIX: Use setSelectedAvatars instead of setSelectedAvatar
              if (savedData.avatarData.selectedAvatars) {
                avatarHook.setSelectedAvatars(savedData.avatarData.selectedAvatars);
              } else if (savedData.avatarData.selectedAvatar) {
                // Handle legacy single avatar data
                avatarHook.setSelectedAvatars([savedData.avatarData.selectedAvatar]);
              }
              avatarHook.setAvatarPrompt(savedData.avatarData.avatarPrompt || "");
              avatarHook.setAvatarVariantCount(savedData.avatarData.avatarVariantCount || 3);
            }
            if (savedData.images?.length > 0) setPropertyImages(savedData.images);
            if (savedData.composites) compositesHook.setComposites(savedData.composites);
            if (savedData.selectedIndices) {
              compositesHook.setSelectedCompositeIndices(new Set(savedData.selectedIndices));
            }
            if (savedData.scripts) {
              scriptHook.setStructuredScripts(savedData.scripts);
              scriptHook.setBatchScripts(savedData.scripts.map(s => s.fullScript || ""));
            }
            if (savedData.scriptData) {
              if (Array.isArray(savedData.scriptData.manualScripts)) {
                scriptHook.setManualScripts(savedData.scriptData.manualScripts);
              }
              if (Array.isArray(savedData.scriptData.useManualForIndex)) {
                scriptHook.setUseManualForIndex(savedData.scriptData.useManualForIndex);
              }
              if (savedData.scriptData.closingHook) {
                scriptHook.setClosingHook(savedData.scriptData.closingHook);
              }
              if (typeof savedData.scriptData.customClosingHook === "string") {
                scriptHook.setCustomClosingHook(savedData.scriptData.customClosingHook);
              }
            }
            if (savedData.step) setStep(parseInt(savedData.step));
            
            toast.success("Session restored!");
          }
        }

        // Load from localStorage backup
        const raw = safeLocalStorage.getItem(STORAGE_KEY);
        if (raw) {
          const s = JSON.parse(raw);
          if (s.step !== undefined) setStep(s.step);
          if (s.language) scriptHook.setLanguage(s.language);
          if (s.scriptTone) scriptHook.setScriptTone(s.scriptTone);
          if (typeof s.allowEmotionTags === "boolean") scriptHook.setAllowEmotionTags(s.allowEmotionTags);
          if (s.propertyBrief) propertyBriefHook.setPropertyBrief(s.propertyBrief);
          if (s.script) scriptHook.setScript(s.script);
          if (Array.isArray(s.manualScripts)) scriptHook.setManualScripts(s.manualScripts);
          if (Array.isArray(s.useManualForIndex)) scriptHook.setUseManualForIndex(s.useManualForIndex);
          if (s.closingHook) scriptHook.setClosingHook(s.closingHook);
          if (typeof s.customClosingHook === "string") scriptHook.setCustomClosingHook(s.customClosingHook);
          if (s.avatarMode) avatarHook.setAvatarMode(s.avatarMode);
        }
      } catch (error) {
        console.error("Failed to load session:", error);
      }
    };

    loadSession();
  }, [sessionId, isClient]);

  // Save session
  useEffect(() => {
    if (!sessionId || !isClient) return;

    const saveSession = async () => {
      try {
        await saveSessionProgress({
          sessionId,
          step,
          propertyBrief: propertyBriefHook.propertyBrief,
          avatarData: {
            avatarMode: avatarHook.avatarMode,
            selectedAvatars: avatarHook.selectedAvatars, // FIX: Use selectedAvatars
            avatarPrompt: avatarHook.avatarPrompt,
            avatarVariantCount: avatarHook.avatarVariantCount,
          },
          images: propertyImages,
          composites: compositesHook.composites,
          selectedIndices: [...compositesHook.selectedCompositeIndices],
          scripts: scriptHook.structuredScripts,
          scriptData: {
            manualScripts: scriptHook.manualScripts,
            useManualForIndex: scriptHook.useManualForIndex,
            batchScripts: scriptHook.batchScripts,
            closingHook: scriptHook.closingHook,
            customClosingHook: scriptHook.customClosingHook,
          },
          metadata: {
            lastEdited: Date.now(),
            propertyImagesCount: propertyImages.length,
            compositesCount: compositesHook.composites.length,
            selectedCount: compositesHook.selectedCompositeIndices.size,
          },
        });

        if (propertyImages.length > 0) {
          await saveImagesToDB(sessionId, propertyImages);
        }

        safeLocalStorage.setItem("currentSessionId", sessionId);
        safeLocalStorage.setItem(`${sessionId}_step`, step.toString());
        safeLocalStorage.setItem(`${sessionId}_meta`, JSON.stringify({
          propertyImagesCount: propertyImages.length,
          compositesCount: compositesHook.composites.length,
          selectedCount: compositesHook.selectedCompositeIndices.size,
          scriptsCount: scriptHook.structuredScripts.length,
          manualScriptsCount: scriptHook.manualScripts.filter((s) => (s || "").trim().length > 0).length,
        }));
      } catch (error) {
        console.error("Save failed:", error);
      }
    };

    const timeoutId = setTimeout(saveSession, 2000);
    return () => clearTimeout(timeoutId);
  }, [
    propertyBriefHook.propertyBrief,
    propertyImages,
    compositesHook.composites,
    compositesHook.selectedCompositeIndices,
    scriptHook.structuredScripts,
    scriptHook.batchScripts,
    scriptHook.manualScripts,
    scriptHook.useManualForIndex,
    scriptHook.closingHook,
    scriptHook.customClosingHook,
    step,
    avatarHook.avatarMode,
    avatarHook.selectedAvatars, // FIX: Use selectedAvatars
    avatarHook.avatarPrompt,
    avatarHook.avatarVariantCount,
    sessionId,
    isClient,
  ]);

  // Persist basic state to localStorage
  useEffect(() => {
    if (!isClient) return;
    safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify({
      step,
      language: scriptHook.language,
      scriptTone: scriptHook.scriptTone,
      allowEmotionTags: scriptHook.allowEmotionTags,
      propertyBrief: propertyBriefHook.propertyBrief,
      script: scriptHook.script,
      manualScripts: scriptHook.manualScripts,
      useManualForIndex: scriptHook.useManualForIndex,
      closingHook: scriptHook.closingHook,
      customClosingHook: scriptHook.customClosingHook,
      avatarMode: avatarHook.avatarMode,
    }));
  }, [
    step,
    scriptHook.language,
    scriptHook.scriptTone,
    scriptHook.allowEmotionTags,
    propertyBriefHook.propertyBrief,
    scriptHook.script,
    scriptHook.manualScripts,
    scriptHook.useManualForIndex,
    scriptHook.closingHook,
    scriptHook.customClosingHook,
    avatarHook.avatarMode,
    isClient,
  ]);

  // Initialize from URL param
  useEffect(() => {
    if (initialScript) {
      scriptHook.setScript(initialScript);
      setStep(2);
    }
  }, [initialScript]);

  // Derived values
  // FIX: Check if at least one avatar is selected (selectedAvatars length > 0)
  const step0Valid = propertyImages.length >= 1 && avatarHook.selectedAvatars.length >= 1;
  const step1Valid = compositesHook.selectedCompositeIndices.size >= 1;
  const showResults = videoHook.videoStatuses.length > 0 && videoHook.videoStatuses.some(s => s !== "idle");

  const handleReset = () => {
    setPropertyImages([]);
    avatarHook.setSelectedAvatars([]);
    avatarHook.setUploadedAvatarFile(null);
    compositesHook.setComposites([]);
    compositesHook.setSelectedCompositeIndices(new Set());
    scriptHook.setScript("");
    scriptHook.setStructuredScripts([]);
    scriptHook.setBatchScripts([]);
    scriptHook.setManualScripts([]);
    scriptHook.setUseManualForIndex([]);
    scriptHook.setClosingHook("none");
    scriptHook.setCustomClosingHook("");
    scriptHook.setSharedVoicePrompt("");
    videoHook.setVideoStatuses([]);
    videoHook.setVideoResults([]);
    setStep(0);
    safeLocalStorage.removeItem(STORAGE_KEY);
  };

  if (!isClient) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center justify-center min-h-100">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 lg:px-6 animate-fade-in">
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-6 self-start">
          <div className="rounded-3xl border border-border/60 bg-card/85 backdrop-blur-md p-5 shadow-lg shadow-black/5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl gradient-bg flex items-center justify-center shadow-md shrink-0">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-heading leading-tight">Real Estate Video</h1>
                <p className="text-xs text-muted-foreground">
                  Gemini + Veo 3.1 property walkthroughs
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-3 flex gap-2.5">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Upload property images, choose avatars, generate composites, then build continuation scripts and final videos.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-3">
                <p className="text-[10px] text-muted-foreground">Property images</p>
                <p className="text-lg font-semibold">{propertyImages.length}</p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-3">
                <p className="text-[10px] text-muted-foreground">Avatars</p>
                <p className="text-lg font-semibold">{avatarHook.selectedAvatars.length}</p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-3">
                <p className="text-[10px] text-muted-foreground">Composites</p>
                <p className="text-lg font-semibold">{compositesHook.composites.length}</p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-3">
                <p className="text-[10px] text-muted-foreground">Selected</p>
                <p className="text-lg font-semibold">{compositesHook.selectedCompositeIndices.size}</p>
              </div>
            </div>

            {step > 0 && (
              <div className="mt-4 rounded-2xl border border-border/50 bg-muted/15 p-3">
                <SessionStatus />
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="space-y-5 min-w-0">
          {!showResults && (
            <div className="rounded-3xl border border-border/60 bg-card/85 backdrop-blur-md p-4 shadow-lg shadow-black/5">
              <StepIndicator steps={STEPS} currentStep={step} onStepClick={setStep} />
            </div>
          )}

          <div className="rounded-3xl border border-border/60 bg-card/85 backdrop-blur-md p-4 sm:p-5 lg:p-6 shadow-lg shadow-black/5 min-w-0">
          {!showResults && step === 0 && (
            <Step0Upload
              propertyImages={propertyImages}
              setPropertyImages={setPropertyImages}
              avatarHook={avatarHook}
              propertyBriefHook={propertyBriefHook}
              onNext={() => {
                setStep(1);
                compositesHook.handleGenerateComposites();
              }}
              isValid={step0Valid}
            />
          )}

          {!showResults && step === 1 && (
            <Step1Composites
              compositesHook={compositesHook}
              onNext={() => setStep(2)}
              onBack={() => setStep(0)}
              isValid={step1Valid}
            />
          )}

          {!showResults && step === 2 && (
            <Step2Script
              compositesHook={compositesHook}
              scriptHook={scriptHook}
              videoHook={videoHook}
              onBack={() => setStep(1)}
              onGenerate={videoHook.handleGenerateVideo}
              isValid={scriptHook.isStep2Valid(compositesHook.selectedCompositeIndices.size)}
            />
          )}

          {showResults && (
            <VideoResults
              videoHook={videoHook}
              compositesHook={compositesHook}
              onReset={handleReset}
            />
          )}
          </div>
        </main>
      </div>

      {/* Property Drawer */}
      <PropertyDrawer
        isOpen={propertyBriefHook.propertyDrawerOpen}
        onClose={() => propertyBriefHook.setPropertyDrawerOpen(false)}
        propertyBrief={propertyBriefHook.propertyBrief}
        updatePropertyBrief={propertyBriefHook.updatePropertyBrief}
        toggleFeature={propertyBriefHook.toggleFeature}
        toggleAmenity={propertyBriefHook.toggleAmenity}
      />
    </div>
  );
}

export default function AIWalkthroughPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-100">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <RealEstateVideoContent />
    </Suspense>
  );
}