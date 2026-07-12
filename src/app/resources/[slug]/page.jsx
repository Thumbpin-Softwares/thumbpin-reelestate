import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getAllPosts, getPostBySlug } from "@/lib/learn";
import { BlogCard } from "@/modules/common/components/blog-card";

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return {
    title: `${post.title} — Thumbplay.ai`,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const morePosts = getAllPosts()
    .filter((p) => p.slug !== slug)
    .slice(0, 3);

  return (
    <div className="max-w-3xl mx-auto px-4 pb-16">
      <Link
        href="/resources"
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        All articles
      </Link>

      <div className="mt-6 space-y-3">
        {post.category && (
          <span className="w-fit inline-block rounded-full bg-[#c7f038] px-3 py-1 text-xs font-medium text-neutral-900">
            {post.category}
          </span>
        )}
        <h1 className="text-3xl sm:text-4xl font-bold font-heading tracking-tight text-neutral-900">
          {post.title}
        </h1>
        <p className="text-sm text-neutral-400">
          {[post.date, post.readTime].filter(Boolean).join(" · ")}
        </p>
      </div>

      {post.coverImage && (
        <div className="relative mt-8 aspect-16/9 w-full overflow-hidden rounded-2xl border border-neutral-200">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            unoptimized
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
          />
        </div>
      )}

      <article
        className="mt-8 space-y-6 text-neutral-700 leading-relaxed [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:font-heading [&_h1]:tracking-tight [&_h1]:text-neutral-900 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-neutral-900 [&_h2]:mt-8 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-neutral-900 [&_h3]:mt-6 [&_p]:text-neutral-600 [&_a]:text-neutral-900 [&_a]:underline [&_a]:underline-offset-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_img]:rounded-2xl [&_img]:border [&_img]:border-neutral-200 [&_blockquote]:border-l-2 [&_blockquote]:border-[#c7f038] [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:bg-neutral-100 [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm"
        dangerouslySetInnerHTML={{ __html: post.contentHtml }}
      />

      {morePosts.length > 0 && (
        <div className="mt-16 pt-8 border-t border-neutral-200">
          <h2 className="text-xl font-semibold font-heading text-neutral-900 mb-5">
            More articles
          </h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {morePosts.map((p) => (
              <BlogCard key={p.slug} {...p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
