import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Newspaper } from "lucide-react";

export function BlogCard({ slug, title, excerpt, category, coverImage, date, readTime }) {
  return (
    <Link
      href={`/resources/${slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm transition-all hover:border-[#c7f038] hover:shadow-md"
    >
      <div className="relative aspect-16/9 w-full overflow-hidden bg-neutral-100">
        {coverImage ? (
          <Image
            src={coverImage}
            alt={title}
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-neutral-900">
            <Newspaper className="w-8 h-8 text-[#c7f038]" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        {category && (
          <span className="w-fit rounded-full bg-[#c7f038] px-3 py-1 text-xs font-medium text-neutral-900">
            {category}
          </span>
        )}

        <h2 className="text-lg font-medium text-neutral-900 leading-snug line-clamp-2">
          {title}
        </h2>

        {excerpt && (
          <p className="text-sm text-neutral-500 leading-relaxed line-clamp-2">
            {excerpt}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-neutral-400">
          <span>{[date, readTime].filter(Boolean).join(" · ")}</span>
          <span className="flex items-center gap-1 font-medium text-neutral-900">
            Read
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
