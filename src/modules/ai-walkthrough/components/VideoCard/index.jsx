import {
  Loader2,
  CheckCircle2,
  Download,
  RotateCcw,
  AlertCircle,
  Maximize2,
  XCircle,
  RefreshCw,
  X
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

export default function VideoCard({ 
  status, 
  video, 
  index, 
  onRetry, 
  retryingVideos = new Set(),
  videoRetryAttempts = {},
  maxRetryAttempts = 3 
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef(null);
  
  const isGenerating = status === "generating";
  const isReady = status === "ready" && video?.videoUrl;
  const isError = status === "error";
  const isRetrying = retryingVideos.has(index);
  const attempts = videoRetryAttempts[index] || 0;
  const isMaxRetriesReached = attempts >= maxRetryAttempts;

  // Helper function to fix the video URL
  const getFixedVideoUrl = (url) => {
    if (!url) return '';
    // Fix incorrect path: replace '/api/r2/user' with '/api/r2'
    if (url.includes('/api/r2/user')) {
      return url.replace('/api/r2/user', '/api/r2');
    }
    return url;
  };

  const handleFullscreen = useCallback(() => {
    if (isFullscreen) {
      setIsFullscreen(false);
      return;
    }
    setIsFullscreen(true);
  }, [isFullscreen]);

  // Close fullscreen on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    if (isFullscreen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  const handleVideoPlay = () => setIsPlaying(true);
  const handleVideoPause = () => setIsPlaying(false);
  const handleVideoError = () => setVideoError(true);
  const handleVideoLoaded = () => { setVideoLoaded(true); setVideoError(false); };

  // Calculate progress for generating state
  const getProgressMessage = () => {
    if (isRetrying) return `Retrying... (Attempt ${attempts}/${maxRetryAttempts})`;
    if (isGenerating) {
      const step = Math.floor(Math.random() * 3);
      const messages = [
        "🎬 Crafting cinematic scene...",
        "🎙️ Generating voiceover...",
        "✨ Adding visual effects..."
      ];
      return messages[step];
    }
    return "Generating video...";
  };

  const fixedVideoUrl = isReady ? getFixedVideoUrl(video.videoUrl) : '';

  return (
    <div className={`rounded-xl border transition-all duration-300 overflow-hidden ${
      isReady 
        ? "border-primary/40 bg-card shadow-lg hover:shadow-xl" 
        : isGenerating 
        ? "border-amber-500/40 bg-linear-to-br from-amber-500/5 to-orange-500/5" 
        : isError
        ? "border-destructive/40 bg-destructive/5"
        : "border-border/40 bg-muted/30 opacity-50"
    }`}>
      
      {/* Header */}
      <div className="p-4 flex items-center gap-3 border-b border-border/20">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold transition-all ${
          isReady 
            ? "gradient-bg text-white shadow-md" 
            : isGenerating 
            ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
            : isError
            ? "bg-destructive/20 text-destructive border border-destructive/30"
            : "bg-muted text-muted-foreground"
        }`}>
          {isReady ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : isGenerating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isError ? (
            <AlertCircle className="w-5 h-5" />
          ) : (
            <span>{index !== undefined ? index + 1 : "1"}</span>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">
              {isReady 
                ? "✅ Video Ready!" 
                : isGenerating 
                ? "🎬 Creating Your Video..." 
                : isError
                ? "❌ Generation Failed"
                : "⏳ Waiting..."}
            </p>
            {isError && !isMaxRetriesReached && (
              <span className="text-[10px] font-mono text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                Attempt {attempts}/{maxRetryAttempts}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isReady 
              ? "Your property showcase is ready to view and download" 
              : isGenerating 
              ? getProgressMessage()
              : isError
              ? showErrorDetails 
                ? "Check your connection and try again. If the issue persists, contact support."
                : "An error occurred during generation"
              : "Pending generation"}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {isError && !isMaxRetriesReached && (
            <button
              onClick={() => onRetry?.(index)}
              disabled={isRetrying}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                isRetrying 
                  ? "bg-muted text-muted-foreground cursor-not-allowed" 
                  : "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30"
              }`}
            >
              {isRetrying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              Retry
            </button>
          )}
          
          {isError && isMaxRetriesReached && (
            <button
              onClick={() => setShowErrorDetails(!showErrorDetails)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/50 text-muted-foreground hover:bg-muted transition-all"
            >
              {showErrorDetails ? "Hide Details" : "Show Details"}
            </button>
          )}
        </div>
      </div>

      {/* Error Details (expanded) */}
      {isError && showErrorDetails && (
        <div className="px-4 py-3 bg-destructive/5 border-b border-destructive/20">
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-destructive font-medium mb-1">Error Details:</p>
              <p className="text-[11px] text-muted-foreground">
                {video?.errorMessage || "Video generation failed. This could be due to network issues, server timeout, or invalid parameters."}
              </p>
              {attempts >= maxRetryAttempts && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">
                  💡 Maximum retry attempts reached. Please check your inputs and try starting over.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video Player */}
      {isReady && fixedVideoUrl && (
        <div className="p-4 pt-3">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-9/16 max-h-96 mx-auto group">
            {/* Loading state */}
            {!videoLoaded && !videoError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              </div>
            )}
            
            {/* Error state */}
            {videoError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 gap-2">
                <AlertCircle className="w-6 h-6 text-destructive" />
                <p className="text-xs text-white/70">Failed to load video</p>
                <button
                  onClick={() => {
                    setVideoError(false);
                    setVideoLoaded(false);
                    if (videoRef.current) {
                      videoRef.current.load();
                    }
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Retry
                </button>
              </div>
            )}
            
            <video
              ref={videoRef}
              src={fixedVideoUrl}
              className="w-full h-full object-contain cursor-pointer"
              controls
              controlsList="nodownload"
              crossOrigin="anonymous"
              playsInline
              onPlay={handleVideoPlay}
              onPause={handleVideoPause}
              onError={handleVideoError}
              onLoadedData={handleVideoLoaded}
              preload="auto"
            />
            
            {/* Fullscreen button (top right) */}
            <button
              onClick={handleFullscreen}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center text-white transition-all opacity-0 group-hover:opacity-100 z-20"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
          
          {/* Download Section */}
          <div className="flex justify-between items-center mt-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">
                {video.duration ? `Duration: ${video.duration}s` : "Ready to view & download"}
              </span>
            </div>
            
            <div className="flex gap-2">
              {onRetry && (
                <button
                  onClick={() => onRetry?.(index)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate
                </button>
              )}
              
              <a
                href={fixedVideoUrl}
                download={`real-estate-video-${index !== undefined ? index + 1 : 1}.mp4`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors px-3 py-1 rounded-lg bg-primary/10 hover:bg-primary/20"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Overlay */}
      {isFullscreen && isReady && fixedVideoUrl && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) setIsFullscreen(false); }}>
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          <video
            src={fixedVideoUrl}
            className="max-w-full max-h-full object-contain"
            controls
            autoPlay
            crossOrigin="anonymous"
            playsInline
          />
        </div>
      )}

      {/* Generating State Skeleton */}
      {isGenerating && !isError && (
        <div className="p-4 pt-0">
          <div className="rounded-xl bg-linear-to-br from-muted/50 to-muted/30 aspect-9/16 max-h-96 mx-auto flex flex-col items-center justify-center gap-3">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-50">
              {isRetrying 
                ? `Retry attempt ${attempts}/${maxRetryAttempts}...` 
                : "Crafting your cinematic property video..."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}