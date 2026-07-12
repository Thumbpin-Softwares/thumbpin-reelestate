import Hero from "@/modules/usage/layout/hero";
import Carousal from "@/modules/common/components/carousal";
import About from "@/modules/usage/components/about";
import Guide from "@/modules/usage/layout/guide";
import Feature from "@/modules/usage/layout/feature";
import Faq from "@/modules/usage/layout/faq";
import Testimonial from "@/modules/common/layout/testimonial";
import Cta from "@/modules/usage/layout/cta";
import PostCta from "@/modules/usage/layout/post-cta";

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
      <Faq />
      <div className="py-24">
        <Testimonial />
      </div>
      <Cta />
      <div className="pt-12">
        <PostCta />
      </div>
    </main>
  );
}
