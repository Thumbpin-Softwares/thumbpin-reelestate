import Image from "next/image";
import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";

const data = [
  {
    title: "How to upload good property images",
    description: "Comprehensive guide on how can you get better results on uploading your property images.",
    link: "./guide/upload-property",
    image: "",
  },
  {
    title: "How to write good scripts",
    description: "Comprehensive guide on how can you get better scripts to get good results of your reel.",
    link: "./guide/script",
    image: "",
  },
];

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
        {data.map((item, index) => (
          <Link
            href={item.link}
            key={index}
            className="group flex flex-col gap-4 rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm transition-all hover:border-[#c7f038] hover:shadow-md"
          >
            {item.image ? (
              <Image
                width={120}
                height={120}
                src={item.image}
                alt={item.title}
                className="w-12 h-12 rounded-xl object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-neutral-900 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-[#c7f038]" />
              </div>
            )}

            <div className="flex-1 space-y-2 pt-4">
              <h1 className="text-lg">{item.title}</h1>
              <p className="text-sm text-neutral-500 leading-relaxed">{item.description}</p>
            </div>

            <span className="flex items-center gap-1 text-sm font-medium text-neutral-900 group-hover:text-neutral-900">
              Learn More
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
