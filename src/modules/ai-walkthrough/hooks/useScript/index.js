import { useState } from 'react';
import { toast } from 'sonner';
import { compressImage } from '../../helpers/fileHelpers';
import { AMENITIES, MAX_SCRIPT } from '@/utils/constants';

async function buildReferenceFile(reference, filenamePrefix, index) {
  if (!reference) return null;
  if (reference.file instanceof File) return reference.file;
  if (typeof reference.url === 'string' && reference.url.startsWith('data:')) {
    const response = await fetch(reference.url);
    const blob = await response.blob();
    return new File([blob], `${filenamePrefix}-${index}.png`, { type: blob.type || 'image/png' });
  }
  if (typeof reference.url === 'string') {
    const response = await fetch(reference.url);
    const blob = await response.blob();
    return new File([blob], `${filenamePrefix}-${index}.png`, { type: blob.type || 'image/png' });
  }
  if (reference instanceof File) return reference;
  return null;
}

export const useScript = (selectedLocationArray, propertyBrief, videoHookSettings = {}, avatarReferences = []) => {
  const [script, setScript] = useState("");
  const [batchScripts, setBatchScripts] = useState([]);
  const [structuredScripts, setStructuredScripts] = useState([]);
  // Manual scripts: user-written scripts per composite (indexed by composite position)
  const [manualScripts, setManualScripts] = useState([]);
  // Whether to use manual script for each index (true = use manual, false = use AI)
  const [useManualForIndex, setUseManualForIndex] = useState([]);
  const [closingHook, setClosingHook] = useState("none");
  const [customClosingHook, setCustomClosingHook] = useState("");
  const [sharedVoicePrompt, setSharedVoicePrompt] = useState("");
  const [language, setLanguage] = useState("hindi");
  const [scriptTone, setScriptTone] = useState("professional");
  const [allowEmotionTags, setAllowEmotionTags] = useState(true);
  const [generatingScript, setGeneratingScript] = useState(false);
  
  // Dynamic: one script per selected location photo
  const isBatchMode = selectedLocationArray.length > 1;

  const isStep2Valid = (compositeCount) => {
    const count = compositeCount || selectedLocationArray.length;
    if (count === 0) return false;
    
    // Check we have enough scripts (AI or manual) for each composite
    for (let i = 0; i < count; i++) {
      const isManual = useManualForIndex[i];
      if (isManual) {
        if (!(manualScripts[i] || "").trim() || manualScripts[i].trim().length < 15) return false;
      } else {
        const aiScript = structuredScripts[i];
        if (!aiScript || (aiScript.fullScript || "").trim().length < 15) return false;
      }
    }
    return true;
  };
  
  // Get the final script for each composite (AI or manual, with manual having preference)
  const getFinalScripts = () => {
    const count = selectedLocationArray.length;
    const finals = [];
    for (let i = 0; i < count; i++) {
      const isManual = useManualForIndex[i];
      if (isManual && (manualScripts[i] || "").trim().length > 0) {
        finals.push(manualScripts[i].trim());
      } else if (structuredScripts[i]) {
        finals.push(structuredScripts[i].fullScript || "");
      } else {
        finals.push("");
      }
    }
    return finals;
  };

  const toggleManualForIndex = (idx) => {
    setUseManualForIndex(prev => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  const updateManualScript = (idx, text) => {
    setManualScripts(prev => {
      const next = [...prev];
      next[idx] = text;
      return next;
    });
  };

  const handleGenerateScript = async () => {
    if (selectedLocationArray.length === 0) {
      toast.error("Please select at least one location photo");
      return;
    }
    
    setGeneratingScript(true);
    
    try {
      const enrichedBrief = {
        ...propertyBrief,
        keyFeatures: [...(propertyBrief.selectedFeatures || []), propertyBrief.keyFeatures]
          .filter(Boolean)
          .join(", "),
        amenities: [...(propertyBrief.selectedAmenities || [])
          .map((id) => AMENITIES.find((a) => a.id === id)?.label)
          .filter(Boolean), propertyBrief.amenities]
          .filter(Boolean)
          .join(", "),
      };
      
      // Prepare all location photos and avatar references as inputs
      const fd = new FormData();
      fd.append("propertyBrief", JSON.stringify(enrichedBrief));
      fd.append("language", language);
      fd.append("tone", scriptTone);
      fd.append("allowEmotionTags", String(allowEmotionTags));
      
      fd.append("locationCount", String(selectedLocationArray.length));
      for (let i = 0; i < selectedLocationArray.length; i++) {
        const locationFile = await buildReferenceFile(selectedLocationArray[i], "location", i);
        if (locationFile) {
          fd.append(`locationImage_${i}`, locationFile);
        }
        if (selectedLocationArray[i].avatarAngle) {
          fd.append(`locationAngle_${i}`, selectedLocationArray[i].avatarAngle);
        }
      }
      
      // Add metadata about the location labels available
      const availableAngles = selectedLocationArray
        .map(c => c.avatarAngle)
        .filter(Boolean)
        .join(", ");
      if (availableAngles) fd.append("availableAngles", availableAngles);

      if (avatarReferences.length > 0) {
        fd.append("avatarCount", String(avatarReferences.length));
        for (let i = 0; i < avatarReferences.length; i++) {
          const avatarFile = await buildReferenceFile(avatarReferences[i], "avatar", i);
          if (avatarFile) {
            fd.append(`avatarImage_${i}`, avatarFile);
          }
        }
      }
      
      // Add user intent if provided (shared across all)
      if (script.trim()) {
        fd.append("userIntent", script.trim());
      }
      
      // Per-location manual intents (these get preference in script generation)
      for (let i = 0; i < selectedLocationArray.length; i++) {
        if (manualScripts[i] && manualScripts[i].trim()) {
          fd.append(`userIntent_${i}`, manualScripts[i].trim());
        }
      }
      
      // Enable continuation mode for visual flow between clips
      fd.append("continuationMode", "true");
      fd.append("closingHook", closingHook || "none");
      if (customClosingHook.trim()) {
        fd.append("customClosingHook", customClosingHook.trim());
      }
      // Pass duration so word budget scales for Seedance long-form clips
      if (videoHookSettings.seedanceDuration && videoHookSettings.videoEngine === "seedance") {
        fd.append("duration", String(videoHookSettings.seedanceDuration));
      }
      
      const res = await fetch("/api/real-estate-video/generate-script", { 
        method: "POST", 
        body: fd 
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Script generation failed");
      
      // Process the response - expect N prompts (one per location photo)
      const N = selectedLocationArray.length;
      let generatedScripts = [];
      
      if (data.prompts && Array.isArray(data.prompts)) {
        // Batch API returns [{prompt: "full KLING prompt"}, ...]
        generatedScripts = data.prompts.map((item, idx) => ({
          id: idx,
          type: `clip_${idx + 1}`,
          title: `Property ${idx + 1} of ${data.prompts.length}`,
          compositeIndex: idx,
          position: idx === 0 ? "first" : idx === data.prompts.length - 1 ? "last" : "middle",
          fullScript: (item.prompt || "").trim(),
          references: N,
        }));
      } else if (data.prompt) {
        // Single prompt response - new format with only fullScript
        generatedScripts = [{
          id: 0,
          type: "clip_1",
          title: "Property 1 of 1",
          compositeIndex: 0,
          position: "only",
          fullScript: data.prompt.trim(),
          references: 1,
        }];
      }
      
      // Ensure we have the right number of scripts
      while (generatedScripts.length < N) {
        generatedScripts.push({
          id: generatedScripts.length,
          type: `clip_${generatedScripts.length + 1}`,
          title: `Property ${generatedScripts.length + 1} of ${N}`,
          compositeIndex: generatedScripts.length,
          position: generatedScripts.length === N - 1 ? "last" : "middle",
          fullScript: "🎬 KLING AI PROMPT — 8 SEC LUXURY PROPERTY AD\n\n[Generate a detailed prompt for this property]",
          references: N,
        });
      }
      
      // Trim to exactly N
      generatedScripts = generatedScripts.slice(0, N);
      
      setStructuredScripts(generatedScripts);
      setBatchScripts(generatedScripts.map(s => s.fullScript));
      
      // Initialize manual scripts array with empty strings if not already set
      setManualScripts(prev => {
        const next = [...prev];
        while (next.length < N) next.push("");
        return next;
      });
      setUseManualForIndex(prev => {
        const next = [...prev];
        while (next.length < N) next.push(false);
        return next;
      });
      
      toast.success(`Generated ${generatedScripts.length} KLING prompt${generatedScripts.length > 1 ? 's' : ''}!`);
      
      
    } catch (err) {
      console.error("Script generation error:", err);
      toast.error("Script generation failed", { description: err.message });
    } finally {
      setGeneratingScript(false);
    }
  };

  const regenerateSingleScript = async (scriptIndex) => {
    // Regenerate just one clip's script while keeping the others
    if (!selectedLocationArray.length || !selectedLocationArray[scriptIndex]) return;
    
    setGeneratingScript(true);
    
    try {
      const enrichedBrief = {
        ...propertyBrief,
        keyFeatures: [...(propertyBrief.selectedFeatures || []), propertyBrief.keyFeatures]
          .filter(Boolean)
          .join(", "),
        amenities: [...(propertyBrief.selectedAmenities || [])
          .map((id) => AMENITIES.find((a) => a.id === id)?.label)
          .filter(Boolean), propertyBrief.amenities]
          .filter(Boolean)
          .join(", "),
      };
      
      const fd = new FormData();
      fd.append("propertyBrief", JSON.stringify(enrichedBrief));
      fd.append("language", language);
      fd.append("tone", scriptTone);
      fd.append("allowEmotionTags", String(allowEmotionTags));
      
      // Single location photo for single regeneration
      const locationFile = await buildReferenceFile(selectedLocationArray[scriptIndex], "location", scriptIndex);
      if (locationFile) {
        fd.append("locationImage", locationFile);
      }

      if (avatarReferences.length > 0) {
        fd.append("avatarCount", String(avatarReferences.length));
        for (let i = 0; i < avatarReferences.length; i++) {
          const avatarFile = await buildReferenceFile(avatarReferences[i], "avatar", i);
          if (avatarFile) {
            fd.append(`avatarImage_${i}`, avatarFile);
          }
        }
      }
      
      // Include position context for continuation
      const N = selectedLocationArray.length;
      const position = N === 1 ? "only" : scriptIndex === 0 ? "first" : scriptIndex === N - 1 ? "last" : "middle";
      fd.append("clipPosition", position);
      fd.append("clipIndex", String(scriptIndex));
      fd.append("totalClips", String(N));
      fd.append("closingHook", closingHook || "none");
      if (customClosingHook.trim()) {
        fd.append("customClosingHook", customClosingHook.trim());
      }
      
      if (script.trim()) {
        fd.append("userIntent", script.trim());
      }
      if (manualScripts[scriptIndex]?.trim()) {
        fd.append("userIntent", manualScripts[scriptIndex].trim());
      }
      
      const res = await fetch("/api/real-estate-video/generate-script", { 
        method: "POST", 
        body: fd 
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Script generation failed");
      
      const newScript = {
        id: scriptIndex,
        type: `clip_${scriptIndex + 1}`,
        title: `Clip ${scriptIndex + 1} of ${N}`,
        compositeIndex: scriptIndex,
        position,
        fullScript: data.script?.fullScript || data.script || "",
        hook: data.script?.hook || "",
        walkthrough: data.script?.walkthrough || "",
        cta: data.script?.cta || "",
        references: N,
      };
      
      setStructuredScripts(prev => {
        const updated = [...prev];
        updated[scriptIndex] = newScript;
        return updated;
      });
      
      setBatchScripts(prev => {
        const updated = [...prev];
        updated[scriptIndex] = newScript.fullScript;
        return updated;
      });
      
      toast.success(`Clip ${scriptIndex + 1} script regenerated!`);
      
    } catch (err) {
      toast.error("Script regeneration failed", { description: err.message });
    } finally {
      setGeneratingScript(false);
    }
  };

  const retryScriptGeneration = async () => {
    await handleGenerateScript();
  };

  return {
    script,
    setScript,
    batchScripts,
    setBatchScripts,
    structuredScripts,
    setStructuredScripts,
    manualScripts,
    setManualScripts,
    useManualForIndex,
    setUseManualForIndex,
    closingHook,
    setClosingHook,
    customClosingHook,
    setCustomClosingHook,
    toggleManualForIndex,
    updateManualScript,
    getFinalScripts,
    sharedVoicePrompt,
    setSharedVoicePrompt,
    language,
    setLanguage,
    scriptTone,
    setScriptTone,
    allowEmotionTags,
    setAllowEmotionTags,
    generatingScript,
    isBatchMode,
    isStep2Valid,
    handleGenerateScript,
    regenerateSingleScript,
    retryScriptGeneration,
  };
};