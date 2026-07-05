import Link from "next/link";
import { BookOpen, MessageCircle, MessageSquarePlus } from "lucide-react";

const cards = [
  {
    title: "Chat with us",
    description: "Reach the team directly for account or billing questions.",
    href: "mailto:support@thumbpin.ai",
    icon: MessageCircle,
  },
  {
    title: "Help Center",
    description: "Browse guides and FAQs for common questions about the product.",
    href: "/app/help",
    icon: BookOpen,
  },
  {
    title: "Send feedback",
    description: "Tell us what's working, what's not, and what you'd like to see next.",
    href: "mailto:feedback@thumbpin.ai",
    icon: MessageSquarePlus,
  },
];

export default function SupportPage() {
  return (
    <div>
      <div className="flex flex-col items-start py-12 gap-4 border-b border-neutral-200 text-left">
        <span className="bg-[#c7f038] text-neutral-900 font-medium px-4 py-1.5 rounded-full text-sm">
          Support
        </span>
        <h1 className="text-5xl sm:text-6xl font-bold font-heading tracking-tight">
          How can we help?
        </h1>
        <span className="text-lg text-neutral-500">
          Get in touch, or find your answer in the Help Center.
        </span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 py-12 text-left">
        {cards.map(({ title, description, href, icon: Icon }) => (
          <Link
            key={title}
            href={href}
            className="group flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-all hover:border-[#c7f038] hover:shadow-md"
          >
            <div className="w-12 h-12 rounded-xl bg-neutral-900 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-[#c7f038]" />
            </div>

            <div className="flex-1 space-y-1.5">
              <h2 className="text-base font-semibold">{title}</h2>
              <p className="text-sm text-neutral-500 leading-relaxed">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
