import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/auth-provider";
import { NetworkStatus } from "@/modules/common/components/network-status";
import SmoothScroll from "@/modules/common/smooth-scroll";

export const metadata = {
  title: {
    default: "Thumbplay AI | Generate UGC Video Ads in Minutes",
    template: "%s | Thumbplay AI",
  },
  description:
    "Create AI-powered UGC video ads with realistic avatars, Indian-accent voices, lip sync, and Reel-ready formats.",
  keywords: [
    "AI UGC video generator",
    "AI video ads",
    "UGC ads India",
    "Indian AI voices",
    "AI avatars",
    "Instagram Reels generator",
    "script to video",
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <SmoothScroll>
          <AuthProvider>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </AuthProvider>
          <Toaster richColors position="top-right" />
          <NetworkStatus />
        </SmoothScroll>
      </body>
    </html>
  );
}
