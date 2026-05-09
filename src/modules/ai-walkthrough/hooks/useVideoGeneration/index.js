import { useState } from 'react';
import { toast } from 'sonner';
import { combineVideos, uploadCombinedVideo } from '@/lib/video-combiner';
import { dataURLToBlob } from '../../helpers/fileHelpers';
import { clearSessionAfterGeneration } from '@/utils/indexedDB';

const MAX_RETRY_ATTEMPTS = 3;

export const useVideoGeneration = (selectedCompositeArray, scriptHook, sessionId) => {
  const [generating, setGenerating] = useState(false);
  const [videoStatuses, setVideoStatuses] = useState([]);
  const [videoResults, setVideoResults] = useState([]);
  const [retryingVideos, setRetryingVideos] = useState(new Set());
  const [videoRetryAttempts, setVideoRetryAttempts] = useState({});
  const [sessionCleaned, setSessionCleaned] = useState(false);
  
  // Combine state
  const [combining, setCombining] = useState(false);
  const [combineProgress, setCombineProgress] = useState("");
  const [combinedVideo, setCombinedVideo] = useState(null);

  const { script, structuredScripts, sharedVoicePrompt, setSharedVoicePrompt, isBatchMode } = scriptHook;

  // Cleanup function after successful generation
  const cleanupSessionData = async (keepPropertyImages = true, keepAvatars = true) => {
    if (!sessionId || sessionCleaned) return;
    
    try {
      await clearSessionAfterGeneration(sessionId, {
        keepSession: true,
        keepPropertyImages: keepPropertyImages,
        keepAvatars: keepAvatars
      });
      setSessionCleaned(true);
      console.log("Session data cleaned up after video generation");
    } catch (error) {
      console.error("Failed to cleanup session:", error);
    }
  };

  const generateSingleVideo = async (composite, scriptText, videoIndex, providedVoicePrompt) => {
    let compositeFile;
    
    // Handle different types of composite inputs
    if (composite.file instanceof File) {
      compositeFile = composite.file;
    } else if (typeof composite.url === 'string' && composite.url.startsWith('data:')) {
      const blob = dataURLToBlob(composite.url);
      compositeFile = new File([blob], `composite-${videoIndex}.png`, { type: 'image/png' });
    } else if (typeof composite.url === 'string') {
      const response = await fetch(composite.url);
      const blob = await response.blob();
      compositeFile = new File([blob], `composite-${videoIndex}.png`, { type: blob.type });
    } else {
      throw new Error(`Invalid composite format for video ${videoIndex + 1}`);
    }
    
    const fd = new FormData();
    fd.append("compositeImage", compositeFile);
    fd.append("script", scriptText.trim());
    if (providedVoicePrompt) fd.append("sharedVoicePrompt", providedVoicePrompt);

    const response = await fetch("/api/real-estate-video/generate", { method: "POST", body: fd });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Generation failed");
    }
    if (!response.body) throw new Error("No response stream");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let capturedVoice = "";

    while (true) {
      const { value, done: streamDone } = await reader.read();
      if (streamDone) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === "progress") {
            toast.info(event.message, { id: `video-gen-${videoIndex}` });
          }
          if (event.type === "voice_ready" && event.voicePrompt) {
            capturedVoice = event.voicePrompt;
            if (videoIndex === 0) setSharedVoicePrompt(event.voicePrompt);
          }
          if (event.type === "video_ready") {
            setVideoStatuses((prev) => { const n = [...prev]; n[videoIndex] = "ready"; return n; });
            setVideoResults((prev) => { const n = [...prev]; n[videoIndex] = { videoUrl: event.videoUrl }; return n; });
            toast.success(`🏠 Video ${videoIndex + 1} ready!`, { id: `video-gen-${videoIndex}` });
          }
          if (event.type === "error") {
            setVideoStatuses((prev) => { const n = [...prev]; n[videoIndex] = "error"; return n; });
            toast.error(`Video ${videoIndex + 1} failed`, { description: event.message });
          }
        } catch (e) {}
      }
    }
    return capturedVoice;
  };

  const handleGenerateVideo = async () => {
    const comps = selectedCompositeArray;
    const scripts = isBatchMode
      ? structuredScripts.map((s) => s.fullScript || "")
      : [script];
    
    if (comps.length === 0 || scripts.some((s) => !s?.trim())) return;

    setGenerating(true);
    setSharedVoicePrompt("");
    setVideoStatuses(comps.map(() => "generating"));
    setVideoResults(comps.map(() => null));
    setSessionCleaned(false);

    let capturedVoice = "";
    let allVideosSuccessful = true;
    let successCount = 0;
    
    for (let i = 0; i < comps.length; i++) {
      try {
        const returned = await generateSingleVideo(comps[i], scripts[i], i, i > 0 ? capturedVoice : undefined);
        if (i === 0 && returned) capturedVoice = returned;
        successCount++;
      } catch (err) {
        console.error(`Video ${i + 1} error:`, err);
        setVideoStatuses((prev) => { const n = [...prev]; n[i] = "error"; return n; });
        toast.error(`Video ${i + 1} failed`, { description: err.message });
        allVideosSuccessful = false;
      }
    }
    setGenerating(false);

    // Cleanup session after successful video generation
    if (allVideosSuccessful && successCount === comps.length) {
      await cleanupSessionData(true, true);
      toast.success("Session data saved and cleaned up!");
    } else if (successCount > 0) {
      // Partial success - still clean up but warn
      toast.warning(`${successCount}/${comps.length} videos generated successfully`);
    }
  };

  const retryVideoGeneration = async (videoIndex) => {
    const comps = selectedCompositeArray;
    const scripts = isBatchMode
      ? structuredScripts.map((s) => s.fullScript || "")
      : [script];
    
    if (!comps[videoIndex] || !scripts[videoIndex]) return;
    
    const attempts = videoRetryAttempts[videoIndex] || 0;
    if (attempts >= MAX_RETRY_ATTEMPTS) {
      toast.error(`Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached for video ${videoIndex + 1}`);
      return;
    }
    
    setRetryingVideos(prev => new Set([...prev, videoIndex]));
    setVideoRetryAttempts(prev => ({ ...prev, [videoIndex]: attempts + 1 }));
    setVideoStatuses(prev => {
      const next = [...prev];
      next[videoIndex] = "generating";
      return next;
    });
    
    try {
      let capturedVoice = sharedVoicePrompt;
      let compositeFile;
      const composite = comps[videoIndex];
      
      // Handle different types of composite inputs
      if (composite.file instanceof File) {
        compositeFile = composite.file;
      } else if (typeof composite.url === 'string' && composite.url.startsWith('data:')) {
        const blob = dataURLToBlob(composite.url);
        compositeFile = new File([blob], `composite-${videoIndex}.png`, { type: 'image/png' });
      } else if (typeof composite.url === 'string') {
        const response = await fetch(composite.url);
        const blob = await response.blob();
        compositeFile = new File([blob], `composite-${videoIndex}.png`, { type: blob.type });
      } else {
        throw new Error(`Invalid composite format for video ${videoIndex + 1}`);
      }
      
      if (videoIndex === 0 || !capturedVoice) {
        const formData = new FormData();
        formData.append("compositeImage", compositeFile);
        formData.append("script", scripts[videoIndex].trim());
        if (capturedVoice) formData.append("sharedVoicePrompt", capturedVoice);
        
        const response = await fetch("/api/real-estate-video/generate", { method: "POST", body: formData });
        if (!response.ok) throw new Error("Generation failed");
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";
          
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "voice_ready" && event.voicePrompt && videoIndex === 0) {
                capturedVoice = event.voicePrompt;
                setSharedVoicePrompt(event.voicePrompt);
              }
              if (event.type === "video_ready") {
                setVideoStatuses(prev => {
                  const next = [...prev];
                  next[videoIndex] = "ready";
                  return next;
                });
                setVideoResults(prev => {
                  const next = [...prev];
                  next[videoIndex] = { videoUrl: event.videoUrl };
                  return next;
                });
                toast.success(`Video ${videoIndex + 1} regenerated successfully!`);
              }
              if (event.type === "error") {
                throw new Error(event.message);
              }
            } catch (e) {}
          }
        }
      } else {
        const response = await fetch("/api/real-estate-video/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            compositeImageUrl: composite.url,
            script: scripts[videoIndex].trim(),
            sharedVoicePrompt: capturedVoice
          })
        });
        
        if (!response.ok) throw new Error("Generation failed");
        const data = await response.json();
        
        setVideoStatuses(prev => {
          const next = [...prev];
          next[videoIndex] = "ready";
          return next;
        });
        setVideoResults(prev => {
          const next = [...prev];
          next[videoIndex] = { videoUrl: data.videoUrl };
          return next;
        });
        toast.success(`Video ${videoIndex + 1} regenerated successfully!`);
      }
    } catch (err) {
      console.error(`Retry failed for video ${videoIndex + 1}:`, err);
      setVideoStatuses(prev => {
        const next = [...prev];
        next[videoIndex] = "error";
        return next;
      });
      toast.error(`Failed to regenerate video ${videoIndex + 1}: ${err.message}`);
    } finally {
      setRetryingVideos(prev => {
        const next = new Set(prev);
        next.delete(videoIndex);
        return next;
      });
    }
  };

  const retryAllFailedVideos = async () => {
    const failedIndices = videoStatuses
      .map((status, idx) => status === "error" ? idx : null)
      .filter(idx => idx !== null);
    
    if (failedIndices.length === 0) return;
    
    for (const idx of failedIndices) {
      await retryVideoGeneration(idx);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  };

  const handleCombineVideos = async () => {
    const readyUrls = videoResults.filter(Boolean).map((r) => r.videoUrl).filter(Boolean);
    if (readyUrls.length < 2) return;

    setCombining(true);
    setCombineProgress("Initializing...");
    setCombinedVideo(null);

    try {
      const { blobUrl, blob } = await combineVideos(readyUrls, {
        crossfadeDuration: 0.5,
        onProgress: (msg) => setCombineProgress(msg),
      });

      setCombinedVideo({ blobUrl, serverUrl: null });
      toast.success("Videos combined successfully!");

      setCombineProgress("Uploading to server...");
      try {
        const { url } = await uploadCombinedVideo(blob);
        setCombinedVideo((prev) => ({ ...prev, serverUrl: url }));
        toast.success("Combined video saved to Asset Library!");
      } catch (uploadErr) {
        console.error("Upload failed:", uploadErr);
        toast.error("Upload failed — you can still download the video locally.");
      }
    } catch (err) {
      console.error("Combine failed:", err);
      toast.error("Video combining failed", { description: err.message });
    } finally {
      setCombining(false);
      setCombineProgress("");
    }
  };

  // Manual cleanup function for parent components
  const manualCleanup = async (keepPropertyImages = true, keepAvatars = true) => {
    await cleanupSessionData(keepPropertyImages, keepAvatars);
  };

  return {
    generating,
    videoStatuses,
    setVideoStatuses,
    videoResults,
    setVideoResults,
    retryingVideos,
    videoRetryAttempts,
    maxRetryAttempts: MAX_RETRY_ATTEMPTS,
    combining,
    combineProgress,
    combinedVideo,
    sessionCleaned,
    handleGenerateVideo,
    retryVideoGeneration,
    retryAllFailedVideos,
    handleCombineVideos,
    manualCleanup, // Expose manual cleanup if needed
  };
};