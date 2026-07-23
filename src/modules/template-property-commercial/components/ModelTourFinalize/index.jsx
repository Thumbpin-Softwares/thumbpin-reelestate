"use client";

import { useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, ImagePlus, User2, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function Section({ icon: Icon, title, children }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#c7f038]" />
        </div>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// Review step for the residential (n8n model-tour) flow. n8n's /model-tour/script
// call already merged the form inputs, predicted avatar gender, and built the
// master prompt into one JSON blob — we just let the user read/edit that raw
// JSON here before it's sent back to n8n to actually render the video. We never
// interpret its shape (it's n8n's to define), so this is a plain JSON editor
// rather than a field-by-field form.
export function ModelTourFinalize({ images = [], selectedAvatars = [], script, onChange, onBack, onGenerate }) {
  const propertyPhotos = images.filter((img) => img.r2Url || img.url);
  const [text, setText] = useState(() => JSON.stringify(script ?? {}, null, 2));
  const [parseError, setParseError] = useState(null);

  // Re-sync the editor text when a new script arrives (e.g. re-running the
  // script step after Back), without the cascading-render effect pattern —
  // this is React's documented "adjust state during render" approach.
  const [syncedScript, setSyncedScript] = useState(script);
  if (script !== syncedScript) {
    setSyncedScript(script);
    setText(JSON.stringify(script ?? {}, null, 2));
  }

  const handleTextChange = (value) => {
    setText(value);
    try {
      const parsed = JSON.parse(value);
      setParseError(null);
      onChange?.(parsed);
    } catch (err) {
      setParseError("Invalid JSON — fix it before generating.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Section icon={ImagePlus} title="Property Photos">
        {propertyPhotos.length === 0 ? (
          <p className="text-xs text-neutral-400">No photos uploaded.</p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {propertyPhotos.map((img, idx) => (
              <div key={img.id || idx} className="aspect-square rounded-lg overflow-hidden border border-border/40">
                <img src={img.r2Url || img.url} alt={img.name} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={User2} title="Presenter / Avatar">
        {selectedAvatars.length === 0 ? (
          <p className="text-xs text-neutral-400">No presenter selected.</p>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl overflow-hidden border border-border/40 shrink-0">
              <img src={selectedAvatars[0].url} alt={selectedAvatars[0].name} className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-900">{selectedAvatars[0].name || "Custom presenter"}</p>
              <p className="text-xs text-neutral-500">
                {selectedAvatars.length} angle{selectedAvatars.length !== 1 ? "s" : ""} selected
              </p>
            </div>
          </div>
        )}
      </Section>

      <Section icon={FileJson} title="Script">
        <p className="text-xs text-neutral-400 -mt-1">
          Generated from your inputs. Edit any field below before generating — it&apos;s sent back exactly as written.
        </p>
        <Textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          spellCheck={false}
          className="font-mono text-xs min-h-80 resize-y bg-card/50"
        />
        {parseError && (
          <p className="text-xs text-red-500 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> {parseError}
          </p>
        )}
      </Section>

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="cursor-pointer">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>

        <Button
          onClick={onGenerate}
          disabled={!!parseError}
          className="bg-neutral-900 text-[#c7f038] hover:opacity-90 hover:bg-neutral-900 shadow-lg gap-2 px-6 disabled:opacity-50"
        >
          Generate Video
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
