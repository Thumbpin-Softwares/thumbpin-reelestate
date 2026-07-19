import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/modules/common/components/auth-provider";
import SmoothScroll from "@/modules/common/smooth-scroll";

export default function DashboardLayout({ children }) {
  return (
    <main className="min-h-screen bg-[#fafbfc]">
      <SmoothScroll>
        <AuthProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </AuthProvider>
        <Toaster richColors position="top-right" />
      </SmoothScroll>
    </main>
  );
}
