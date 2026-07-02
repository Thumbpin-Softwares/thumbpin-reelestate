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
import { Video, Pencil, ArrowRight } from "lucide-react";
import { Search } from "lucide-react";
import { useUser } from "@/hooks/use-user";

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
  }
];

export default function DashboardPage() {
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { user, profile } = useUser();
  const filteredTemplates = REAL_ESTATE_TEMPLATES.filter((t) =>
    t.title.toLowerCase().includes(query.toLowerCase()),
  );

  const displayName =
    profile?.name || user?.name || profile?.email?.split("@")[0] || "there";
  const firstName = displayName.split(" ")[0];

  const actions = [
    {
      title: "Reel Generator",
      description:
        "Build stunning real estate reels that grab users' attention.",
      href: null,
      icon: Video,
      color: "bg-black text-[#c7f038]",
    },
    {
      title: "Edit Your Reels",
      description: "Fine-tune and download your generated reels",
      href: "/app/edit",
      icon: Pencil,
      color: "bg-black text-[#c7f038]",
    },
  ];

  return (
    <div className="h-full flex items-center justify-center bg-linear-to-b from-[#fafbfc] to-neutral-50">
      <section className="w-full max-w-2xl px-4 sm:pt-0 pt-4">
        {/* Greeting */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-switzer sm:text-4xl font-light text-center tracking-tight text-neutral-900">
            Hi {firstName}, Let&apos;s do something remarkable today.
          </h1>
          <p className="mt-1 text-sm sm:text-base text-neutral-500">
            
          </p>
        </div>

        {/* Actions */}
        <div className="grid sm:grid-cols-2 gap-4">
          {actions.map((action) => {
            const Icon = action.icon;

            const content = (
              <div className="group relative flex flex-row sm:flex-col border border-neutral-100 bg-white shadow-lg items-center justify-between sm:justify-center p-4 sm:p-6 sm:h-48 gap-2 sm:space-y-4 rounded-xl transition-all duration-300 hover:border-neutral-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-0.5">
                <div className="order-1 sm:order-2 text-left sm:text-center flex flex-col gap-1 sm:gap-1">
                  <h3 className="text-lg text-black">{action.title}</h3>
                  <h1 className="text-neutral-700 text-sm">{action.description}</h1>
                </div>

                <div className={`order-2 sm:order-1 shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${action.color} group-hover:scale-110 duration-300 transition-transform`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            );

            if (action.title === "Reel Generator") {
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
        </div>
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
