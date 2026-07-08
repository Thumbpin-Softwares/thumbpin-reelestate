import { GUIDES } from "@/lib/guides";
import { GuideCard } from "@/modules/common/components/guide-card";

export default function HelpCenterPage() {
  return (
    <div className="max-w-6xl mx-auto pt-12 px-4">
      <div className="flex flex-col items-start py-12 gap-4 border-b border-neutral-200 text-left">
        <span className="bg-[#c7f038] text-neutral-900 font-medium px-4 py-1.5 rounded-full text-sm">
          The FAQs
        </span>
        <h1 className="text-5xl sm:text-6xl font-light font-heading tracking-tight">Help Center</h1>
        <span className="text-lg text-neutral-500">Everything you need to know about your product</span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 py-12 text-left">
        {GUIDES.map((guide) => (
          <GuideCard key={guide.slug} {...guide} />
        ))}
      </div>
    </div>
  );
}
