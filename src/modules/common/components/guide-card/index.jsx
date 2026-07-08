import Image from "next/image";
import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";

export function GuideCard({ title, description, link, image }) {
  return (
    <Link
      href={link}
      className="group flex flex-col gap-4 rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm transition-all hover:border-[#c7f038] hover:shadow-md"
    >
      {image ? (
        <Image
          width={120}
          height={120}
          src={image}
          alt={title}
          className="w-12 h-12 rounded-xl object-cover"
        />
      ) : (
        <div className="w-12 h-12 rounded-xl bg-neutral-900 flex items-center justify-center shrink-0">
          <BookOpen className="w-5 h-5 text-[#c7f038]" />
        </div>
      )}

      <div className="flex-1 space-y-2 pt-4">
        <h1 className="text-lg">{title}</h1>
        <p className="text-sm text-neutral-500 leading-relaxed">{description}</p>
      </div>

      <span className="flex items-center gap-1 text-sm font-medium text-neutral-900 group-hover:text-neutral-900">
        Learn More
        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
