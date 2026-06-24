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
    <footer className="bg-neutral-200 text-neutral-800">
      {/* Top Section */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24 py-8 flex flex-col lg:flex-row gap-12 lg:gap-0 items-start lg:items-center justify-between">
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 items-center">
            <div className="bg-black flex items-center justify-center p-2 rounded-full">
              <RectangleGoggles
                className="w-8 h-8"
                fill="#c7f038"
                stroke="none"
              />
            </div>

            <span className="text-xl">ThumbGram</span>
          </div>

          <p className="text-sm max-w-sm text-neutral-800">
            AI-powered UGC video ad generator, built for Indian creators &
            brands.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 sm:gap-12">
          {fields.map((item, index) => (
            <div key={index}>
              <h3 className="font-medium">{item.title}</h3>

              <ul className="mt-4 space-y-2">
                {item.headings.map((subitem, subindex) => (
                  <li key={subindex}>
                    <Link
                      href={item.links[subindex]}
                      className="text-neutral-500 hover:text-white transition-colors"
                    >
                      {subitem}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className="border-y border-neutral-700">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24 py-4">
          <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            {tags.map((item, index) => (
              <li
                key={index}
                className="text-neutral-500 text-sm"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24 py-4 flex flex-col sm:flex-row gap-4 sm:gap-0 items-center justify-between">
        <span className="text-neutral-500 text-sm text-center sm:text-left">
          © 2026 ThumbGram. All rights reserved.
        </span>

        <ul className="flex flex-wrap justify-center gap-4 text-neutral-500 text-sm">
          <li>
            <Link href="/">Privacy Policy</Link>
          </li>

          <li>
            <Link href="/">Terms & Conditions</Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}