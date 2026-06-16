import { CheckCircle2 } from "lucide-react";

export const StepIndicator = ({ steps, currentStep, onStepClick }) => {
  return (
    <div className="flex items-center gap-1 mb-7">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-1 flex-1 min-w-0">
          <button
            onClick={() => { if (i < currentStep) onStepClick(i); }}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full transition-all whitespace-nowrap cursor-pointer ${
              currentStep === i ? "gradient-bg text-white shadow-md" : 
              i < currentStep ? "bg-primary/10 text-primary" : "text-muted-foreground bg-muted/50"
            }`}
          >
            {i < currentStep ? <CheckCircle2 className="w-3.5 h-3.5" /> : (
              <span className="w-5 h-5 rounded-full border text-[11px] flex items-center justify-center font-bold">{i + 1}</span>
            )}
            {step}
          </button>
          {i < steps.length - 1 && (
            <div className={`h-px flex-1 min-w-3 transition-colors ${i < currentStep ? "bg-primary/40" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
};