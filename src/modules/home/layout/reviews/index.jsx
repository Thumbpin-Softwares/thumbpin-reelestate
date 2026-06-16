import { Star } from "lucide-react";

function Stars({ fill, stroke }) {
  return (
    <div className="flex gap-2">
      {[...Array(5)].map((_, index) => (
        <Star key={index} fill={fill} size={14} stroke={stroke} />
      ))}
    </div>
  );
}

export default function Review() {
  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 bg-white">
      {/* TOP SECTION */}
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 justify-between items-start lg:items-end">
        <div className="flex flex-col items-start justify-center w-full max-w-xl gap-4">
          <span className="uppercase bg-[#c7f038] px-4 font-bold py-1 rounded-full text-xs sm:text-sm">
            Client Reviews
          </span>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
            Proof from teams scaling creative faster with ThumbGram.
          </h1>

          <p className="text-neutral-500 text-sm sm:text-base">
            Real growth teams use ThumbGram to ship more creative, test more
            angles, and put budget toward what converts.
          </p>
        </div>

        <div className="bg-neutral-900 shadow-xl rounded-3xl flex flex-col gap-2 p-6 sm:p-8 w-full lg:w-auto">
          <span className="uppercase text-neutral-300 text-sm">
            Average Rating
          </span>

          <div className="flex justify-between items-center">
            <h1 className="text-4xl text-white font-black">4.9</h1>
            <Stars fill="#c7f038" stroke="#c7f038" />
          </div>

          <ul className="flex flex-col gap-3 border-t pt-4 border-t-neutral-600">
            {[
              "More creative output without adding to the production budget",
              "Go from idea to live ad in minutes",
              "Image, video, and UGC in one platform",
            ].map((text, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="bg-[#c7f038] h-6 w-6 rounded-full flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </span>
                <span className="text-neutral-300 text-sm w-full sm:w-64">
                  {text}
                </span>
              </li>
            ))}
          </ul>

          <div className="py-2">
            <span className="text-neutral-500 text-sm">
              Based on 2,400+ verified reviews across real estate firms and
              performance marketing teams.
            </span>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION */}
      <div className="flex flex-col lg:flex-row pt-12 gap-6">
        {/* Featured Story */}
        <div className="w-full lg:flex-1 flex flex-col gap-8 p-6 bg-[#f5f6f0] border border-neutral-300 rounded-3xl">
          <div className="flex items-center justify-between">
            <span className="bg-white px-4 py-1 rounded-full border uppercase font-bold border-neutral-300 text-xs">
              Featured Story
            </span>
            <Stars fill="black" stroke="black" />
          </div>

          <p className="text-lg sm:text-xl lg:text-2xl">
            “ThumbGram cut our creative turnaround from days to minutes. We can
            launch more angles, react faster to what is working, and scale
            performance without growing the team behind the ads.”
          </p>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              ["$1M", "ARR in 4 months"],
              ["160%", "increase in sales"],
              ["3x", "higher ROI"],
            ].map(([value, label], i) => (
              <div
                key={i}
                className="border border-neutral-300 rounded-3xl p-4 bg-white"
              >
                <h1 className="font-black text-xl">{value}</h1>
                <span className="text-xs text-neutral-500">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column */}
        <div className="w-full lg:flex-1 flex flex-col gap-4">
          {[
            {
              brand: "Brandboost",
              text: "We scaled creative output without adding headcount. ThumbGram gives us launch-ready ads that stay on-brand and ready for testing.",
              stats: [
                ["$2.4M", "revenue generated"],
                ["240%", "lift in ROAS"],
              ],
            },
            {
              brand: "ScalerX",
              text: "The platform paid for itself fast. We replaced slow agency cycles with a workflow that helps us test more creative and move on winners earlier.",
              stats: [
                ["$500K", "saved in agency fees"],
                ["4x", "campaign velocity"],
              ],
            },
          ].map((card, i) => (
            <div
              key={i}
              className="bg-white flex flex-col gap-4 border border-neutral-300 p-6 rounded-3xl"
            >
              <div className="flex items-center justify-between">
                <span className="bg-[#c9f036] px-4 py-1 rounded-full uppercase font-bold text-xs">
                  {card.brand}
                </span>
                <Stars fill="black" stroke="black" />
              </div>

              <p className="text-lg sm:text-xl">{card.text}</p>

              <div className="grid grid-cols-2 gap-3">
                {card.stats.map(([value, label], j) => (
                  <div
                    key={j}
                    className="border border-neutral-300 rounded-3xl bg-[#f5f6f0] p-4"
                  >
                    <h1 className="font-black text-xl">{value}</h1>
                    <span className="text-xs text-neutral-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}