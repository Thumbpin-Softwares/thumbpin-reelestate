import { GUIDES } from "@/lib/guides";
import { GuideCard } from "@/modules/common/components/guide-card";

export default function HelpCenterPage() {
  return (
    <div className="relative max-w-7xl mx-auto px-4 py-12">
      <div className="relative overflow-hidden p-10 backdrop-blur-xl flex flex-col items-start gap-4 text-left">
        <span className="rounded-full bg-[#c7f038] px-4 py-1.5 text-sm font-medium text-neutral-900 shadow-sm">
          The FAQs
        </span>
        <h1 className="text-5xl sm:text-6xl font-light font-heading tracking-tight text-neutral-900">Help Center</h1>
        <span className="max-w-2xl text-lg text-neutral-600">Everything you need to know about your product</span>
      </div>

      <div className="grid gap-6 py-12 text-left sm:grid-cols-2 lg:grid-cols-3">
        {GUIDES.map((guide) => (
          <GuideCard key={guide.slug} {...guide} />
        ))}
      </div>
    </div>
  );
}
