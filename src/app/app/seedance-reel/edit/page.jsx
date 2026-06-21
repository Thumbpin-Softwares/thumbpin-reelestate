"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Player } from "@remotion/player";
import { Plus, ArrowLeft, Loader2, Download, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SeedanceReelComposition } from "@/lib/remotion/SeedanceReelComposition";
import { calcDurationInFrames } from "@/lib/remotion/duration";

export default function SeedanceReelEditPage() {
  const router = useRouter();
  const [compositionProps, setCompositionProps] = useState(null);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("seedance_composition");
      if (raw) setCompositionProps(JSON.parse(raw));
    } catch (_) {}
  }, []);

  const handleDownload = async () => {
    setRendering(true);
    setRenderError(null);
    try {
      const res = await fetch("/api/seedance-reel/render-remotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(compositionProps),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || `Render failed: ${res.status}`);

      const sep = data.url.includes("?") ? "&" : "?";
      const downloadUrl = `${data.url}${sep}download=1&filename=seedance-reel.mp4`;

      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "seedance-reel.mp4";
      document.body.appendChild(a);
      a.click();
      a.remove();

      toast.success("Reel rendered! Download starting…");
    } catch (err) {
      console.error("[EditPage] Render failed:", err);
      setRenderError(err.message || "Render failed");
      toast.error("Render failed", { description: err.message });
    } finally {
      setRendering(false);
    }
  };

  if (!compositionProps) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your reel…</p>
        <Button variant="ghost" size="sm" onClick={() => router.push("/app/seedance-reel")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to generator
        </Button>
      </div>
    );
  }

  const durationInFrames = calcDurationInFrames({
    avatarDuration: compositionProps.avatarDuration,
    brollClips:     compositionProps.brollClips,
    ctaDuration:    compositionProps.ctaDuration,
  });

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="sm" onClick={() => router.push("/app/seedance-reel")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">Edit Reel</h1>
          <p className="text-sm text-muted-foreground">Preview your reel and add optional clips at the start or end</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
        {/* Preview column */}
        <div className="flex flex-col items-center gap-3 w-full max-w-xs mx-auto lg:mx-0">
          {/* + Add intro clip */}
          <AddSlot label="Add intro clip" position="before" />

          {/* Remotion Player */}
          <div className="w-full rounded-3xl overflow-hidden border border-border/50 bg-black shadow-2xl">
            <Player
              component={SeedanceReelComposition}
              inputProps={compositionProps}
              durationInFrames={durationInFrames}
              compositionWidth={1080}
              compositionHeight={1920}
              fps={30}
              style={{ width: "100%", aspectRatio: "9/16" }}
              controls
              loop
              clickToPlay
            />
          </div>

          {/* + Add outro clip */}
          <AddSlot label="Add outro clip" position="after" />
        </div>

        {/* Controls column */}
        <div className="flex-1 w-full lg:max-w-sm space-y-4">
          <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Download reel</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Renders the final MP4 with Remotion — takes 1–3 minutes.
              </p>
            </div>
            <Button
              onClick={handleDownload}
              disabled={rendering}
              className="w-full gap-2"
            >
              {rendering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Rendering…
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download MP4
                </>
              )}
            </Button>
            {renderError && (
              <div className="flex items-start gap-2 text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{renderError}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddSlot({ label }) {
  return (
    <button className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all py-3 px-4 text-sm text-muted-foreground hover:text-primary group">
      <div className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center group-hover:bg-primary group-hover:border-primary group-hover:text-white transition-all">
        <Plus className="w-3.5 h-3.5" />
      </div>
      {label}
    </button>
  );
}
