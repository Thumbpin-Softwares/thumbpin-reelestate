import { useState } from 'react';
import { toast } from 'sonner';
import { ensureFileObject, compressImage, dataUrlToFile } from '../../helpers/fileHelpers';

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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
      toast.error("Please select at least one avatar collection or presenter");
      return;
    }

    if (propertyImages.length === 0) {
      toast.error("Please upload at least one location photo");
      return;
    }
    
    setGeneratingComposites(true);
    setComposites([]);
    setSelectedCompositeIndices(new Set());
    setCompositeGenerationTotal(propertyImages.length);
    
    try {
      const results = [];

      // Normalize each location photo into a local reference card.
      for (let propIdx = 0; propIdx < propertyImages.length; propIdx++) {
        let propertyFile = await ensureFileObject(propertyImages[propIdx]);
        if (!propertyFile) {
          throw new Error(`Failed to process location photo ${propIdx + 1}`);
        }

        const compressedProperty = await compressImage(propertyFile);
        const referenceUrl = await fileToDataUrl(compressedProperty);

        const newComposite = {
          url: referenceUrl,
          file: dataUrlToFile(referenceUrl, `location-${propIdx}.png`),
          title: `Location Photo ${propIdx + 1}`,
          propertyIndex: propIdx,
          avatarIndex: 0,
          avatarAngle: selectedAvatars[0]?.angle || "front",
        };

        results.push(newComposite);

        // Reveal each location reference immediately so the user never waits for all of them.
        setComposites([...results]);

        // Auto-select newly prepared location references progressively (up to first 3).
        setSelectedCompositeIndices((prev) => {
          const next = new Set(prev);
          if (next.size < 3) next.add(propIdx);
          return next;
        });
      }

      toast.success(`${results.length} location reference(s) ready — select your favorites!`, { id: "composite-progress" });
    } catch (err) {
      console.error('Location reference preparation error:', err);
      toast.error("Reference preparation failed", { description: err.message });
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