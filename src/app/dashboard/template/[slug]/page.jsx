import { notFound } from "next/navigation";
import { getGenericTemplates, getTemplateBySlug } from "@/lib/templates";
import { getTemplateRunner } from "@/modules/template-runner/runners";
import { TemplateComingSoon } from "@/modules/template-runner/components/coming-soon";

export function generateStaticParams() {
  return getGenericTemplates().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const template = getTemplateBySlug(slug);
  if (!template) return {};
  return { title: `${template.title} — Thumbplay.ai` };
}

export default async function TemplatePage({ params }) {
  const { slug } = await params;
  const template = getTemplateBySlug(slug);
  if (!template) notFound();

  const Runner = getTemplateRunner(slug);
  if (Runner) return <Runner template={template} />;

  return <TemplateComingSoon template={template} />;
}
