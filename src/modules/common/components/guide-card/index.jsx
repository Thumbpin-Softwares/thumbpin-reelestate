import Image from "next/image";
import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";

export function GuideCard({ title, description, link, image }) {
  return (
    <Link
      href={link}
      className="group relative flex flex-col gap-5 overflow-hidden rounded-[28px] border border-[#c7f038]/20 bg-white/80 p-6 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-1 hover:border-[#c7f038]/40 hover:shadow-[0_24px_64px_rgba(199,240,56,0.18)]"
    >
      {image ? (
        <Image
          width={120}
          height={120}
          src={image}
          alt={title}
          className="h-14 w-14 rounded-2xl object-cover ring-1 ring-[#c7f038]/15"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-black text-[#c7f038]">
          <BookOpen />
        </div>
      )}

      <div className="flex-1 space-y-2 pt-4">
        <h1 className="text-lg font-semibold tracking-tight text-neutral-900">{title}</h1>
        <p className="text-sm text-neutral-500 leading-relaxed">{description}</p>
      </div>

      <span className="flex items-center gap-1 text-sm font-medium text-[#88a600]">
        Learn More
        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
