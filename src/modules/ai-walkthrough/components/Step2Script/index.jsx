import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Loader2, PenLine, Sparkles, RotateCcw, ArrowRight, ArrowLeft, Video, Zap, Volume2, VolumeX } from "lucide-react";
import { LANGUAGES, TONES, MAX_SCRIPT, CLOSING_HOOK_OPTIONS } from "@/utils/constants";

export const Step2Script = ({ compositesHook, scriptHook, videoHook, onBack, onGenerate, isValid }) => {
  const {
    selectedCompositeArray,
    batchSize,
  } = compositesHook;

  const {
    script,
    setScript,
    language,
    setLanguage,
    scriptTone,
    setScriptTone,
    allowEmotionTags,
    setAllowEmotionTags,
    generatingScript,
    structuredScripts,
    setStructuredScripts,
    setBatchScripts,
    manualScripts,
    useManualForIndex,
    closingHook,
    setClosingHook,
    customClosingHook,
    setCustomClosingHook,
    toggleManualForIndex,
    updateManualScript,
    getFinalScripts,
    handleGenerateScript,
    retryScriptGeneration,
    regenerateSingleScript,
  } = scriptHook;

  const {
    generating,
    videoEngine,
    setVideoEngine,
    seedanceDuration,
    setSeedanceDuration,
    seedanceResolution,
    setSeedanceResolution,
    seedanceAudio,
    setSeedanceAudio,
  } = videoHook;

  const SEEDANCE_DURATIONS = ["5", "8", "10", "12"];
  const SEEDANCE_RESOLUTIONS = ["480p", "720p", "1080p"];

  const N = selectedCompositeArray.length;
  const hasScripts = structuredScripts.length > 0;
  const canGenerateFinalVideos = scriptHook.isStep2Valid(N);

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Script & Generate</span>
        <Badge className="gradient-bg text-white border-0 text-[10px]">
          {selectedCompositeArray.length} Location Photos
        </Badge>
      </div>

      {/* Selected composites preview strip */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Reference Material ({selectedCompositeArray.length} location photos)</Label>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {selectedCompositeArray.map((comp, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-border/50 p-1.5 bg-card/50 shrink-0">
              <img src={comp.url} alt={comp.title} className="w-10 h-14 rounded-lg object-cover border border-border" />
              <div>
                <p className="text-[10px] font-semibold">{comp.title}</p>
                <p className="text-[9px] text-muted-foreground">{comp.avatarAngle || `Angle ${i + 1}`}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Language */}
      <div className="flex gap-2 flex-wrap">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.id}
            onClick={() => setLanguage(lang.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              language === lang.id ? "gradient-bg text-white" : "border border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            {lang.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground -mt-1">
        Indian languages supported: Hindi, Hinglish, Marathi, Tamil, Telugu, Kannada, Malayalam, Bengali, Gujarati, Punjabi, Urdu, and Odia.
      </p>

      {/* Tone */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Script Tone</Label>
        <div className="flex gap-2 flex-wrap">
          {TONES.map((tone) => (
            <button
              key={tone.id}
              onClick={() => setScriptTone(tone.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                scriptTone === tone.id ? "gradient-bg text-white" : "border border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {tone.label}
            </button>
          ))}
        </div>
      </div>

      {/* Emotion tags toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setAllowEmotionTags((v) => !v)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
            allowEmotionTags ? "bg-primary" : "bg-muted-foreground/30"
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            allowEmotionTags ? "translate-x-4" : "translate-x-0.5"
          }`} />
        </button>
        <span className="text-xs text-muted-foreground">
          Allow emotion tags like <code className="text-primary bg-primary/10 px-1 rounded">{`{{happy}}`}</code> in script
        </span>
      </div>

      {/* ── Video Engine Selector ────────────────────────────────────── */}
      <div className="space-y-3">
        <Label className="text-xs">Video Generation Engine</Label>
        <div className="grid grid-cols-2 gap-3">
          {/* Veo card */}
          <button
            onClick={() => setVideoEngine("veo")}
            className={`group relative flex flex-col gap-1.5 rounded-xl border-2 p-3 text-left transition-all cursor-pointer ${
              videoEngine === "veo"
                ? "border-primary bg-primary/8 shadow-sm"
                : "border-border bg-card/50 hover:border-primary/40"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${
                videoEngine === "veo" ? "gradient-bg text-white" : "bg-muted text-muted-foreground"
              }`}>
                🎬
              </div>
              <span className="text-xs font-semibold">Google Veo</span>
              {videoEngine === "veo" && (
                <span className="ml-auto text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">ACTIVE</span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Premium cinematic quality. Best for luxury listings.
            </p>
            <p className="text-[9px] text-muted-foreground/60">~2–3 min per clip</p>
          </button>

          {/* Seedance card */}
          <button
            onClick={() => setVideoEngine("seedance")}
            className={`group relative flex flex-col gap-1.5 rounded-xl border-2 p-3 text-left transition-all cursor-pointer ${
              videoEngine === "seedance"
                ? "border-violet-500 bg-violet-500/8 shadow-sm"
                : "border-border bg-card/50 hover:border-violet-400/40"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                videoEngine === "seedance" ? "bg-violet-500 text-white" : "bg-muted text-muted-foreground"
              }`}>
                <Zap className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold">Seedance 1.5 Pro</span>
              {videoEngine === "seedance" && (
                <span className="ml-auto text-[9px] font-bold text-violet-600 bg-violet-500/15 px-1.5 py-0.5 rounded-full">ACTIVE</span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Faster renders + native AI audio. Powered by fal.ai.
            </p>
            <p className="text-[9px] text-muted-foreground/60">~30–60s per clip</p>
          </button>
        </div>

        {/* Seedance-specific settings */}
        {videoEngine === "seedance" && (
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Duration */}
            <div className="space-y-1.5">
              <Label className="text-[10px] text-violet-700 dark:text-violet-400 font-semibold">Clip Duration</Label>
              <div className="flex gap-2">
                {SEEDANCE_DURATIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setSeedanceDuration(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      seedanceDuration === d
                        ? "bg-violet-500 text-white shadow-sm"
                        : "border border-violet-300/30 text-muted-foreground hover:border-violet-400/50"
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution */}
            <div className="space-y-1.5">
              <Label className="text-[10px] text-violet-700 dark:text-violet-400 font-semibold">Resolution</Label>
              <div className="flex gap-2">
                {SEEDANCE_RESOLUTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setSeedanceResolution(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      seedanceResolution === r
                        ? "bg-violet-500 text-white shadow-sm"
                        : "border border-violet-300/30 text-muted-foreground hover:border-violet-400/50"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Audio toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-violet-700 dark:text-violet-400">Native AI Audio</p>
                <p className="text-[9px] text-muted-foreground">Seedance generates speech from your script</p>
              </div>
              <button
                onClick={() => setSeedanceAudio((v) => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                  seedanceAudio ? "bg-violet-500" : "bg-muted-foreground/30"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  seedanceAudio ? "translate-x-4" : "translate-x-0.5"
                }`} />
              </button>
            </div>

            <p className="text-[9px] text-violet-600/70 dark:text-violet-400/70">
              ✨ Voice characteristics from Step 2 are included in the generation prompt for consistent delivery.
            </p>
          </div>
        )}
      </div>

      {/* User Intent Input (Optional) */}
      <div className="space-y-2">
        <Label className="text-xs">
          Anything specific you want in the scripts? <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          value={script}
          onChange={(e) => setScript(e.target.value.slice(0, MAX_SCRIPT))}
          placeholder="e.g. 'mention the terrace view' or 'highlight the modern kitchen' — AI will incorporate this into every location prompt"
          className="min-h-20 resize-none text-sm"
          maxLength={MAX_SCRIPT}
        />
      </div>

      {/* Closing Hook Selection (applied to final clip) */}
      <div className="space-y-2">
        <Label className="text-xs">
          Final clip closing hook <span className="text-muted-foreground font-normal">(optional — applied to last video)</span>
        </Label>
        <div className="flex gap-2 flex-wrap">
          {CLOSING_HOOK_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setClosingHook(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                closingHook === opt.id
                  ? "gradient-bg text-white"
                  : "border border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <Textarea
          value={customClosingHook || ""}
          onChange={(e) => setCustomClosingHook(e.target.value.slice(0, 180))}
          placeholder="Add your own custom final hook instruction (optional), e.g. 'end with keys handover and warm smile'"
          className="min-h-16 resize-none text-xs"
          maxLength={180}
        />
        <p className="text-[10px] text-muted-foreground">
          The chosen hook is used only in the final clip to make the ending memorable.
        </p>
      </div>

      {/* Generate Scripts Button */}
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleGenerateScript} 
        disabled={generatingScript} 
        className={`w-full cursor-pointer text-sm h-11 transition-all ${generatingScript ? 'bg-primary/5' : 'hover:bg-primary/5 hover:border-primary/50'}`}
      >
        {generatingScript ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin text-primary" /> Crafting {N} Location Script{N > 1 ? 's' : ''} with Continuation...</>
        ) : (
          <><Sparkles className="w-4 h-4 mr-2 text-primary" /> ✨ Generate {N} Script{N > 1 ? 's' : ''} (1 per Composite){N > 1 ? ' with Transitions' : ''}</>
        )}
      </Button>

      {/* Loading Skeleton if generating and no scripts yet */}
      {generatingScript && structuredScripts.length === 0 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-dashed border-border/60 p-8 flex flex-col items-center justify-center gap-3 bg-muted/20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <div className="space-y-1 text-center">
              <p className="text-sm font-medium">AI is writing {N} script{N > 1 ? 's' : ''} with continuation...</p>
              <p className="text-[10px] text-muted-foreground">Creating a seamless walkthrough narrative across {N} clip{N > 1 ? 's' : ''}</p>
            </div>
          </div>
          {Array.from({ length: N }).map((_, i) => (
            <div key={i} className="h-30 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty State / Not Generated yet */}
      {!generatingScript && !hasScripts && (
        <div className="rounded-xl border-2 border-dashed border-border/40 p-10 flex flex-col items-center justify-center gap-4 bg-muted/10">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold">No scripts generated yet</p>
            <p className="text-xs text-muted-foreground max-w-60 mx-auto">
              {N > 1 
                ? `Generate ${N} scripts — one per composite — with smooth avatar transitions between clips.`
                : "Click the button above to generate a professional script for your video."
              }
            </p>
          </div>
        </div>
      )}

      {/* Continuation Flow Info */}
      {hasScripts && N > 1 && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 flex gap-2.5">
          <span className="text-base shrink-0">🎬</span>
          <div className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Continuation Mode:</strong> Each clip flows into the next — avatar exits right at the end and enters from the left in the next clip. Same voice, same outfit, seamless walkthrough.
          </div>
        </div>
      )}

      {/* Per-Composite Script Cards */}
      {(hasScripts || (generatingScript && structuredScripts.length > 0)) && structuredScripts.map((clipScript, i) => {
        const isManual = useManualForIndex[i];
        const composite = selectedCompositeArray[i];
        const isFirst = i === 0;
        const isLast = i === N - 1;
        const positionLabel = N === 1 ? "Single Clip" : isFirst ? "Opening" : isLast ? "Closing" : `Middle (${i}/${N - 1})`;
        const transitionInfo = N > 1 
          ? isFirst 
            ? "→ Avatar exits right at end" 
            : isLast 
            ? "← Avatar enters from left" 
            : "← Enters left → Exits right"
          : null;

        return (
          <div key={i} className={`rounded-xl border transition-all overflow-hidden ${
            isFirst ? 'border-primary/30 bg-primary/5' : isLast ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/50 bg-card/40'
          }`}>
            {/* Header */}
            <div className={`flex items-center gap-2 px-3 py-2 border-b ${
              isFirst ? 'border-primary/20 bg-primary/10' : isLast ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-border/30 bg-card/60'
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                isFirst ? 'gradient-bg text-white' : isLast ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
              }`}>
                {i + 1}
              </div>
              <Badge variant={isFirst ? "default" : "outline"} className={`text-[10px] ${isFirst ? 'bg-primary text-white border-0' : ''}`}>
                {positionLabel}
              </Badge>
              {transitionInfo && (
                <span className="text-[9px] text-violet-600 dark:text-violet-400 flex items-center gap-0.5">
                  {transitionInfo}
                </span>
              )}
              {clipScript && (
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {(clipScript.fullScript || "").split(/\s+/).length} words
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => regenerateSingleScript?.(i)}
                disabled={generatingScript}
                className="h-6 px-2 text-[10px] cursor-pointer hover:bg-primary/20"
              >
                <RotateCcw className="w-3 h-3 mr-1" /> Regen
              </Button>
            </div>

            {/* Composite Preview */}
            {composite && (
              <div className="px-3 pt-2 flex items-center gap-2">
                <img src={composite.url} alt={composite.title} className="w-8 h-11 rounded-lg object-cover border border-border" />
                <p className="text-[10px] text-muted-foreground">{composite.title || `Composite ${i + 1}`}</p>
              </div>
            )}

            {/* Script Mode Toggle: AI vs Manual */}
            <div className="px-3 pt-2 flex items-center gap-2">
              <button
                onClick={() => toggleManualForIndex(i)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                  !isManual ? 'gradient-bg text-white' : 'border border-border text-muted-foreground hover:border-primary/40'
                }`}
              >
                <Sparkles className="w-2.5 h-2.5" /> AI Script
              </button>
              <button
                onClick={() => toggleManualForIndex(i)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                  isManual ? 'gradient-bg text-white' : 'border border-border text-muted-foreground hover:border-primary/40'
                }`}
              >
                <PenLine className="w-2.5 h-2.5" /> Manual Script
              </button>
              {isManual && (
                <span className="text-[9px] text-amber-600 dark:text-amber-400 ml-auto">✏️ Manual has priority</span>
              )}
            </div>

            {/* Script Textarea */}
            <div className="p-3">
              {isManual ? (
                <>
                  <Textarea
                    value={manualScripts[i] || ""}
                    onChange={(e) => updateManualScript(i, e.target.value)}
                    className="min-h-25 resize-none text-sm bg-background border-amber-500/20 focus-visible:ring-amber-500/30"
                    placeholder={`Write your own script for clip ${i + 1}... This will be used as the Veo prompt directly.`}
                  />
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                    <PenLine className="w-2.5 h-2.5" /> Your manual script will be used for this clip (preferred over AI)
                  </p>
                </>
              ) : (
                <>
                  <Textarea
                    value={clipScript?.fullScript || ""}
                    onChange={(e) => {
                      setStructuredScripts((prev) => {
                        const updated = [...prev];
                        if (updated[i]) {
                          updated[i] = { ...updated[i], fullScript: e.target.value };
                        }
                        return updated;
                      });
                      setBatchScripts((bs) => {
                        const b = [...bs];
                        b[i] = e.target.value;
                        return b;
                      });
                    }}
                    className={`min-h-25 resize-none text-sm bg-background ${
                      isFirst ? 'border-primary/10 focus-visible:ring-primary/30' : 'border-border/50 focus-visible:ring-primary/20'
                    }`}
                    placeholder={`AI-generated script for clip ${i + 1}...`}
                  />
                  <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> {isFirst ? "Opening hook — grab attention instantly" : isLast ? "Closing clip — end with confidence" : "Walkthrough continues naturally from previous clip"}
                  </p>
                </>
              )}
            </div>
          </div>
        );
      })}

      {/* Actions */}
      <div className="flex justify-between items-center pt-4 border-t border-border/50">
        <Button variant="outline" onClick={onBack} className="cursor-pointer">
          Back
        </Button>
        <div className="flex gap-3">
          {hasScripts && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={retryScriptGeneration} 
              className="cursor-pointer text-xs gap-1.5 h-10 px-4"
              disabled={generatingScript}
            >
              <RotateCcw className={`w-3.5 h-3.5 ${generatingScript ? 'animate-spin' : ''}`} /> 
              Regenerate All
            </Button>
          )}
          <Button 
            onClick={onGenerate} 
            disabled={!canGenerateFinalVideos || generating || generatingScript} 
            className={`text-white shadow-lg cursor-pointer px-10 h-10 font-semibold transition-all ${
              videoEngine === "seedance"
                ? "bg-violet-600 hover:bg-violet-700"
                : "gradient-bg"
            }`}
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating {N} Video{N > 1 ? 's' : ''}...</>
            ) : videoEngine === "seedance" ? (
              <><Zap className="w-4 h-4 mr-2" /> Generate {N} Video{N > 1 ? 's' : ''} via Seedance</>
            ) : (
              <><Video className="w-4 h-4 mr-2" /> Generate {N} Video{N > 1 ? 's' : ''} via Veo</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};