import Hero from "@/modules/usage/layout/hero";
import Carousal from "@/modules/common/components/carousal";
import About from "@/modules/usage/components/about";
import Guide from "@/modules/usage/layout/guide";
import Feature from "@/modules/usage/layout/feature";

export default function UsagePage() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <Hero />
      </div>
      <Carousal />
      <div className="py-12">
        <About />
      </div>
      <Guide />
      <div className="py-12 max-w-5xl mx-auto">
        <Feature />
      </div>
    </main>
  );
}
