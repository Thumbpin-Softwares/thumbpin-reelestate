"use client";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  RectangleGoggles,
  Menu,
  X,
  LayoutDashboard,
  ChevronDown,
  Wand2,
  Film,
} from "lucide-react";

// Add entries here to populate the "Product" dropdown, e.g.
// { title: "Home Tour", link: "/dashboard/home-tour", description: "..." }
const PRODUCT_DROPDOWN_ITEMS = [
  {
    title: "Real Estate Ad Generator",
    link: "/dashboard",
    description: "Create AI-powered property video ads.",
    icon: Wand2,
  },
  {
    title: "Ad Editor",
    link: "/dashboard/edit",
    description: "Fine-tune and polish your generated ads.",
    icon: Film,
  },
];

const navItems = [
  { title: "Product", dropdown: true, items: PRODUCT_DROPDOWN_ITEMS },
  { title: "Use Cases", link: "/testimonials" },
  { title: "Resources", link: "/resources"},
  { title: "Pricing", link: "/pricing" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileProductOpen, setMobileProductOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
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

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-black p-2 rounded-full flex items-center justify-center">
              <RectangleGoggles className="w-4 h-4" fill="#c7f038" />
            </div>
            <span className="text-lg sm:text-xl font-medium">
              Thumbplay.ai
            </span>
          </Link>

          {/* Desktop Nav */}
          <ul className="hidden md:flex items-center gap-8">
            {navItems.map((item) => {
              if (item.dropdown) {
                return (
                  <li
                    key={item.title}
                    onMouseEnter={() => setProductOpen(true)}
                    onMouseLeave={() => setProductOpen(false)}
                  >
                    <DropdownMenu open={productOpen} onOpenChange={setProductOpen}>
                      <DropdownMenuTrigger className="flex items-center gap-1 hover:text-neutral-600 transition outline-none">
                        {item.title}
                        <ChevronDown className="w-3.5 h-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-[360px] rounded-[28px] border border-[#c7f038]/30 bg-white/85 p-3 backdrop-blur-2xl shadow-[0_30px_80px_rgba(199,240,56,0.18)] before:absolute before:inset-0 before:rounded-[28px] before:bg-[radial-gradient(circle_at_top_right,rgba(199,240,56,0.18),transparent_45%)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
                        {item.items.length === 0 ? (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            Coming soon
                          </div>
                        ) : (
                          item.items.map((sub) => (
                            <DropdownMenuItem key={sub.title} asChild className="rounded-xl p-0 focus:bg-transparent">
                              <Link href={sub.link} className="flex items-center gap-3 rounded-xl p-3 hover:bg-[#f8fce8] hover:scale-[1.02] transition-all duration-200">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black">
                                  <sub.icon className="h-5 w-5 text-[#c7f038]" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-medium black">{sub.title}</span>
                                  <span className="text-xs text-neutral-600">{sub.description}</span>
                                </div>
                              </Link>
                            </DropdownMenuItem>
                          ))
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                );
              }
              return (
                <li key={item.title}>
                  <Link
                    href={item.link}
                    className="hover:text-neutral-600 transition"
                  >
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard">
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
              <Link href="/dashboard" className="">
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
          <div className="absolute left-4 right-4 top-full mt-2 md:hidden rounded-2xl border border-[#c7f038]/20 bg-white/95 p-4 shadow-xl backdrop-blur-xl">

            {/* nav links */}
            <div className="flex flex-col gap-2">
              {navItems.map((item) =>
                item.dropdown ? (
                  <div key={item.title}>
                    <button
                      type="button"
                      onClick={() => setMobileProductOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between py-2 text-sm text-neutral-700 hover:text-black"
                    >
                      {item.title}
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${mobileProductOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {mobileProductOpen && (
                      <div className="flex flex-col gap-1 pl-3 pb-1">
                        {item.items.length === 0 ? (
                          <span className="py-1.5 text-xs text-muted-foreground">
                            Coming soon
                          </span>
                        ) : (
                          item.items.map((sub) => (
                            <Link
                              key={sub.title}
                              href={sub.link}
                              onClick={() => setMobileOpen(false)}
                              className="py-1.5 text-sm text-neutral-600 hover:text-black"
                            >
                              {sub.title}
                            </Link>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    key={item.title}
                    href={item.link}
                    onClick={() => setMobileOpen(false)}
                    className="py-2 text-sm text-neutral-700 hover:text-black"
                  >
                    {item.title}
                  </Link>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}