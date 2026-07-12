"use client";

import Link from "next/link";
import { BookOpen, MessageSquarePlus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SupportChat } from "@/modules/dashboard/components/support-chat";
import { RaiseTicket } from "@/modules/dashboard/components/raise-ticket";

const secondaryLinks = [
  {
    title: "Help Center",
    description: "Browse guides and FAQs for common questions about the product.",
    href: "/dashboard/help",
    icon: BookOpen,
  },
  {
    title: "Send feedback",
    description: "Tell us what's working, what's not, and what you'd like to see next.",
    href: "mailto:feedback@thumbpin.ai",
    icon: MessageSquarePlus,
  },
];

export default function SupportPage() {
  return (
    <div>
      <div className="flex flex-col items-start py-12 gap-4 border-b border-neutral-200 text-left">
        <span className="bg-[#c7f038] text-neutral-900 font-medium px-4 py-1.5 rounded-full text-sm">
          Support
        </span>
        <h1 className="text-5xl sm:text-6xl font-bold font-heading tracking-tight">
          How can we help?
        </h1>
        <span className="text-lg text-neutral-500">
          Chat with our team in real time, or raise a ticket for anything that needs deeper follow-up.
        </span>
      </div>

      <div className="py-10">
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="p-1 max-w-full space-x-2 overflow-x-auto justify-start">
            <TabsTrigger value="chat" className="cursor-pointer data-[state=active]:bg-[black] data-[state=active]:text-[#c7f038] px-4 rounded-full py-2 bg-[#c7f038] text-black shrink-0">
              Chat
            </TabsTrigger>
            <TabsTrigger value="ticket" className="cursor-pointer data-[state=active]:bg-[black] data-[state=active]:text-[#c7f038] px-4 rounded-full py-2 bg-[#c7f038] text-black shrink-0">
              Raise a Ticket
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="mt-6">
            <SupportChat />
          </TabsContent>

          <TabsContent value="ticket" className="mt-6">
            <RaiseTicket />
          </TabsContent>
        </Tabs>
      </div>

      <div className="grid sm:grid-cols-2 gap-5 pb-12 text-left border-t border-neutral-200 pt-10">
        {secondaryLinks.map(({ title, description, href, icon: Icon }) => (
          <Link
            key={title}
            href={href}
            className="group flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-all hover:border-[#c7f038] hover:shadow-md"
          >
            <div className="w-12 h-12 rounded-xl bg-neutral-900 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-[#c7f038]" />
            </div>

            <div className="flex-1 space-y-1">
              <h2 className="text-base font-semibold">{title}</h2>
              <p className="text-sm text-neutral-500 leading-relaxed">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
