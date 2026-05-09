import { useState } from 'react';
import { toast } from 'sonner';
import { compressImage } from '../../helpers/fileHelpers';
import { AMENITIES, MAX_SCRIPT } from '@/utils/constants';

export const useScript = (selectedCompositeArray, propertyBrief) => {
  const [script, setScript] = useState("");
  const [batchScripts, setBatchScripts] = useState([]);
  const [structuredScripts, setStructuredScripts] = useState([]);
  const [sharedVoicePrompt, setSharedVoicePrompt] = useState("");
  const [language, setLanguage] = useState("english");
  const [scriptTone, setScriptTone] = useState("professional");
  const [allowEmotionTags, setAllowEmotionTags] = useState(true);
  const [generatingScript, setGeneratingScript] = useState(false);
  
  // We always want exactly 2 scripts (short & long) regardless of composite count
  const TARGET_SCRIPT_COUNT = 2;
  const isBatchMode = true; // Force batch mode to always generate multiple scripts

  const isStep2Valid = () => {
    // Check if we have exactly 2 scripts with content
    return structuredScripts.length === TARGET_SCRIPT_COUNT && 
           structuredScripts.every((s) => (s.fullScript || "").trim().length >= 15);
  };

  const handleGenerateScript = async () => {
    if (selectedCompositeArray.length === 0) {
      toast.error("Please select at least one composite");
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
      
      // Prepare all composite images as references
      const fd = new FormData();
      fd.append("propertyBrief", JSON.stringify(enrichedBrief));
      fd.append("language", language);
      fd.append("tone", scriptTone);
      fd.append("allowEmotionTags", String(allowEmotionTags));
      
      // Add ALL selected composites as reference images
      fd.append("compositeCount", String(selectedCompositeArray.length));
      for (let i = 0; i < selectedCompositeArray.length; i++) {
        fd.append(`compositeImage_${i}`, selectedCompositeArray[i].file);
        // Also add angle information for each composite
        if (selectedCompositeArray[i].avatarAngle) {
          fd.append(`compositeAngle_${i}`, selectedCompositeArray[i].avatarAngle);
        }
      }
      
      // Add metadata about the angles available
      const availableAngles = selectedCompositeArray
        .map(c => c.avatarAngle)
        .filter(Boolean)
        .join(", ");
      fd.append("availableAngles", availableAngles);
      
      // Add user intent if provided
      if (script.trim()) {
        fd.append("userIntent", script.trim());
      }
      
      // Force generation of exactly 2 scripts (short & long)
      fd.append("scriptTypes", JSON.stringify(["short_form", "long_form"]));
      fd.append("targetScriptCount", String(TARGET_SCRIPT_COUNT));
      
      const res = await fetch("/api/real-estate-video/generate-script", { 
        method: "POST", 
        body: fd 
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Script generation failed");
      
      // Process the response - expect exactly 2 scripts
      let generatedScripts = [];
      
      if (data.scripts && Array.isArray(data.scripts)) {
        generatedScripts = data.scripts;
      } else if (data.shortScript && data.longScript) {
        // Handle separate short/long responses
        generatedScripts = [
          {
            id: 0,
            type: "short_form",
            title: "Short Video (15-30s)",
            duration: "short",
            fullScript: data.shortScript,
            references: selectedCompositeArray.length
          },
          {
            id: 1,
            type: "long_form", 
            title: "Full Video (45-60s)",
            duration: "long",
            fullScript: data.longScript,
            references: selectedCompositeArray.length
          }
        ];
      } else if (data.script) {
        // Single script response - duplicate for both types?
        generatedScripts = [
          {
            id: 0,
            type: "short_form",
            title: "Short Video (15-30s)",
            duration: "short",
            fullScript: data.script.fullScript || data.script,
            references: selectedCompositeArray.length
          },
          {
            id: 1,
            type: "long_form",
            title: "Full Video (45-60s)", 
            duration: "long",
            fullScript: data.script.fullScript || data.script,
            references: selectedCompositeArray.length
          }
        ];
      }
      
      // Ensure we have exactly 2 scripts
      if (generatedScripts.length !== TARGET_SCRIPT_COUNT) {
        console.warn(`Expected ${TARGET_SCRIPT_COUNT} scripts, got ${generatedScripts.length}`);
        // Pad with defaults if needed
        while (generatedScripts.length < TARGET_SCRIPT_COUNT) {
          generatedScripts.push({
            id: generatedScripts.length,
            type: generatedScripts.length === 0 ? "short_form" : "long_form",
            title: generatedScripts.length === 0 ? "Short Video" : "Full Video",
            fullScript: "Discover this amazing property with stunning features and modern amenities.",
            references: selectedCompositeArray.length
          });
        }
      }
      
      setStructuredScripts(generatedScripts);
      setBatchScripts(generatedScripts.map(s => s.fullScript));
      
      toast.success(`Generated ${generatedScripts.length} scripts (Short + Long)!`);
      
    } catch (err) {
      console.error("Script generation error:", err);
      toast.error("Script generation failed", { description: err.message });
    } finally {
      setGeneratingScript(false);
    }
  };

  const regenerateSingleScript = async (scriptIndex, type) => {
    // Regenerate just one script (short or long) while keeping the other
    if (!selectedCompositeArray.length) return;
    
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
      fd.append("scriptType", type);
      
      for (let i = 0; i < selectedCompositeArray.length; i++) {
        fd.append(`compositeImage_${i}`, selectedCompositeArray[i].file);
      }
      
      if (script.trim()) {
        fd.append("userIntent", script.trim());
      }
      
      const res = await fetch("/api/real-estate-video/generate-script", { 
        method: "POST", 
        body: fd 
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Script generation failed");
      
      const newScript = {
        id: scriptIndex,
        type: type,
        title: type === "short_form" ? "Short Video (15-30s)" : "Full Video (45-60s)",
        duration: type === "short_form" ? "short" : "long",
        fullScript: data.script?.fullScript || data.script || data,
        references: selectedCompositeArray.length
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
      
      toast.success(`${type === "short_form" ? "Short" : "Long"} script regenerated!`);
      
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
    sharedVoicePrompt,
    setSharedVoicePrompt,
    language,
    setLanguage,
    scriptTone,
    setScriptTone,
    allowEmotionTags,
    setAllowEmotionTags,
    generatingScript,
    isBatchMode: true, // Always true since we always generate 2 scripts
    isStep2Valid,
    handleGenerateScript,
    regenerateSingleScript, // New: regenerate individual script
    retryScriptGeneration,
  };
};