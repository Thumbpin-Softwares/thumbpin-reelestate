"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Player } from "@remotion/player";
import { Plus, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeedanceReelComposition } from "@/lib/remotion/SeedanceReelComposition";
import { calcDurationInFrames } from "@/lib/remotion/duration";

export default function SeedanceReelEditPage() {
  const router = useRouter();
  const [compositionProps, setCompositionProps] = useState(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("seedance_composition");
      if (raw) setCompositionProps(JSON.parse(raw));
    } catch (_) {}
  }, []);

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

        {/* Controls column — you'll specify what goes here */}
        <div className="flex-1 w-full lg:max-w-sm space-y-4">
          {/* placeholder — fill in on next step */}
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
