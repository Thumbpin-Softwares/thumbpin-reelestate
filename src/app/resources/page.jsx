import { BookOpen } from "lucide-react";
import { getAllPosts } from "@/lib/learn";
import { BlogCard } from "@/modules/common/components/blog-card";

export default function ResourcesPage() {
  const posts = getAllPosts();

  return (
    <div className="max-w-6xl mx-auto px-4">
      <div className="flex flex-col items-center pt-24 gap-4 text-center">
        <h1 className="text-4xl sm:text-6xl font-bold tracking-wide">
          <span className="bg-[#c7f038] text-black px-4 py-2 rounded italic">Thumbplay</span> Learn
        </h1>
        <span className="text-xl text-black py-4">
          Tips, tricks and tutorials to help you grow your audience online.
        </span>
      </div>

      {posts.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 py-12">
          {posts.map((post) => (
            <BlogCard key={post.slug} {...post} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-neutral-900 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-[#c7f038]" />
          </div>
          <p className="text-sm font-medium text-neutral-900">
            New articles are on the way
          </p>
          <p className="text-sm text-neutral-500 max-w-sm">
            We&apos;re working on guides and playbooks to help you get the most
            out of Thumbplay.ai. Check back soon.
          </p>
        </div>
      )}
    </div>
  );
}
