"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TemplateCard from "@/modules/dashboard/components/template-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Video, Pencil, Share2 } from "lucide-react";
import { Search } from "lucide-react";

const REAL_ESTATE_TEMPLATES = [
  {
    title: "Model exiting a luxury vehicle",
    href: "/app/seedance-reel",
    video: "https://content.thumbpin.in/templates/modelLuxuryVehicle.mp4",
    tag: "Popular",
  },
  {
    title: "Model doing Home Tour of the property",
    href: "/app/home-tour",
    video: "https://content.thumbpin.in/web-assets/hometour-final-1782134969657-1782134969657-3ac17d57.mp4",
    tag: "Popular"
  },
  {
    title: "Action-Packed Property Reveal",
    href: "/app/action-reel",
    video: "https://content.thumbpin.in/users/69e20794114a93d739a79321/videos/areel-final-1782433444937-1782433444937-38a76a27.mp4",
    tag: "New",
  },
  {
    title: "Nosy Padosi Comedy Reel",
    href: "/app/comedy-reel",
    video: null,
    tag: "New",
  },
];

export default function DashboardPage() {
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const filteredTemplates = REAL_ESTATE_TEMPLATES.filter((t) =>
    t.title.toLowerCase().includes(query.toLowerCase()),
  );

  const actions = [
    {
      title: "AI Reel Generator",
      description:
        "Build stunning real estate reels that grab users' attention.",
      href: null,
      icon: Video,
      color: "bg-amber-50 text-amber-600",
    },
    {
      title: "Social Media Posts",
      description: "Generate ready-to-post social media creatives",
      href: null,
      icon: Share2,
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      title: "Edit Your Reels",
      description: "Fine-tune and download your generated reels",
      href: "/app/edit",
      icon: Pencil,
      color: "bg-emerald-50 text-emerald-600",
    },
  ];

  return (
    <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center bg-[#fafbfc]">
      {/* Minimalism Actions */}
      <section className="w-full max-w-6xl grid sm:grid-cols-3 sm:pt-0 pt-4 gap-4 px-4">
        {actions.map((action) => {
          const Icon = action.icon;
          const isComingSoon = action.title === "Social Media Posts";

          const content = (
            <div
              className={`relative flex flex-row sm:flex-col bg-white items-center justify-between sm:justify-center p-4 sm:p-6 sm:h-48 gap-4 sm:space-y-4 rounded-3xl border border-neutral-200 transition-all duration-300 ${
                isComingSoon
                  ? "cursor-not-allowed"
                  : "hover:border-border/40 hover:bg-white hover:shadow-xl"
              }`}
            >
              <div className="order-1 sm:order-2 text-left sm:text-center flex flex-col gap-1 sm:gap-2">
                <h3 className="font-semibold">{action.title}</h3>
                <p className="text-sm text-neutral-500">{action.description}</p>
              </div>

              <div className={`order-2 sm:order-1 shrink-0 w-12 h-12 rounded-3xl flex items-center justify-center ${action.color} ${!isComingSoon && "group-hover:scale-110 transition-transform"}`}>
                <Icon className="w-6 h-6" />
              </div>

              {isComingSoon && (
                <div className="absolute top-3 right-3 bottom-auto sm:pt-5 left-auto sm:inset-0 sm:flex sm:items-center sm:justify-center">
                  <span className="bg-[#c7f038] text-black text-[10px] sm:text-xs font-bold uppercase tracking-widest px-8 py-1 rounded-full shadow-lg">
                    Coming Soon
                  </span>
                </div>
              )}
            </div>
          );

          if (isComingSoon) return <div key={action.title}>{content}</div>;

          if (action.title === "AI Reel Generator") {
            return (
              <button
                key={action.title}
                className="group text-left w-full"
                onClick={() => setTemplateModalOpen(true)}
              >
                {content}
              </button>
            );
          }

          return (
            <Link key={action.href} href={action.href} className="group">
              {content}
            </Link>
          );
        })}
      </section>

      {/* Real Estate Template Modal */}
      <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
        <DialogContent
          className="max-w-6xl! w-[95vw] h-[90vh] flex flex-col rounded-3xl p-0 gap-0 overflow-hidden"
          onWheel={(e) => e.stopPropagation()}
        >
          {/* HEADER */}
          <DialogHeader className="px-8 py-6 border-b shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-2xl font-bold">
                  Select a Template
                </DialogTitle>
                <p className="text-sm text-neutral-500">
                  Hover to preview, Click to get started
                </p>
              </div>

              {/* COUNT */}
              <span className="hidden md:flex bg-[#c7f038] px-4 py-2 rounded-full text-xs font-bold uppercase">
                {REAL_ESTATE_TEMPLATES.filter(t => !t.comingSoon).length} Templates
              </span>
            </div>

            {/* SEARCH */}
            <div className="mt-4 relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
                size={16}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full h-11 rounded-2xl border border-neutral-200 bg-neutral-50 pl-10 pr-4 text-sm outline-none focus:border-[#c7f038]focus:bg-white"
              />
            </div>
          </DialogHeader>

          {/* BODY */}
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
            <div className="p-8">
              <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-5 gap-5">
                {filteredTemplates.map((template) => (
                  <TemplateCard
                    key={template.title}
                    template={template}
                    onClick={() => {
                      if (!template.href) return;
                      setTemplateModalOpen(false);
                      router.push(template.href);
                    }}
                  />
                ))}
              </div>

              {filteredTemplates.length === 0 && (
                <div className="text-center text-sm text-neutral-500 py-20">
                  No templates found
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
