import { BookOpen } from "lucide-react";

export default function HelpCenterPage() {
  return (
    <div className="max-w-2xl mx-auto text-center py-20 space-y-3">
      <BookOpen className="w-8 h-8 mx-auto text-[#c7f038]" />
      <h1 className="text-2xl font-semibold font-heading">Help Center</h1>
      <p className="text-sm text-muted-foreground">
        Guides and FAQs are coming soon. Need help now? Reach us at{" "}
        <a href="mailto:support@thumbpin.ai" className="underline">
          support@thumbpin.ai
        </a>
        .
      </p>
    </div>
  );
}
