import { useState } from 'react';
import { toast } from 'sonner';
import { combineVideos, uploadCombinedVideo } from '@/lib/video-combiner';
import { dataURLToBlob } from '../../helpers/fileHelpers';
import { clearSessionAfterGeneration } from '@/utils/indexedDB';

const MAX_RETRY_ATTEMPTS = 3;

// ────────────────────────────────────────────────────────────────────────────
// Shared helper: build a File from various composite input formats
// ────────────────────────────────────────────────────────────────────────────
async function buildCompositeFile(composite, videoIndex) {
  if (composite.file instanceof File) return composite.file;
  if (typeof composite.url === 'string' && composite.url.startsWith('data:')) {
    const blob = dataURLToBlob(composite.url);
    return new File([blob], `composite-${videoIndex}.png`, { type: 'image/png' });
  }
  if (typeof composite.url === 'string') {
    const response = await fetch(composite.url);
    const blob = await response.blob();
    return new File([blob], `composite-${videoIndex}.png`, { type: blob.type });
  }
  throw new Error(`Invalid composite format for video ${videoIndex + 1}`);
}

export const useVideoGeneration = (selectedCompositeArray, scriptHook, sessionId, engineSettings = {}) => {
  const [generating, setGenerating] = useState(false);
  const [videoStatuses, setVideoStatuses] = useState([]);
  const [videoResults, setVideoResults] = useState([]);
  const [retryingVideos, setRetryingVideos] = useState(new Set());
  const [videoRetryAttempts, setVideoRetryAttempts] = useState({});
  const [sessionCleaned, setSessionCleaned] = useState(false);

  // Combine state
  const [combining, setCombining] = useState(false);
  const [combineProgress, setCombineProgress] = useState('');
  const [combinedVideo, setCombinedVideo] = useState(null);

  // ── Engine settings (lifted from page.js) ───────────────────────────────
  const {
    videoEngine      = 'veo',
    setVideoEngine   = () => {},
    seedanceDuration = '5',
    setSeedanceDuration = () => {},
    seedanceResolution  = '720p',
    setSeedanceResolution = () => {},
    seedanceAudio    = true,
    setSeedanceAudio = () => {},
  } = engineSettings;

  const { script, batchScripts, structuredScripts, sharedVoicePrompt, setSharedVoicePrompt, isBatchMode, language, getFinalScripts } = scriptHook;

  // ── Session cleanup ──────────────────────────────────────────────────────
  const cleanupSessionData = async (keepPropertyImages = true, keepAvatars = true) => {
    if (!sessionId || sessionCleaned) return;
    try {
      await clearSessionAfterGeneration(sessionId, { keepSession: true, keepPropertyImages, keepAvatars });
      setSessionCleaned(true);
      console.log('Session data cleaned up after video generation');
    } catch (error) {
      console.error('Failed to cleanup session:', error);
    }
  };

  // ── SSE stream reader (shared by both Veo and Seedance) ──────────────────
  const consumeSSEStream = async (response, videoIndex, onVoiceReady) => {
    if (!response.body) throw new Error('No response stream');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let capturedVoice = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));

          if (event.type === 'progress') {
            toast.info(event.message, { id: `video-gen-${videoIndex}` });
          }
          if (event.type === 'voice_ready' && event.voicePrompt) {
            capturedVoice = event.voicePrompt;
            if (videoIndex === 0) setSharedVoicePrompt(event.voicePrompt);
            onVoiceReady?.(event.voicePrompt);
          }
          if (event.type === 'video_ready') {
            setVideoStatuses((prev) => { const n = [...prev]; n[videoIndex] = 'ready'; return n; });
            setVideoResults((prev) => { const n = [...prev]; n[videoIndex] = { videoUrl: event.videoUrl }; return n; });
            toast.success(`🏠 Video ${videoIndex + 1} ready!`, { id: `video-gen-${videoIndex}` });
          }
          if (event.type === 'error') {
            setVideoStatuses((prev) => { const n = [...prev]; n[videoIndex] = 'error'; return n; });
            toast.error(`Video ${videoIndex + 1} failed`, { description: event.message });
          }
        } catch (_) {}
      }
    }
    return capturedVoice;
  };

  // ── Veo: generate a single video ─────────────────────────────────────────
  const generateVeoVideo = async (composite, scriptText, videoIndex, providedVoicePrompt) => {
    const compositeFile = await buildCompositeFile(composite, videoIndex);

    const fd = new FormData();
    fd.append('compositeImage', compositeFile);
    fd.append('script', scriptText.trim());
    fd.append('language', language || 'hindi');
    if (providedVoicePrompt) fd.append('sharedVoicePrompt', providedVoicePrompt);

    const response = await fetch('/api/real-estate-video/generate', { method: 'POST', body: fd });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Veo generation failed');
    }

    return await consumeSSEStream(response, videoIndex);
  };

  // ── Seedance: generate a single video ────────────────────────────────────
  const generateSeedanceVideo = async (composite, scriptText, videoIndex, voicePrompt) => {
    const compositeFile = await buildCompositeFile(composite, videoIndex);

    const fd = new FormData();
    fd.append('compositeImage', compositeFile);
    fd.append('script', scriptText.trim());
    fd.append('language', language || 'english');
    fd.append('duration', seedanceDuration);
    fd.append('resolution', seedanceResolution);
    fd.append('generateAudio', String(seedanceAudio));
    if (voicePrompt) fd.append('voicePrompt', voicePrompt);

    const response = await fetch('/api/real-estate-video/seedance-pipeline', { method: 'POST', body: fd });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Seedance generation failed');
    }

    return await consumeSSEStream(response, videoIndex);
  };

  // ── Main generation handler ───────────────────────────────────────────────
  const handleGenerateVideo = async () => {
    const comps = selectedCompositeArray;
    const scripts = getFinalScripts
      ? getFinalScripts()
      : (structuredScripts.length > 0
          ? structuredScripts.map((s) => s.fullScript || '')
          : batchScripts.length > 0
            ? batchScripts
            : [script]);

    if (comps.length === 0 || scripts.some((s) => !s?.trim())) return;

    setGenerating(true);
    setSharedVoicePrompt('');
    setVideoStatuses(comps.map(() => 'generating'));
    setVideoResults(comps.map(() => null));
    setSessionCleaned(false);

    let capturedVoice = '';
    let allVideosSuccessful = true;
    let successCount = 0;

    const generateFn = videoEngine === 'seedance' ? generateSeedanceVideo : generateVeoVideo;

    for (let i = 0; i < comps.length; i++) {
      try {
        const returned = await generateFn(comps[i], scripts[i], i, i > 0 ? capturedVoice : undefined);
        if (i === 0 && returned) capturedVoice = returned;
        successCount++;
      } catch (err) {
        console.error(`Video ${i + 1} error:`, err);
        setVideoStatuses((prev) => { const n = [...prev]; n[i] = 'error'; return n; });
        toast.error(`Video ${i + 1} failed`, { description: err.message });
        allVideosSuccessful = false;
      }
    }

    setGenerating(false);

    if (allVideosSuccessful && successCount === comps.length) {
      await cleanupSessionData(true, true);
      toast.success('Session data saved and cleaned up!');
    } else if (successCount > 0) {
      toast.warning(`${successCount}/${comps.length} videos generated successfully`);
    }
  };

  // ── Retry single video ────────────────────────────────────────────────────
  const retryVideoGeneration = async (videoIndex) => {
    const comps = selectedCompositeArray;
    const scripts = getFinalScripts
      ? getFinalScripts()
      : (structuredScripts.length > 0
          ? structuredScripts.map((s) => s.fullScript || '')
          : batchScripts.length > 0
            ? batchScripts
            : [script]);

    if (!comps[videoIndex] || !scripts[videoIndex]) return;

    const attempts = videoRetryAttempts[videoIndex] || 0;
    if (attempts >= MAX_RETRY_ATTEMPTS) {
      toast.error(`Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached for video ${videoIndex + 1}`);
      return;
    }

    setRetryingVideos((prev) => new Set([...prev, videoIndex]));
    setVideoRetryAttempts((prev) => ({ ...prev, [videoIndex]: attempts + 1 }));
    setVideoStatuses((prev) => { const n = [...prev]; n[videoIndex] = 'generating'; return n; });

    try {
      const generateFn = videoEngine === 'seedance' ? generateSeedanceVideo : generateVeoVideo;
      await generateFn(comps[videoIndex], scripts[videoIndex], videoIndex, sharedVoicePrompt || undefined);
      toast.success(`Video ${videoIndex + 1} regenerated successfully!`);
    } catch (err) {
      console.error(`Retry failed for video ${videoIndex + 1}:`, err);
      setVideoStatuses((prev) => { const n = [...prev]; n[videoIndex] = 'error'; return n; });
      toast.error(`Failed to regenerate video ${videoIndex + 1}: ${err.message}`);
    } finally {
      setRetryingVideos((prev) => { const n = new Set(prev); n.delete(videoIndex); return n; });
    }
  };

  const retryAllFailedVideos = async () => {
    const failedIndices = videoStatuses
      .map((status, idx) => status === 'error' ? idx : null)
      .filter((idx) => idx !== null);

    if (failedIndices.length === 0) return;
    for (const idx of failedIndices) {
      await retryVideoGeneration(idx);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  };

  // ── Combine videos ────────────────────────────────────────────────────────
  const handleCombineVideos = async () => {
    const readyUrls = videoResults.filter(Boolean).map((r) => r.videoUrl).filter(Boolean);
    if (readyUrls.length < 2) return;

    setCombining(true);
    setCombineProgress('Initializing...');
    setCombinedVideo(null);

    try {
      const { blobUrl, blob } = await combineVideos(readyUrls, {
        crossfadeDuration: 0.5,
        onProgress: (msg) => setCombineProgress(msg),
      });

      setCombinedVideo({ blobUrl, serverUrl: null });
      toast.success('Videos combined successfully!');

      setCombineProgress('Uploading to server...');
      try {
        const { url } = await uploadCombinedVideo(blob);
        setCombinedVideo((prev) => ({ ...prev, serverUrl: url }));
        toast.success('Combined video saved to Asset Library!');
      } catch (uploadErr) {
        console.error('Upload failed:', uploadErr);
        toast.error('Upload failed — you can still download the video locally.');
      }
    } catch (err) {
      console.error('Combine failed:', err);
      toast.error('Video combining failed', { description: err.message });
    } finally {
      setCombining(false);
      setCombineProgress('');
    }
  };

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

    // Engine settings
    videoEngine,
    setVideoEngine,
    seedanceDuration,
    setSeedanceDuration,
    seedanceResolution,
    setSeedanceResolution,
    seedanceAudio,
    setSeedanceAudio,

    handleGenerateVideo,
    retryVideoGeneration,
    retryAllFailedVideos,
    handleCombineVideos,
    manualCleanup,
  };
};