import { useState } from 'react';
import { toast } from 'sonner';
import { ensureFileObject, compressImage, dataUrlToFile } from '../../helpers/fileHelpers';

export const useComposites = (propertyImages, selectedAvatars) => {
  const [composites, setComposites] = useState([]);
  const [generatingComposites, setGeneratingComposites] = useState(false);
  const [selectedCompositeIndices, setSelectedCompositeIndices] = useState(new Set());
  const [savingComposites, setSavingComposites] = useState(false);

  const selectedCompositeArray = [...selectedCompositeIndices].sort().map((i) => composites[i]).filter(Boolean);
  const isBatchMode = selectedCompositeIndices.size > 1;
  const batchSize = selectedCompositeIndices.size;
  const perVideoCost = 3;
  const totalFullPrice = batchSize * perVideoCost;
  const discountedTotal = batchSize <= 1 ? perVideoCost : batchSize === 2 ? 5 : Math.round(batchSize * perVideoCost * 0.75);
  const savings = totalFullPrice - discountedTotal;

  const toggleComposite = (i) => {
    setSelectedCompositeIndices((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };
  
  const selectAllComposites = () => {
    if (selectedCompositeIndices.size === composites.length) {
      setSelectedCompositeIndices(new Set());
    } else {
      setSelectedCompositeIndices(new Set(composites.map((_, i) => i)));
    }
  };

  const handleGenerateComposites = async () => {
    // Check if we have avatars and property images
    if (!selectedAvatars || selectedAvatars.length === 0) {
      toast.error("Please select at least one avatar");
      return;
    }
    
    if (propertyImages.length === 0) {
      toast.error("Please upload at least one property image");
      return;
    }
    
    setGeneratingComposites(true);
    setComposites([]);
    setSelectedCompositeIndices(new Set());
    
    try {
      // Process all selected avatars
      const avatarFiles = [];
      for (let i = 0; i < selectedAvatars.length; i++) {
        const avatar = selectedAvatars[i];
        let avatarFile;
        
        if (avatar.file) {
          avatarFile = await ensureFileObject(avatar.file);
          avatarFile = await compressImage(avatarFile);
        } else if (avatar.url) {
          avatarFile = await ensureFileObject(avatar.url);
          avatarFile = await compressImage(avatarFile);
        }
        
        if (!avatarFile) {
          throw new Error(`Failed to process avatar image ${i + 1}`);
        }
        
        avatarFiles.push({
          file: avatarFile,
          name: avatar.name || `Avatar ${i + 1}`,
          angle: avatar.angle || i === 0 ? "front" : i === 1 ? "three-quarter" : "side"
        });
      }

      const results = [];
      let compositeIndex = 0;
      
      // Generate composites for each property image with each avatar
      for (let propIdx = 0; propIdx < propertyImages.length; propIdx++) {
        // Process property image
        let propertyFile = await ensureFileObject(propertyImages[propIdx]);
        if (!propertyFile) {
          throw new Error(`Failed to process property image ${propIdx + 1}`);
        }
        
        const compressedProperty = await compressImage(propertyFile);
        
        // For each avatar, create a composite with this property
        for (let avatarIdx = 0; avatarIdx < avatarFiles.length; avatarIdx++) {
          const avatar = avatarFiles[avatarIdx];
          toast.info(`Creating composite ${compositeIndex + 1}/${propertyImages.length * avatarFiles.length}...`, 
            { id: "composite-progress" }
          );
          
          const fd = new FormData();
          fd.append("avatarImage", avatar.file);
          fd.append("propertyImage", compressedProperty);

          const res = await fetch("/api/real-estate-video/composite", { 
            method: "POST", 
            body: fd 
          });
          
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `Composite failed`);

          results.push({
            url: data.compositeUrl,
            file: dataUrlToFile(data.compositeUrl, `composite-${propIdx}-${avatarIdx}.png`),
            title: `${avatar.name} - Property ${propIdx + 1}`,
            propertyIndex: propIdx,
            avatarIndex: avatarIdx,
            avatarAngle: avatar.angle,
          });
          
          compositeIndex++;
        }
      }

      setComposites(results);
      toast.success(`${results.length} composite(s) ready — select your favorites!`, { id: "composite-progress" });
      
      // Auto-select first few composites if any
      if (results.length > 0) {
        const autoSelectCount = Math.min(3, results.length);
        setSelectedCompositeIndices(new Set(Array.from({ length: autoSelectCount }, (_, i) => i)));
      }
    } catch (err) {
      console.error('Composite generation error:', err);
      toast.error("Composite generation failed", { description: err.message });
    } finally {
      setGeneratingComposites(false);
    }
  };

  const saveUnusedComposites = async () => {
    const unselected = composites.filter((_, i) => !selectedCompositeIndices.has(i));
    if (unselected.length === 0) return;
    setSavingComposites(true);
    try {
      const payload = {
        composites: composites.map((c) => ({ dataUrl: c.url, name: c.title })),
        selectedIndex: [...selectedCompositeIndices][0] ?? 0,
      };
      const res = await fetch("/api/real-estate-video/save-composites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.saved?.length > 0) {
        toast.success(`${data.saved.length} composite(s) saved to Asset Library`);
      }
    } catch (err) {
      console.error("Failed to save composites:", err);
    } finally {
      setSavingComposites(false);
    }
  };

  const handleCompositeNext = async () => {
    if (selectedCompositeIndices.size === 0) return;
    await saveUnusedComposites();
  };

  const retryCompositeGeneration = async () => {
    await handleGenerateComposites();
  };

  return {
    composites,
    setComposites,
    generatingComposites,
    selectedCompositeIndices,
    setSelectedCompositeIndices,
    savingComposites,
    selectedCompositeArray,
    isBatchMode,
    batchSize,
    totalFullPrice,
    discountedTotal,
    savings,
    toggleComposite,
    selectAllComposites,
    handleGenerateComposites,
    handleCompositeNext,
    retryCompositeGeneration,
  };
};