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
        
        if (compositesHook.composites.length > 0) {
          safeLocalStorage.setItem(`${sessionId}_composites`, JSON.stringify(compositesHook.composites));
        }
        
        if (compositesHook.selectedCompositeIndices.size > 0) {
          safeLocalStorage.setItem(`${sessionId}_selected`, JSON.stringify([...compositesHook.selectedCompositeIndices]));
        }
        
        if (scriptHook.structuredScripts.length > 0) {
          safeLocalStorage.setItem(`${sessionId}_scripts`, JSON.stringify(scriptHook.structuredScripts));
        }
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
      avatarMode: avatarHook.avatarMode,
    }));
  }, [
    step,
    scriptHook.language,
    scriptHook.scriptTone,
    scriptHook.allowEmotionTags,
    propertyBriefHook.propertyBrief,
    scriptHook.script,
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
    avatarHook.setSelectedAvatars([]); // FIX: Use setSelectedAvatars
    avatarHook.setUploadedAvatarFile(null);
    compositesHook.setComposites([]);
    compositesHook.setSelectedCompositeIndices(new Set());
    scriptHook.setScript("");
    scriptHook.setStructuredScripts([]);
    scriptHook.setSharedVoicePrompt("");
    videoHook.setVideoStatuses([]);
    videoHook.setVideoResults([]);
    setStep(0);
    safeLocalStorage.removeItem(STORAGE_KEY);
  };

  if (!isClient) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center shadow-md">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Real Estate Video</h1>
          <p className="text-sm text-muted-foreground">
            3 steps to a cinematic property showcase — powered by Gemini & Veo 3.1
          </p>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex gap-2.5 mb-6">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">1.</strong> Upload properties + pick avatar(s) →{" "}
          <strong className="text-foreground">2.</strong> Choose your best composite →{" "}
          <strong className="text-foreground">3.</strong> Add script & generate!
        </p>
      </div>

      {/* Step Indicator */}
      {!showResults && (
        <StepIndicator steps={STEPS} currentStep={step} onStepClick={setStep} />
      )}

      {/* Step 0 */}
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

      {/* Step 1 */}
      {!showResults && step === 1 && (
        <Step1Composites
          compositesHook={compositesHook}
          onNext={() => setStep(2)}
          onBack={() => setStep(0)}
          isValid={step1Valid}
        />
      )}

      {/* Step 2 */}
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

      {/* Results */}
      {showResults && (
        <VideoResults
          videoHook={videoHook}
          compositesHook={compositesHook}
          onReset={handleReset}
        />
      )}

      {/* Property Drawer */}
      <PropertyDrawer
        isOpen={propertyBriefHook.propertyDrawerOpen}
        onClose={() => propertyBriefHook.setPropertyDrawerOpen(false)}
        propertyBrief={propertyBriefHook.propertyBrief}
        updatePropertyBrief={propertyBriefHook.updatePropertyBrief}
        toggleFeature={propertyBriefHook.toggleFeature}
        toggleAmenity={propertyBriefHook.toggleAmenity}
      />

      {/* Session Status */}
      {step > 0 && <SessionStatus />}
    </div>
  );
}

export default function AIWalkthroughPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <RealEstateVideoContent />
    </Suspense>
  );
}