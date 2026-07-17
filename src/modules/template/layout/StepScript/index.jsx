"use client";

import { ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteForm, isSiteFormValid } from "@/modules/template/components/SiteForm";

// Step 1 for every template's pipeline: the site-details form + speaker
// language. A template just supplies its own `values`/`onChange` state;
// validation defaults to the shared required-field rules (SiteForm's
// required fields, plus a language pick) but can be overridden via
// `isValid` if a template ever needs stricter checks. `onNext` may be async
// (e.g. it calls the script-generation API) — pass `loading` while it's in
// flight to disable the button and swap its label.
export function StepScript({
  values,
  onChange,
  onBack,
  onNext,
  isValid,
  loading = false,
  continueLabel = "Continue to Finalize",
  loadingLabel = "Generating...",
}) {
  const valid = isValid ?? (isSiteFormValid(values) && !!values.language);

  return (
    <div className="space-y-5 animate-fade-in">
      <SiteForm values={values} onChange={onChange} />

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack} disabled={loading} className="cursor-pointer">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>

        <Button
          onClick={onNext}
          disabled={!valid || loading}
          className="bg-neutral-900 text-[#c7f038] hover:opacity-90 hover:bg-neutral-900 disabled:opacity-70 shadow-lg gap-2 px-6"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> {loadingLabel}
            </>
          ) : (
            <>
              {continueLabel}
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
