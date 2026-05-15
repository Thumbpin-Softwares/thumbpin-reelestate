import { useState } from 'react';
import { toast } from 'sonner';
import { ensureFileObject, compressImage, dataUrlToFile } from '../../helpers/fileHelpers';

export const useComposites = (propertyImages, selectedAvatars) => {
  const [composites, setComposites] = useState([]);
  const [generatingComposites, setGeneratingComposites] = useState(false);
  const [selectedCompositeIndices, setSelectedCompositeIndices] = useState(new Set());
  const [savingComposites, setSavingComposites] = useState(false);
  const [compositeGenerationTotal, setCompositeGenerationTotal] = useState(0);

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
    setCompositeGenerationTotal(propertyImages.length);
    
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
      
      // Use the FIRST (cover) avatar pose for compositing.
      // Extra poses in the collection are visual references only — NOT separate composites.
      const primaryAvatar = avatarFiles[0];
      
      // Generate exactly 1 composite per property image
      for (let propIdx = 0; propIdx < propertyImages.length; propIdx++) {
        // Process property image
        let propertyFile = await ensureFileObject(propertyImages[propIdx]);
        if (!propertyFile) {
          throw new Error(`Failed to process property image ${propIdx + 1}`);
        }
        
        const compressedProperty = await compressImage(propertyFile);
        
        toast.info(`Creating composite ${propIdx + 1}/${propertyImages.length}...`, 
          { id: "composite-progress" }
        );
        
        const fd = new FormData();
        fd.append("avatarImage", primaryAvatar.file);
        fd.append("propertyImage", compressedProperty);

        const res = await fetch("/api/real-estate-video/composite", { 
          method: "POST", 
          body: fd 
        });
        
        const contentType = res.headers.get("content-type");
        let data;
        if (contentType && contentType.includes("application/json")) {
          data = await res.json();
        }

        if (!res.ok) {
          if (res.status === 413) {
            throw new Error("The images are too large. Please try smaller files.");
          }
          throw new Error(data?.error || `Composite failed with status ${res.status}`);
        }

        if (!data) {
          throw new Error("Invalid response from server");
        }

        const newComposite = {
          url: data.compositeUrl,
          file: dataUrlToFile(data.compositeUrl, `composite-${propIdx}.png`),
          title: `${primaryAvatar.name} - Property ${propIdx + 1}`,
          propertyIndex: propIdx,
          avatarIndex: 0,
          avatarAngle: primaryAvatar.angle,
        };

        results.push(newComposite);

        // Reveal each generated composite immediately so the user never waits for all of them.
        setComposites([...results]);

        // Auto-select newly generated composites progressively (up to first 3).
        setSelectedCompositeIndices((prev) => {
          const next = new Set(prev);
          if (next.size < 3) next.add(propIdx);
          return next;
        });
      }

      toast.success(`${results.length} composite(s) ready — select your favorites!`, { id: "composite-progress" });
    } catch (err) {
      console.error('Composite generation error:', err);
      toast.error("Composite generation failed", { description: err.message });
    } finally {
      setGeneratingComposites(false);
      setCompositeGenerationTotal(0);
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
    compositeGenerationTotal,
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