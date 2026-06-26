"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import TemplateCard from "@/modules/dashboard/components/template-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser } from "@/hooks/use-user";
import { Video, Building, ShoppingBag, ArrowRight, Plus, Pencil, Loader2, Play, MoreVertical } from "lucide-react";
import { Search } from "lucide-react";
import {
  EDITABLE_SOURCES,
  COMPOSITION_STORAGE_KEY,
  EDIT_PATH,
  buildCompositionFromAsset,
} from "@/lib/editable-sources";

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
];

export default function DashboardPage() {
  const { profile } = useUser();
  const [videos, setVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editingVideoId, setEditingVideoId] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);
  const filteredTemplates = REAL_ESTATE_TEMPLATES.filter((t) =>
    t.title.toLowerCase().includes(query.toLowerCase()),
  );

  const handleEditVideo = async (e, video) => {
    e.preventDefault();
    e.stopPropagation();

    if (editingVideoId) return;
    setEditingVideoId(video.id);
    try {
      const compositionProps = await buildCompositionFromAsset(video);
      if (!compositionProps) return;

      sessionStorage.setItem(COMPOSITION_STORAGE_KEY, JSON.stringify(compositionProps));
      router.push(EDIT_PATH);
    } finally {
      setEditingVideoId(null);
    }
  };

  const renderVideoCard = (video) => (
    <Link key={video.id} href={EDIT_PATH} className="block group">
      <div className="aspect-9/16 bg-muted rounded-2xl overflow-hidden relative border border-transparent group-hover:border-[#c7f038]/60 group-hover:shadow-xl transition-all duration-300">
        {video.url ? (
          <video
            src={video.url}
            muted
            loop
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
            onMouseEnter={(e) => e.currentTarget.play()}
            onMouseLeave={(e) => {
              e.currentTarget.pause();
              e.currentTarget.currentTime = 0;
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-indigo-50">
            <Video className="w-8 h-8 text-indigo-200" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/40 to-transparent p-3 pt-8">
          <p className="font-semibold text-sm text-white truncate">
            {video.name}
          </p>
          <p className="text-[11px] text-white/70">
            {new Date(video.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })}{" "}
            · {video.type}
          </p>
        </div>
        <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-[#c7f038] transition-all duration-300">
          <ArrowRight className="w-4 h-4" />
        </div>
        {EDITABLE_SOURCES[video.metadata?.source] && (
          <button
            type="button"
            onClick={(e) => handleEditVideo(e, video)}
            disabled={editingVideoId === video.id}
            className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-[#c7f038] transition-all duration-300 disabled:opacity-100"
            title="Edit"
          >
            {editingVideoId === video.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Pencil className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
    </Link>
  );

  const renderMobileVideoCard = (video) => {
    const canEdit = !!EDITABLE_SOURCES[video.metadata?.source];

    return (
      <div
        key={video.id}
        className="relative aspect-video w-full bg-muted rounded-2xl overflow-hidden border border-neutral-200"
      >
        <Link href={EDIT_PATH} className="absolute inset-0 block">
          {video.url ? (
            <video
              src={video.url}
              muted
              loop
              playsInline
              preload="metadata"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-indigo-50">
              <Video className="w-8 h-8 text-indigo-200" />
            </div>
          )}

          {/* Title bar at top */}
          <div className="absolute inset-x-0 top-0 bg-linear-to-b from-black/70 via-black/30 to-transparent p-3 pr-12">
            <p className="font-semibold text-sm text-white truncate">{video.name}</p>
            <p className="text-[11px] text-white/70">
              {new Date(video.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })}{" "}
              · {video.type}
            </p>
          </div>

        </Link>

        {/* Centered play button — opens player instead of navigating */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPlayingVideo(video);
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg"
          title="Play"
        >
          <Play className="w-5 h-5 text-black fill-black" />
        </button>

        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white"
                title="More options"
              >
                {editingVideoId === video.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MoreVertical className="w-4 h-4" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={editingVideoId === video.id}
                onClick={(e) => handleEditVideo(e, video)}
                className="cursor-pointer"
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  useEffect(() => {
    async function fetchRecentVideos() {
      try {
        const res = await fetch("/api/user/videos?limit=4");
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
      href: "/app/ugc-creator",
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
      {/* Minimalism Actions */}
      <section className="grid sm:grid-cols-3 sm:pt-0 pt-4 gap-4">
        {actions.map((action) => {
          const Icon = action.icon;
          const isComingSoon =
            action.title === "UGC Video" || action.title === "Product Ad";

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
                <div className="absolute top-3 right-3 bottom-auto sm:pt-8 left-auto sm:inset-0 sm:flex sm:items-center sm:justify-center">
                  <span className="bg-[#c7f038] text-black text-[10px] sm:text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-full shadow-lg">
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

      {/* Elegant Recents */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-300 pb-4">
          <h2 className="text-lg font-semibold font-heading tracking-tight">
            Recent Creations
          </h2>
        </div>

        {/* Mobile: last 2, stacked landscape cards with a small reel preview */}
        <div className="flex sm:hidden flex-col gap-3">
          {loadingVideos ? (
            [1, 2].map((i) => (
              <Skeleton key={i} className="aspect-video w-full rounded-2xl" />
            ))
          ) : videos.length > 0 ? (
            videos.slice(0, 2).map((video) => renderMobileVideoCard(video))
          ) : (
            <div className="text-center py-10 bg-white/40 rounded-3xl border border-dashed border-border/40">
              <p className="text-sm text-muted-foreground">
                No projects yet. Let&apos;s start one!
              </p>
            </div>
          )}
        </div>

        {/* Desktop/tablet: full grid */}
        <div className="hidden sm:grid grid-cols-3 md:grid-cols-4 gap-4">
          {loadingVideos ? (
            [1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="aspect-9/16 w-full rounded-2xl" />
            ))
          ) : videos.length > 0 ? (
            videos.map((video) => renderVideoCard(video))
          ) : (
            <div className="col-span-full text-center py-10 bg-white/40 rounded-3xl border border-dashed border-border/40">
              <p className="text-sm text-muted-foreground">
                No projects yet. Let&apos;s start one!
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Mobile video player */}
      <Dialog open={!!playingVideo} onOpenChange={(open) => !open && setPlayingVideo(null)}>
        <DialogContent className="p-0 gap-0 overflow-hidden max-w-sm border-none bg-black">
          <DialogHeader className="sr-only">
            <DialogTitle>{playingVideo?.name}</DialogTitle>
          </DialogHeader>
          {playingVideo?.url && (
            <video
              src={playingVideo.url}
              controls
              autoPlay
              playsInline
              className="w-full aspect-9/16 bg-black"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
