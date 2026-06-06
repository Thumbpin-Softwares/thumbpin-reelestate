import { Navbar } from "@/modules/home/components/navbar";
import Hero from "@/modules/home/layout/hero";
import About from "@/modules/home/layout/about";
import Footer from "@/modules/common/layout/footer";
import Cta from "@/modules/home/layout/cta";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#f7f5e8]">
      <Navbar />
      <Hero />
      <div className="bg-[#f5f6f0] py-12">
        <About />
      </div>
      <div className="bg-white pb-12">
        <Cta />
      </div>
      <Footer />
    </main>
  );
}
