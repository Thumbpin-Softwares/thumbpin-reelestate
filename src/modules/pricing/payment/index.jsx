import Link from "next/link";
import { Sparkle, Check } from "lucide-react";

const Plans = [
  {
    title: "Creator",
    tag: "normal",
    price: "Rs. 16,999",
    type: "per year",
    tax: "(+GST Applicable)",
    paymentLink: "",
    buttonName: "Go Creator",
    description: "6,000 Credits",
    points: [
      "No watermark",
      "Unlimited Auto Subtitles",
      "Full audio & video catalog",
      "Gen-AI Studio videos with Credits",
    ],
  },
  {
    title: "Pro",
    tag: "Recommended",
    price: "Rs. 24,999",
    type: "per year",
    tax: "(+GST Applicable)",
    paymentLink: "",
    buttonName: "Go Pro",
    description: "30,000 Credits",
    points: [
      "Everything in Creator +",
      "Multiple Brand Kits",
      "Translate to 50+ Languages",
      "Up to 144 hr/yr of AI voice",
      "5x more Gen-AI Studio videos than Creator",
    ],
  },
  {
    title: "Studio",
    tag: "normal",
    price: "Rs. 49,999",
    type: "per year",
    tax: "(+GST Applicable)",
    paymentLink: "",
    buttonName: "Go Studio",
    description: "180,000 Credits",
    points: [
      "Everything in Pro +",
      "Custom Templates",
      "12 hr/yr of Translations",
      "Up to 960 hr/yr of AI voice",
      "6x more Gen-AI Studio videos than Pro",
    ],
  },
  {
    title: "Enterprise",
    tag: "normal",
    price: "",
    type: "Custom Pricing",
    tax: "(+GST Applicable)",
    paymentLink: "",
    buttonName: "Contact Sales",
    description: "Custom AI Credits",
    points: [
      "Custom AI Credits",
      "Centrally manage teams and data",
      "Review mode for videos",
      "Privacy controls",
      "Customer success",
    ],
  },
];

export default function Payment() {
  return (
    <main className="py-12 px-4 sm:px-6 overflow-x-hidden">
      <div className="py-4 flex gap-2 sm:gap-4 flex-col items-center justify-center text-center">
        <h1 className="text-4xl font-semibold sm:text-5xl lg:text-6xl leading-tight">
          Great videos start with a plan
        </h1>
        <span className="text-sm sm:text-base text-neutral-600 flex flex-wrap items-center justify-center gap-1">
          <Link className="underline" href="/dashboard">
            Start for free,
          </Link>
          upgrade to get powerful features.
        </span>
      </div>

      <div className="flex flex-wrap justify-center gap-4 py-8 sm:py-12">
        {Plans.map((items, index) => (
          <div key={index} className="relative group w-full max-w-sm sm:w-72">
            {/* Soft Glow */}
            <div className="absolute inset-x-6 -bottom-6 h-10 rounded-full bg-black/10 blur-2xl opacity-60 transition-all duration-300 group-hover:opacity-100 group-hover:blur-3xl group-hover:-bottom-7" />

            {/* Card */}
            <div
              className={`relative flex flex-col w-full rounded-3xl bg-white p-6
        transition-all duration-300
        hover:-translate-y-2
        hover:shadow-[0_20px_40px_rgba(0,0,0,0.08),0_40px_80px_rgba(0,0,0,0.12)]
        ${
          items.tag === "Recommended"
            ? "ring-1 ring-[#c7f038]/40 shadow-[0_12px_30px_rgba(199,240,56,0.18),0_30px_80px_rgba(0,0,0,0.10)]"
            : ""
        }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold tracking-tight">
                  {items.title}
                </h2>

                {items.tag === "Recommended" && (
                  <span className="rounded-full bg-[#c7f038] px-4 py-1 text-xs font-medium text-black">
                    {items.tag}
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="py-6">
                <div className="flex items-end gap-1">
                  {items.price && (
                    <span className="text-2xl font-bold tracking-tight">
                      {items.price}
                    </span>
                  )}

                  {items.type && (
                    <span className="pb-1 text-sm text-neutral-500">
                      {items.type}
                    </span>
                  )}
                </div>

                {items.tax && (
                  <p className="mt-1 text-xs text-neutral-500">{items.tax}</p>
                )}
              </div>

              {/* CTA */}
              <Link
                href={items.paymentLink}
                className="rounded-full bg-black py-3 text-center text-sm font-medium text-white transition-all duration-300 hover:scale-[1.03] hover:bg-neutral-800 active:scale-100"
              >
                {items.buttonName}
              </Link>

              {/* Divider */}
              <div className="my-6 h-px bg-neutral-200" />

              {/* Description */}
              <div className="flex items-start gap-2">
                <Sparkle
                  size={18}
                  className="mt-0.5 shrink-0 text-neutral-700"
                />

                <p className="text-sm leading-6 text-neutral-600">
                  {items.description}
                </p>
              </div>

              {/* Features */}
              <ul className="mt-6 space-y-4">
                {items.points.map((subitem, subindex) => (
                  <li key={subindex} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100">
                      <Check size={12} />
                    </div>

                    <span className="text-sm leading-6 text-neutral-600">
                      {subitem}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
