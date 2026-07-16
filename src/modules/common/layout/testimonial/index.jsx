"use client";

import { motion } from "framer-motion";
import TestimonialCard from "../../components/testimonial-card";

const data = [
  {
    name: "Raman Uppal",
    designation: "360 Relators",
    review:
      "Before Thumbplay, we waited days for agencies to deliver a single real estate video. Now, my marketing team inputs a property listing, picks a Mumbai-accented avatar, and walks away with a launch-ready Instagram Reel in under 15 minutes. It completely eliminated our agency bottleneck.",
  },
  {
    name: "Priya Mehta",
    designation: "Skyline Realty Partners",
    review:
      "We target mid-segment buyers in Pune and luxury buyers in South Mumbai, and standard US/UK AI accents simply failed to connect. Thumbplay’s regional Indian-English accents sound completely natural. The lip-sync is so perfect that our prospects think we hired professional local actors.",
  },
  {
    name: "Arjun Bansal",
    designation: "BrickNest Properties",
    review:
      "In performance marketing, you need to test dozens of angles to find a winner. Thumbplay lets us clone competitor styles and generate 10 different versions of a property walkthrough in one afternoon. Our ROAS jumped by 2.4x because we can iterate instantly.",
  },
  {
    name: "Neha Kapoor",
    designation: "UrbanKey Realty",
    review:
      "Most tools lock their best features behind a paywall immediately. Being able to test the AI script generator and avatar quality for free gave us the confidence to sign up our entire brokerage. The 4.9 rating is fully earned.",
  },
  {
    name: "Vikram Choudhary",
    designation: "Aarambh Estates",
    review:
      "To sell our projects in Lucknow and Indore, we needed ads in Hinglish and pure Hindi. Thumbplay’s multi-language engine handled the script effortlessly. We didn't have to hire translators or voiceover artists, saving us both massive production delays and budgets.",
  },
  {
    name: "Ishita Nair",
    designation: "PrimeSquare Developers",
    review:
      "In Indian real estate, speed to market is everything. The moment our project gets RERA clearance, we input the details into Thumbplay, choose a North Indian avatar, and generate 10 vertical Reels for Instagram and YouTube Shorts. What used to take our agency two weeks now gets done before tea.",
  },
];

export default function Testimonial() {
  const carouselItems = [...data, ...data];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col items-center overflow-hidden px-4 py-12 sm:px-6">
      <div className="mb-10 text-center">
        <p className="text-2xl tracking-tight text-neutral-600 sm:text-3xl">
          Loved By Real Estate Content Creators
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Loved By Top Rated Real Estate Firms
        </h1>
      </div>

      <div className="relative w-full overflow-hidden">
        <motion.div
          className="flex w-max will-change-transform"
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            duration: 36,
            ease: "linear",
            repeat: Infinity,
          }}
        >
          {carouselItems.map((item, index) => (
            <div
              key={`${item.name}-${index}`}
              className="w-72.5 flex-none pr-4 sm:w-85"
            >
              <TestimonialCard
                review={item.review}
                name={item.name}
                designation={item.designation}
              />
            </div>
          ))}
        </motion.div>
      </div>
    </main>
  );
}