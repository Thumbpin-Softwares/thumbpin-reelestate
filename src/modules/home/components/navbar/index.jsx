"use client";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Sparkles, Menu, X, LayoutDashboard } from "lucide-react";

const navItems = [
    {
        title : "Home",
        link : "",
    },
    {
        title : "About",
        link : "",
    },
    {
        title : "Pricing",
        link : "",
    },
    {
        title : "FAQs",
        link : "",
    }
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl">
        <div className="flex">
            <div className="h-1 bg-linear-to-r from-purple-500 via-yellow-500 to-green-500 w-full"></div>
            <div className="h-1 bg-linear-to-l from-purple-500 via-yellow-500 to-green-500 w-full"></div>
        </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <Sparkles className="w-5 h-5 text-black" />
            <span className="text-xl font-semibold">
              Thumb AI
            </span>
          </Link>

          {/* Desktop Nav 
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              How it Works
            </a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
          </div>
          */}

          {/* Desktop Nav */}
          <ul className="hidden md:flex items-center text-md text-black gap-8">
            {navItems.map((item, index) => (
                <li key={index}>
                    <Link href={item.link}>{item.title}</Link>
                </li>
            ))}
          </ul>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/app">
                <span className="bg-black flex items-center justify-center text-white hover:opacity-90 cursor-pointer py-3 px-4 rounded-xl">
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Dashboard
                </span>
              </Link>
            ) : (
              <div className="flex gap-4">
                <Link href="/auth/login">
                  <span className="cursor-pointer text-md text-black bg-transparent">Log In</span>
                </Link>
                <Link href="/auth/signup">
                  <span className="cursor-pointer bg-black text-white py-3 px-4 rounded-xl">
                    Start Free
                  </span>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="cursor-pointer"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 space-y-3 animate-slide-down">
            <a href="#features" className="block py-2 text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>
              Features
            </a>
            <a href="#how-it-works" className="block py-2 text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>
              How it Works
            </a>
            <a href="#pricing" className="block py-2 text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>
              Pricing
            </a>
            <div className="flex gap-2 pt-2">
              {isAuthenticated ? (
                <Link href="/app" className="flex-1">
                  <span className="w-full bg-black text-white cursor-pointer">
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard
                  </span>
                </Link>
              ) : (
                <>
                  <Link href="/auth/login" className="flex-1">
                    <Button variant="outline" className="w-full cursor-pointer">Log In</Button>
                  </Link>
                  <Link href="/auth/signup" className="flex-1">
                    <Button className="w-full gradient-bg text-white cursor-pointer">Sign Up</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
