import { RectangleGoggles } from "lucide-react";
import Link from "next/link";

const fields = [
  {
    title: "Product",
    headings: ["Features", "Pricing"],
    links: ["/", "/"],
  },
  {
    title: "Company",
    headings: ["About", "Blog", "Careers"],
    links: ["/", "/", "/"],
  },
  {
    title: "Resources",
    headings: ["Documentation", "Support", "Contact"],
    links: ["/", "/", "/"],
  },
];

const tags = [
  "Best Ads for real estate",
  "AI Ads Generator",
  "Video Ads",
  "AI Ad Maker",
  "Facebook Ads",
  "Instagram Ads",
  "Copyright Free Images",
  "AI Videos",
];

export default function Footer() {
  return (
    <main className="bg-neutral-900 text-white">
      <div className="flex items-center justify-between px-24 py-8">
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 items-center">
            <div className="bg-[#c7f038] flex items-center justify-center p-2 inset-shadow-sidebar-primary-foreground rounded-full">
              <RectangleGoggles
                className="w-8 h-8"
                fill="black"
                stroke="none"
              />
            </div>
            <span className="text-xl text-white">ThumbGram</span>
          </div>
          <p className="text-sm max-w-sm text-neutral-300">
            AI-powered UGC video ad generator, built for Indian creators &
            brands.
          </p>
        </div>
        <div className="flex gap-12">
          {fields.map((item, index) => (
            <div className="text-white" key={index}>
              {item.title}
              <ul className="py-4 text-neutral-500">
                {item.headings.map((subitem, subindex) => (
                  <li className="" key={subindex}>
                    <Link href={item.links[subindex]}>{subitem}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center py-4 border-t border-b border-t-neutral-600 border-b-neutral-600">
        <ul className="w-2xl flex flex-wrap items-center justify-center">
          {tags.map((item, index) => (
            <li className="text-neutral-500 px-2 text-sm" key={index}>
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="py-4 px-24 flex items-center justify-between">
        <span className="text-neutral-500 text-sm">
          © 2026 ThumbGram. All rights reserved.
        </span>
        <ul className="flex gap-4 text-neutral-500 text-sm items-center justify-center">
          <li>
            <Link href="/">Privacy Policy</Link>
          </li>
          <li>
            <Link href="/">Terms & Conditions</Link>
          </li>
        </ul>
      </div>
    </main>
  );
}
