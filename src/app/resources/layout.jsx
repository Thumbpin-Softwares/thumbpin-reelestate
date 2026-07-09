import { Navbar } from "@/modules/home/components/navbar";
import Footer from "@/modules/common/layout/footer";

export const metadata = {
  title: "Learning Resources — Thumbplay.ai",
  description:
    "Guides, tips, and articles on creating high-converting UGC video ads with Thumbplay.ai.",
};

export default function ResourcesLayout({ children }) {
  return (
    <main>
      <Navbar />
      <div className="pt-24">{children}</div>
      <Footer />
    </main>
  );
}
