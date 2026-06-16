"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import {
  PenTool,
  Loader2,
  Sparkles,
  Copy,
  Video,
  ChevronRight,
  Info,
  Check,
  Save,
} from "lucide-react";

export default function UGCCreatorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [scripts, setScripts] = useState([]);
  const [formData, setFormData] = useState({
    product_name: "",
    product_description: "",
    target_audience: "Young adults (18-35)",
    tone: "friendly",
    language: "English",
  });
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedProduct, setSavedProduct] = useState(null);

  async function handleGenerate() {
    if (!formData.product_name || !formData.product_description) {
      toast.error("Please fill in product name and description");
      return;
    }

    setLoading(true);
    setScripts([]);

    try {
      const res = await fetch("/api/ai-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate scripts");

      setScripts(data.scripts || []);
      toast.success("Scripts generated successfully! ✨");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text, index) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success("Script copied to clipboard");
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  function useForVideo(script) {
    // Redirect to product-to-video with pre-filled script
    const params = new URLSearchParams();
    params.set("script", script.text);
    router.push(`/app/product-to-video?${params.toString()}`);
  }

  async function saveProduct() {
    if (!formData.product_name || !formData.product_description) return;
    setSaving(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.product_name,
          description: formData.product_description,
          targetAudience: formData.target_audience,
          tone: formData.tone,
          scripts: scripts.map(s => s.text),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save product");

      setSavedProduct(data.product);
      toast.success("Product saved to your library! 📦");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center shadow-md">
          <PenTool className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">UGC Script Writer</h1>
          <p className="text-sm text-muted-foreground">
            Generate high-conversion video scripts for your product in seconds.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Form Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/50 shadow-sm">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Product Name</label>
                <Input
                  placeholder="e.g. Smart Hydration Bottle"
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Product Details & Benefits</label>
                <Textarea
                  placeholder="What makes it special? Who is it for?"
                  className="min-h-[120px] resize-none"
                  value={formData.product_description}
                  onChange={(e) => setFormData({ ...formData, product_description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Target Audience</label>
                  <Input
                    placeholder="e.g. Fitness enthusiasts"
                    value={formData.target_audience}
                    onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Tone</label>
                  <Select
                    value={formData.tone}
                    onValueChange={(v) => setFormData({ ...formData, tone: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent>
                      {["friendly", "professional", "excited", "calm", "serious"].map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full gradient-bg text-white shadow-md cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Writing Scripts...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Scripts
                  </>
                )}
              </Button>

              {scripts.length > 0 && (
                <Button
                  variant="outline"
                  onClick={saveProduct}
                  disabled={saving || !!savedProduct}
                  className="w-full border-primary/20 hover:bg-primary/5 cursor-pointer"
                >
                  {saving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                  ) : savedProduct ? (
                    <><Check className="w-4 h-4 mr-2 text-green-500" /> Saved to Library</>
                  ) : (
                    <><Save className="w-4 h-4 mr-2" /> Save Product Details</>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex gap-3">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Our AI writes 3 distinct versions for you: a hook-based ad, an expert review style, and a FOMO-driven script. Pick the one that fits your brand best!
            </p>
          </div>
        </div>

        {/* Results Section */}
        <div className="lg:col-span-3 space-y-4">
          {!loading && scripts.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-border rounded-2xl bg-muted/20">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <PenTool className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg">Your scripts will appear here</h3>
              <p className="text-sm text-muted-foreground max-w-[280px] mt-1">
                Fill in the details on the left to generate conversion-focused scripts.
              </p>
            </div>
          )}

          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse border-border/50">
                  <CardHeader className="pb-2">
                    <div className="h-4 w-32 bg-muted rounded"></div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="h-3 w-full bg-muted rounded"></div>
                    <div className="h-3 w-full bg-muted rounded"></div>
                    <div className="h-3 w-2/3 bg-muted rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {scripts.map((script, i) => (
            <Card key={i} className="border-primary/20 hover:border-primary/40 transition-all shadow-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Badge variant="outline" className="h-5 px-1.5 font-mono text-[10px]">VER {i + 1}</Badge>
                  {script.title}
                </CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 cursor-pointer"
                    onClick={() => copyToClipboard(script.text, i)}
                  >
                    {copiedIndex === i ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 bg-muted/30 p-4 rounded-xl">
                  {script.text}
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    className="cursor-pointer gap-2"
                    onClick={() => useForVideo(script)}
                  >
                    <Video className="w-4 h-4" />
                    Use for Video
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function Badge({ children, variant, className }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}>
      {children}
    </span>
  );
}
