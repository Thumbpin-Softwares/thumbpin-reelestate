import { Navbar } from "@/modules/home/components/navbar";
import Hero from "@/modules/home/layout/hero";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Testimonials } from "@/components/landing/testimonials";
import { Pricing } from "@/components/landing/pricing";
import { Footer } from "@/components/landing/footer";

import Showcase from "@/modules/home/components/showcase";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#f7f5e8]">
      <Navbar />
      <Hero />
      <Showcase />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <Footer />
    </main>
  );
}
