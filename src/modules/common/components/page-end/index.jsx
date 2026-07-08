import { GUIDES } from "@/lib/guides";
import { GuideCard } from "@/modules/common/components/guide-card";

export default function PageEnd({ currentSlug }) {
  const guides = GUIDES.filter((guide) => guide.slug !== currentSlug);
  if (guides.length === 0) return null;

  return (
    <div className="mt-12 pt-8 border-t border-neutral-200">
      <h2 className="text-xl font-semibold font-heading text-neutral-900 mb-5">
        Other guides
      </h2>
      <div className="grid sm:grid-cols-3 gap-5">
        {guides.map((guide) => (
          <GuideCard key={guide.slug} {...guide} />
        ))}
      </div>
    </div>
  );
}
