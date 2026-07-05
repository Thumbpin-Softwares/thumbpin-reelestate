import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata = {
  title: "How to upload good property images — Help Center",
};

export default function UploadPropertyGuideLayout({ children }) {
  return (
    <div className="mx-auto pt-16 px-4">
      <Link
        href="/app/help"
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Help Center
      </Link>

      <article className="mt-6 space-y-6 text-neutral-700 leading-relaxed [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:font-heading [&_h1]:tracking-tight [&_h1]:text-neutral-900 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-neutral-900 [&_h2]:mt-8 [&_p]:text-neutral-600 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_img]:rounded-2xl [&_img]:border [&_img]:border-neutral-200">
        {children}
      </article>
    </div>
  );
}
