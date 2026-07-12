"use client";

import { Lock } from "lucide-react";
import { StepIndicator } from "@/modules/pipeline/components/StepIndicator";

export function TemplateComingSoon({ template }) {
  return (
    <div className="h-full max-w-2xl mx-auto px-4 flex flex-col items-center justify-center gap-6 text-center animate-fade-in">
      {template.steps?.length > 0 && (
        <StepIndicator currentStep={0} steps={template.steps} maxStep={-1} />
      )}

      <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center">
        <Lock className="w-6 h-6 text-neutral-400" />
      </div>

      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold text-neutral-900">{template.title}</h1>
        <p className="text-sm text-neutral-500 max-w-sm">
          {template.description || "This template is on its way. Check back soon."}
        </p>
      </div>
    </div>
  );
}
