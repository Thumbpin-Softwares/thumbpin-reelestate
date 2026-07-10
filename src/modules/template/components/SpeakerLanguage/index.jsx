"use client";

import { Languages } from "lucide-react";

const LANGUAGES = [
  { id: "english", label: "English" },
  { id: "hindi", label: "Hindi" },
  { id: "hinglish", label: "Hinglish" },
];

// Shared "what language should the speaker speak" picker for the Script
// step. Same three options across every template today — if a template
// ever needs a different language set, pass `languages` to override.
export function SpeakerLanguage({ value, onChange, languages = LANGUAGES }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center">
          <Languages className="w-4 h-4 text-[#c7f038]" />
        </div>
        <h3 className="text-sm font-semibold">What language do you want your speaker to speak?</h3>
      </div>

      <div className="flex gap-2 flex-wrap">
        {languages.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => onChange?.(l.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              value === l.id
                ? "bg-neutral-900 text-[#c7f038]"
                : "border border-border text-muted-foreground hover:border-neutral-400"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
