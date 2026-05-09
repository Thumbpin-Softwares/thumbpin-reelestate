// components/real-estate-video/components/VideoResults.js
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, RotateCcw, Merge, Download, Film, Trash2 } from "lucide-react";
import VideoCard from "@/modules/ai-walkthrough/components/VideoCard";

export const VideoResults = ({ videoHook, compositesHook, onReset }) => {
  const {
    videoStatuses,
    videoResults,
    retryingVideos,
    videoRetryAttempts,
    maxRetryAttempts,
    retryVideoGeneration,
    retryAllFailedVideos,
    combining,
    combineProgress,
    combinedVideo,
    handleCombineVideos,
  } = videoHook;

  const { batchSize } = compositesHook;

  const readyCount = videoStatuses.filter((s) => s === "ready").length;
  const hasErrors = videoStatuses.some((s) => s === "error");
  const allReady = videoStatuses.every((s) => s === "ready");
  const showCombine = videoStatuses.length > 1 && readyCount >= 2;
  const handleManualCleanup = async () => {
  if (videoHook.manualCleanup) {
    await videoHook.manualCleanup(true, true);
    toast.success("Session data cleared!");
  }
};

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">
          {allReady
            ? `✅ ${batchSize > 1 ? `All ${batchSize} videos are` : "Your video is"} ready!`
            : hasErrors
            ? "⚠️ Some videos encountered errors"
            : "🏠 Creating your property showcase..."}
        </h2>
        <div className="flex gap-2">
          {hasErrors && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={retryAllFailedVideos}
              className="cursor-pointer text-xs gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Retry All Failed
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onReset} className="cursor-pointer text-xs">
            Start over
          </Button>
        </div>
      </div>

      {/* Background generation notice */}
      {videoStatuses.some((s) => s === "generating") && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-start gap-2">
          <span className="text-base">🎬</span>
          <div>
            <p className="text-xs font-semibold text-primary mb-0.5">
              Generating {videoStatuses.filter((s) => s === "generating").length} video(s)...
            </p>
            <p className="text-[11px] text-muted-foreground">
              You can freely browse — progress is saved automatically.
            </p>
          </div>
        </div>
      )}

      {/* Video cards */}
      {videoStatuses.map((status, i) => (
        <VideoCard 
          key={i}
          status={status}
          video={videoResults[i]}
          index={i}
          onRetry={retryVideoGeneration}
          retryingVideos={retryingVideos}
          videoRetryAttempts={videoRetryAttempts}
          maxRetryAttempts={maxRetryAttempts}
        />
      ))}

      {allReady && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
          <p className="text-sm font-medium">
            🏠 {batchSize > 1 ? `${batchSize} property videos` : "Property showcase video"} generated!
          </p>
          <p className="text-xs text-muted-foreground mt-1">Auto-saved to your Asset Library.</p>
        </div>
      )}

      {/* Combine Videos Section */}
      {showCombine && (
        <div className="rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center">
              <Film className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold">Combine into One Video</p>
              <p className="text-[11px] text-muted-foreground">
                Stitch all clips into a seamless walkthrough with crossfade transitions
              </p>
            </div>
          </div>

          {!combinedVideo && !combining && (
            <Button
              onClick={handleCombineVideos}
              className="w-full gradient-bg text-white shadow-md cursor-pointer gap-2"
            >
              <Merge className="w-4 h-4" />
              Combine {readyCount} Videos
            </Button>
          )}

          {combining && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <Loader2 className="w-4 h-4 animate-spin text-violet-600 dark:text-violet-400 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">Processing in browser...</p>
                <p className="text-[11px] text-muted-foreground">{combineProgress || "Working..."}</p>
              </div>
            </div>
          )}

          {combinedVideo && (
            <div className="space-y-3">
              <div className="rounded-xl overflow-hidden bg-black aspect-[9/16] max-h-80 mx-auto border border-violet-500/30">
                <video
                  src={combinedVideo.serverUrl || combinedVideo.blobUrl}
                  controls
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex justify-center gap-3">
                <a
                  href={combinedVideo.blobUrl}
                  download="combined-walkthrough.mp4"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-500 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download Combined
                </a>
                {combinedVideo.serverUrl && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> Saved to Library
                  </span>
                )}
              </div>
            </div>
          )}

          <Button onClick={handleManualCleanup} variant="outline" size="sm">
  <Trash2 className="w-4 h-4 mr-1" /> Clear Session Data
</Button>
        </div>
      )}
    </div>
  );
};