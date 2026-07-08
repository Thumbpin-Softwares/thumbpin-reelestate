import UserNav from "@/modules/common/layout/navbar";
import Aside from "@/modules/common/layout/aside";
import MobileBottomNav from "@/modules/common/layout/mobile-bottom-nav";
import PipelineBreadcrumb from "@/modules/common/layout/pipeline-breadcrumb";
import { AdminModal } from "@/components/dashboard/admin-modal";

export default function DashboardLayout({ children }) {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#fafbfc]">
      <UserNav />

      <div className="flex flex-1 min-h-0 py-4">
        <Aside />

        <main className="relative flex-1 min-w-0 min-h-0 flex flex-col px-6">
          <PipelineBreadcrumb />
          <div data-lenis-prevent className="animate-fade-in flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {children}
          </div>
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
