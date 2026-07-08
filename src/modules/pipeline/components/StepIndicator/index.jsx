const DEFAULT_STEPS = ["Add Assets", "Script", "Finalize"];

export function StepIndicator({ currentStep = 0, steps = DEFAULT_STEPS, maxStep, onStepClick = null }) {
  // `maxStep` is the furthest step the user has already filled in — lets them
  // hop forward to it again, not just back. Callers that don't pass it keep
  // the original back-only behavior (only steps strictly before currentStep).
  const reachable = maxStep ?? currentStep - 1;
  return (
    <div className="flex items-center gap-2 rounded-full bg-neutral-100 p-2">
      {steps.map((label, idx) => {
        const active = idx === currentStep;
        const completed = idx < currentStep;
        const clickable = !!onStepClick && idx <= reachable && idx !== currentStep;
        return (
          <button
            key={idx}
            type="button"
            disabled={!clickable}
            onClick={() => clickable && onStepClick(idx)}
            className={`flex items-center gap-2 rounded-full px-3 py-2 transition-all duration-300 ${
              clickable ? "cursor-pointer hover:opacity-80" : "cursor-default"
            } ${
              active
                ? "bg-[#c7f038] text-black"
                : completed
                ? "bg-black text-white"
                : "bg-transparent text-neutral-500"
            }`}
          >
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                active
                  ? "bg-black text-white"
                  : completed
                  ? "bg-white text-black"
                  : "bg-neutral-200"
              }`}
            >
              {completed ? "✓" : idx + 1}
            </div>
            <span className="hidden sm:block text-xs font-medium">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
