import UserNav from "@/modules/common/layout/navbar";
import Aside from "@/modules/common/layout/aside";
import { AdminModal } from "@/components/dashboard/admin-modal";

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#fafbfc]">
      <UserNav />

      <div className="flex py-4">
        <Aside />

        <main className="flex-1 max-w-5xl mx-auto px-4 py-8 sm:py-12">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
