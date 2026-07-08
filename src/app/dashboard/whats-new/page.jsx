import { Sparkles } from "lucide-react";

export default function WhatsNewPage() {
  return (
    <div className="max-w-2xl mx-auto text-center py-20 space-y-3">
      <Sparkles className="w-8 h-8 mx-auto text-[#c7f038]" />
      <h1 className="text-2xl font-semibold font-heading">What's New</h1>
      <p className="text-sm text-muted-foreground">
        Product updates and release notes will show up here soon.
      </p>
    </div>
  );
}
