import Link from "next/link";
import TextCarousel from "../../components/text-carousal";

export default function Cta() {
  return (
    <section className="max-w-6xl mx-4 sm:mx-6 lg:mx-auto bg-neutral-900 py-10 md:py-16 rounded-3xl overflow-hidden">
      <div className="flex flex-col items-center justify-center gap-4 px-6">
        <div className="bg-[#c7f038] px-5 py-1 rounded-full">
          <span className="uppercase font-bold text-xs sm:text-sm text-black">
            Free Demo
          </span>
        </div>

        <h1 className="text-white max-w-4xl text-center font-semibold leading-tight text-4xl sm:text-5xl lg:text-6xl">
          Your Next{" "}
          <span className="px-2 py-1 text-black bg-[#c7f038] font-bold italic rounded">
            Winning
          </span>{" "}
          Ad is 15 Minutes Away.
        </h1>

        <div className="py-6 md:py-8 flex flex-col items-center gap-4">
          <Link
            href="/auth/signup"
            className="bg-[#c7f038] px-6 py-3 md:px-8 md:py-4 rounded-xl text-base md:text-lg font-semibold"
          >
            Get Started Here
          </Link>

          <span className="text-neutral-500 text-xs sm:text-sm text-center">
            No commitment, We confirm within 24 hrs
          </span>
        </div>

        <div className="w-full overflow-hidden">
          <TextCarousel
            texts={[
              "AI Video Generation",
              "Real Estate Ads",
              "Real Estate Creatives",
              "UGC Creatives",
              "Performance Creatives",
              "Creator Style Videos",
              "Social Media Ads",
              "Video Ads At Scale",
            ]}
            direction="left"
          />
        </div>

        <div className="w-full overflow-hidden">
          <TextCarousel
            texts={[
              "Static Image Ads",
              "Winner-Based Recommendations",
              "AI Script Generation",
              "AI Voiceover",
              "Performance Creatives",
              "Creator Style Videos",
              "Social Media Ads",
              "Video Ads At Scale",
            ]}
            direction="right"
          />
        </div>
      </div>
    </section>
  );
}