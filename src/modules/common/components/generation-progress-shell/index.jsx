"use client";

import { Loader2, CheckCircle2, AlertCircle, RotateCcw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shared presentational shell for every pipeline's "generating…" screen — a
 * 9:16 mobile-shaped frame with a single centered loader/result state inside.
 * This is the ONE place the visual design of the generate step lives; every
 * pipeline's GenerationProgress component keeps its own state machine but
 * renders through this shell, so a UI change here updates every pipeline at
 * once instead of needing to be copy-pasted across each fork.
 */
export function GenerationProgressShell({
  phase, // "loading" | "error" | "done"
  stageText,
  renderPercent = 0,
  error,
  onRetry,
  onAbort,
  onDownload,
  onOpenEditor,
  doneText = "Your reel is ready!",
  downloadText = "Download reel",
  openEditorText = "Open in editor",
  footerText = "Don't close this tab — refreshing is safe, we'll pick up right where we left off.",
}) {
  const isGenerating = phase !== "error" && phase !== "done";

  return (
    <div className="flex flex-col items-center gap-4 animate-fade-in">
      <div className="relative mx-auto w-full max-w-[220px] aspect-1/2 rounded-xl border-8 border-neutral-900 bg-neutral-950 overflow-hidden shadow-2xl">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
          {phase === "error" ? (
            <>
              <AlertCircle className="w-10 h-10 text-destructive" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">Generation failed</p>
                <p className="text-xs text-white/60">{error}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                className="gap-2 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retry
              </Button>
            </>
          ) : phase === "done" ? (
            <>
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              <p className="text-sm font-medium text-white">{doneText}</p>
              <Button
                size="sm"
                onClick={onDownload}
                className="gap-2 text-xs bg-[#c7f038] text-black hover:bg-[#c7f038]/90"
              >
                <Download className="w-3.5 h-3.5" />
                {downloadText}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onOpenEditor}
                className="gap-1.5 text-xs text-white/60 hover:text-white hover:bg-white/10"
              >
                {openEditorText}
              </Button>
            </>
          ) : (
            <>
              <Loader2 className="w-10 h-10 text-white animate-spin" />
              <p
                key={stageText}
                className="text-sm font-medium text-white"
                style={{ animation: "fadeInUp 0.4s ease" }}
              >
                {stageText || "Processing…"}
                {renderPercent > 0 ? ` ${renderPercent}%` : ""}
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={onAbort}
                className="gap-2 text-xs text-white hover:text-white bg-red-500 hover:bg-red-500"
              >
                Abort
              </Button>
            </>
          )}
        </div>
      </div>

      {isGenerating && footerText && (
        <p className="text-xs text-muted-foreground text-center max-w-[380px]">
          {footerText}
        </p>
      )}

      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}
