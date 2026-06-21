"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Player } from "@remotion/player";
import { Plus, ArrowLeft, Loader2, Download, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SeedanceReelComposition } from "@/lib/remotion/SeedanceReelComposition";
import { calcDurationInFrames, clampBrollClips } from "@/lib/remotion/duration";

export default function SeedanceReelEditPage() {
  const router = useRouter();
  const [compositionProps, setCompositionProps] = useState(null);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState(null);

  // Intro/outro title cards are NOT baked in by default — user opts in and
  // customizes them here on the edit page.
  const [showIntro, setShowIntro] = useState(false);
  const [showOutro, setShowOutro] = useState(false);
  const [introTitle, setIntroTitle] = useState("Luxury");
  const [introSubtitle, setIntroSubtitle] = useState("Living");
  const [introTagline, setIntroTagline] = useState("Where Every Detail Matters");
  const [outroCtaText, setOutroCtaText] = useState("");
  const [outroBrandText, setOutroBrandText] = useState("thumbpin.ai");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("seedance_composition");
      if (raw) {
        const parsed = JSON.parse(raw);
        setCompositionProps(parsed);
        setOutroCtaText(parsed.ctaText || "");
      }
    } catch (_) {}
  }, []);

  const handleDownload = async () => {
    setRendering(true);
    setRenderError(null);
    try {
      const renderProps = {
        ...compositionProps,
        brollClips: clampBrollClips({
          avatarDuration: compositionProps.avatarDuration,
          brollClips:     compositionProps.brollClips,
          ctaDuration:    compositionProps.ctaDuration,
          showIntro,
          showOutro,
        }),
        showIntro,
        showOutro,
        introTitle,
        introSubtitle,
        introTagline,
        outroBrandText,
        ctaText: outroCtaText,
      };
      const res = await fetch("/api/seedance-reel/render-remotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(renderProps),
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

  const clampedBrollClips = clampBrollClips({
    avatarDuration: compositionProps.avatarDuration,
    brollClips:     compositionProps.brollClips,
    ctaDuration:    compositionProps.ctaDuration,
    showIntro,
    showOutro,
  });

  const previewProps = {
    ...compositionProps,
    brollClips: clampedBrollClips,
    showIntro,
    showOutro,
    introTitle,
    introSubtitle,
    introTagline,
    outroBrandText,
    ctaText: outroCtaText,
  };

  const durationInFrames = calcDurationInFrames({
    avatarDuration: compositionProps.avatarDuration,
    brollClips:     clampedBrollClips,
    ctaDuration:    compositionProps.ctaDuration,
    showIntro,
    showOutro,
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
              inputProps={previewProps}
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
          {/* Intro title card */}
          <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Intro title card</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Optional white title card before the reel starts.
                </p>
              </div>
              <Switch checked={showIntro} onCheckedChange={setShowIntro} />
            </div>
            {showIntro && (
              <div className="space-y-2.5 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="intro-title" className="text-xs">Title</Label>
                  <Input id="intro-title" value={introTitle} onChange={(e) => setIntroTitle(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="intro-subtitle" className="text-xs">Subtitle</Label>
                  <Input id="intro-subtitle" value={introSubtitle} onChange={(e) => setIntroSubtitle(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="intro-tagline" className="text-xs">Tagline</Label>
                  <Input id="intro-tagline" value={introTagline} onChange={(e) => setIntroTagline(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* Outro title card */}
          <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Outro title card</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Optional white CTA card after the reel ends.
                </p>
              </div>
              <Switch checked={showOutro} onCheckedChange={setShowOutro} />
            </div>
            {showOutro && (
              <div className="space-y-2.5 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="outro-cta" className="text-xs">CTA text</Label>
                  <Textarea id="outro-cta" value={outroCtaText} onChange={(e) => setOutroCtaText(e.target.value)} rows={3} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="outro-brand" className="text-xs">Brand text</Label>
                  <Input id="outro-brand" value={outroBrandText} onChange={(e) => setOutroBrandText(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* Download */}
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
