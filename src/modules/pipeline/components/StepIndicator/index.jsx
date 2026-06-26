const DEFAULT_STEPS = ["Upload & Presenter", "Script", "Generate"];

export function StepIndicator({ currentStep = 0, steps = DEFAULT_STEPS }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-neutral-100 p-2">
      {steps.map((label, idx) => {
        const active = idx === currentStep;
        const completed = idx < currentStep;
        return (
          <div
            key={idx}
            className={`flex items-center gap-2 rounded-full px-3 py-2 transition-all duration-300 ${
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
          </div>
        );
      })}
    </div>
  );
}
