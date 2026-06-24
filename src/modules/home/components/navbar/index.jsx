"use client";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  RectangleGoggles,
  Menu,
  X,
  LayoutDashboard,
} from "lucide-react";

const navItems = [
  { title: "Product", link: "#how" },
  { title: "Use Cases", link: "#testimonials" },
  { title: "Resources", link: ""},
  { title: "Pricing", link: "#pricing" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-none border-b border-b-neutral-200">
      
      {/* Top banner */}
      <div className="flex items-center justify-center bg-black py-2 px-4 text-center">
        <h1 className="text-white text-xs sm:text-sm">
          Your next winning ad? We’ll build it.{" "}
          <Link href="/" className="underline underline-offset-4">
            Work with us
          </Link>
        </h1>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-black p-2 rounded-full flex items-center justify-center">
              <RectangleGoggles className="w-4 h-4" fill="#c7f038" />
            </div>
            <span className="text-lg sm:text-xl font-semibold">
              ThumbGram
            </span>
          </Link>

          {/* Desktop Nav */}
          <ul className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <li key={item.title}>
                <Link
                  href={item.link}
                  className="hover:text-neutral-600 transition"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/app">
                <span className="bg-linear-to-b from-black to-neutral-600 text-white py-2 px-4 flex items-center gap-2 rounded-full shadow">
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </span>
              </Link>
            ) : (
              <>
                <Link href="/auth/login">
                  <span className="px-4 py-2 rounded-full">
                    Login
                  </span>
                </Link>
                <Link href="/auth/signup">
                  <span className="bg-linear-to-b from-black to-neutral-600 text-white px-4 py-2 rounded-full shadow-lg">
                    Sign Up
                  </span>
                </Link>
              </>
            )}
          </div>

          {/* Mobile CTA + Button */}
          <div className="md:hidden flex items-center gap-2">
            {isAuthenticated ? (
              <Link href="/app" className="">
                <span className="bg-linear-to-b from-black to-neutral-600 text-white text-sm py-2 px-4 flex items-center justify-center rounded-full shadow">
                  Dashboard
                </span>
              </Link>
            ) : (
              <Link href="/auth/signup">
                <span className="bg-linear-to-b from-black to-neutral-600 text-white px-4 py-2 rounded-full shadow text-xs">
                  Start Free
                </span>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden pb-6 pt-2 space-y-3">

            {/* nav links */}
            <div className="flex flex-col gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.title}
                  href={item.link}
                  onClick={() => setMobileOpen(false)}
                  className="py-2 text-sm text-neutral-700 hover:text-black"
                >
                  {item.title}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}