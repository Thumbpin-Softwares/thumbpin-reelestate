import { Navbar } from "@/modules/home/components/navbar";
import Footer from "@/modules/common/layout/footer";

export const metadata = {
  title: "Use Cases of Thumbplay.ai",
  description:
    "See how brands and creators use Thumbplay.ai to generate UGC video ads in minutes.",
};

export default function UsageLayout({ children }) {
  return (
    <main>
      <Navbar />
      <div className="pt-24">{children}</div>
      <Footer />
    </main>
  );
}
