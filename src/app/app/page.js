"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUser } from "@/hooks/use-user";
import { Video, Building, ShoppingBag, ArrowRight, Plus } from "lucide-react";

const REAL_ESTATE_TEMPLATES = [
  {
    title: "Model exiting a luxury vehicle",
    href: "/app/veo-long-ad",
    video: "https://content.thumbpin.in/templates/modelLuxuryVehicle.mp4",
  },
];

function TemplateCard({ template, onClick }) {
  const videoRef = useRef(null);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => videoRef.current?.play()}
      onMouseLeave={() => {
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }}
      className="group flex flex-col rounded-2xl border border-neutral-200 overflow-hidden bg-white hover:border-neutral-400 hover:shadow-xl transition-all duration-300 text-left"
    >
      <div className="relative w-full" style={{ aspectRatio: "9/16" }}>
        <video
          ref={videoRef}
          src={template.video}
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300 bg-neutral-900"
        />
        <div className="absolute inset-0 flex items-center justify-center group-hover:opacity-0 transition-opacity duration-200">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white ml-0.5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
      <div className="p-3">
        <h4 className="font-semibold text-sm">{template.title}</h4>
      </div>
    </button>
  );
}

export default function DashboardPage() {
  const { profile } = useUser();
  const [videos, setVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function fetchRecentVideos() {
      try {
        const res = await fetch("/api/user/videos?limit=3");
        if (res.ok) {
          const data = await res.json();
          setVideos(data.videos || []);
        }
      } catch (err) {
        console.error("Failed to fetch videos:", err);
      } finally {
        setLoadingVideos(false);
      }
    }
    fetchRecentVideos();
  }, []);

  const userName = profile?.name || profile?.email?.split("@")[0] || "there";

  const actions = [
    {
      title: "Real Estate",
      description:
        "Build stunning real estate social media post that grabs users attentiton.",
      href: null,
      icon: Building,
      color: "bg-amber-50 text-amber-600",
    },
    {
      title: "UGC Video",
      description: "Convert your script to video of your liking",
      href: "/app/text-to-video",
      icon: Video,
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      title: "Product Ad",
      description: "Showcase physical items",
      href: "/app/product-to-video",
      icon: ShoppingBag,
      color: "bg-emerald-50 text-emerald-600",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 bg-[#fafbfc]">
      {/* Zen Header */}
      <section className="text-center space-y-4 pt-12">
        <h1 className="text-4xl font-bold font-heading tracking-tight sm:text-5xl">
          Create something{" "}
          <span className="italic text-black bg-[#c7f038] px-4 py-1 rounded-lg">
            remarkable.
          </span>
        </h1>
        <p className="text-base text-muted-foreground max-w-md mx-auto">
          Welcome back, {userName}, What are you upto today
        </p>
      </section>

      {/* Minimalism Actions */}
      <section className="grid sm:grid-cols-3 gap-4">
        {actions.map((action) => {
          const Icon = action.icon;
          const isComingSoon =
            action.title === "UGC Video" || action.title === "Product Ad";

          const content = (
            <div
              className={`relative h-48 flex flex-col bg-white items-center p-6 space-y-4 rounded-3xl border border-neutral-200 transition-all duration-300 ${
                isComingSoon
                  ? "cursor-not-allowed"
                  : "hover:border-border/40 hover:bg-white hover:shadow-xl"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-3xl flex items-center justify-center ${action.color} ${!isComingSoon && "group-hover:scale-110 transition-transform"}`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div className="text-center flex flex-col gap-2">
                <h3 className="font-semibold">{action.title}</h3>
                <p className="text-sm text-neutral-500">{action.description}</p>
              </div>

              {isComingSoon && (
                <div className="absolute inset-0 pt-4 flex items-center justify-center">
                  <span className="bg-[#c7f038] text-black text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-full shadow-lg">
                    Coming Soon
                  </span>
                </div>
              )}
            </div>
          );

          if (isComingSoon) return <div key={action.title}>{content}</div>;

          if (action.title === "Real Estate") {
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
          <DialogHeader className="px-8 py-6 border-b shrink-0">
            <DialogTitle className="text-2xl font-bold">
              Select a Template
            </DialogTitle>

            <p className="text-sm text-neutral-500">
              Hover to preview, Click to get started
            </p>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide overscroll-contain">
            <div className="p-8">
              <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-5 gap-5">
                {REAL_ESTATE_TEMPLATES.map((template) => (
                  <TemplateCard
                    key={template.href}
                    template={template}
                    onClick={() => {
                      setTemplateModalOpen(false);
                      router.push(template.href);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Elegant Recents */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-300 pb-4">
          <h2 className="text-lg font-semibold font-heading tracking-tight">
            Recent Creations
          </h2>
          <Link
            href="/app/history"
            className="text-sm font-semibold shadow-xl text-[#c7f038] bg-neutral-900 px-4 py-2 rounded-full flex items-center gap-2"
          >
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="space-y-4">
          {loadingVideos ? (
            [1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))
          ) : videos.length > 0 ? (
            videos.map((video) => (
              <Link key={video.id} href="/app/history" className="block group">
                <div className="flex items-center justify-between p-4 rounded-xl hover:bg-white hover:shadow-md transition-all duration-300 border border-transparent hover:border-border/30">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-muted rounded-lg overflow-hidden relative shrink-0">
                      {video.url ? (
                        <video
                          src={video.url}
                          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-indigo-50">
                          <Video className="w-6 h-6 text-indigo-200" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {video.name}
                      </p>
                      <p className="text-[12px] text-muted-foreground">
                        {new Date(video.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        · {video.type}
                      </p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground group-hover:text-[#c7f038] group-hover:bg-neutral-900 duration-300 transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="text-center py-10 bg-white/40 rounded-3xl border border-dashed border-border/40">
              <p className="text-sm text-muted-foreground">
                No projects yet. Let&apos;s start one!
              </p>
              <Link href="/app/veo-long-ad">
                <Button variant="link" className="mt-2 text-primary font-bold">
                  <Plus className="w-4 h-4 mr-1" /> Create Now
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
