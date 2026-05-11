import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/auth-provider";

export const metadata = {
  title: "Thumb AI Generate UGC Video Ads in 60 Seconds",
  description:
    "AI-powered UGC video ad generator for Indian brands & creators. Script to Reel in under 2 minutes with Indian-accent voices, AI avatars, and lip-sync technology.",
  keywords: [
    "UGC video generator",
    "AI video ads",
    "Indian creators",
    "Instagram Reels",
    "AI avatar",
    "lip sync",
    "video marketing India",
  ],
  openGraph: {
    title: "Thumb AI – Script to Reel in 60s",
    description:
      "Generate viral UGC video ads with AI actors & Indian voices. Get 2 free videos + 2 free avatars on signup.",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Thumb AI – AI UGC Video Generator for India",
    description:
      "Create professional Reel-style talking-head videos with AI. Made for Indian brands.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </AuthProvider>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
