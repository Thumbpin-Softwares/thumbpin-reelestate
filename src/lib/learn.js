import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked } from "marked";

// Markdown source for the /resources blog. Drop a `<slug>.md` file in here
// with frontmatter and it shows up on /resources and /resources/<slug>.
//
// Expected frontmatter:
//   title:     string (required)
//   excerpt:   string
//   category:  string
//   coverImage: string (public/ path or absolute URL)
//   date:      string, e.g. "2026-07-09"
//   readTime:  string, e.g. "5 min read"
const LEARN_DIR = path.join(process.cwd(), "content", "learn");

function readSlugs() {
  if (!fs.existsSync(LEARN_DIR)) return [];
  return fs
    .readdirSync(LEARN_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.replace(/\.md$/, ""));
}

export function getAllPosts() {
  return readSlugs()
    .map((slug) => {
      const raw = fs.readFileSync(path.join(LEARN_DIR, `${slug}.md`), "utf8");
      const { data } = matter(raw);
      return { slug, ...data };
    })
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

export function getPostBySlug(slug) {
  const filePath = path.join(LEARN_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);

  return {
    slug,
    ...data,
    contentHtml: marked.parse(content),
  };
}
