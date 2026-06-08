import UserNav from "@/modules/common/layout/navbar";
import { AdminModal } from "@/components/dashboard/admin-modal";
import Footer from "@/modules/common/layout/footer";

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#fafbfc]">
      <UserNav />
      
      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        <div className="animate-fade-in">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
