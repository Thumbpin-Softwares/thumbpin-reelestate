import LanguagesAnimation from "../../components/LanguagesAnimation";
import AspectRatioAnimation from "../../components/AspectRatioAnimation";

const cards = [
  {
    point: "1",
    tag: "Variety of Avatars",
    title: "20+ AI Avatars",
    images: ["avatar.mp4"],
    description:
      "Diverse Indian faces North, South, East, West. Ethical stock library or upload your own.",
    outcome: "Find the perfect face for every property and audience.",
  },
  {
    point: "2",
    tag: "Indian Accent Voices",
    title: "Choose from variety of languages",
    images: [],
    description:
      "Natural Indian-English voices Mumbai, Delhi, Bangalore, Hyderabad & more.",
    outcome: "Speak to buyers in their preferred language and accent.",
  },
  {
    point: "3",
    tag: "Video Format",
    title: "9:16 Reel Format",
    images: [],
    description:
      "Vertical videos optimized for Instagram Reels, YouTube Shorts etc. 15-30 seconds.",
    outcome: "Ready-to-post videos built for maximum social reach.",
  },
  {
    point: "4",
    tag: "Voiceover",
    title: "Lip-Sync Technology",
    images: ["lip.mp4"],
    description:
      "State-of-the-art AI lip-sync. Your avatars speak naturally with perfect mouth movements.",
    outcome: "Human-like presenters without filming or retakes.",
  },
];

export default function About() {
  function FeatureAnimation({ type }) {
    switch (type) {
      case "Indian Accent Voices":
        return <LanguagesAnimation />;

      case "Video Format":
        return <AspectRatioAnimation />;

      default:
        return null;
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 bg-[#f5f6f0]">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 justify-between items-start lg:items-center">
        <div className="flex flex-col items-start justify-center w-full max-w-xl gap-4">
          <span className="uppercase bg-[#c7f038] px-4 font-bold py-1 rounded-full text-xs sm:text-sm">
            What We Build Live
          </span>

          <h1 className="text-3xl sm:text-4xl font-bold">
            The exact creative workflows we demo for your real estate ad.
          </h1>

          <p className="text-neutral-500 text-sm sm:text-base">
            See how ThumbGram transforms listings and assets into image and
            video ads ready to launch.
          </p>
        </div>

        <div className="bg-neutral-900 shadow-xl rounded-3xl flex flex-col gap-4 p-6 sm:p-8 w-full lg:w-auto">
          <span className="uppercase text-neutral-300 text-sm">
            How It Works
          </span>

          <ul className="flex flex-col gap-3">
            <li className="flex items-center gap-2">
              <span className="bg-[#c7f038] h-6 w-6 rounded-full flex items-center justify-center text-sm font-bold">
                1
              </span>

              <span className="text-neutral-300 text-sm">
                Choose Avatar & Upload Assets
              </span>
            </li>

            <li className="flex items-center gap-2">
              <span className="bg-[#c7f038] h-6 w-6 rounded-full flex items-center justify-center text-sm font-bold">
                2
              </span>

              <span className="text-neutral-300 text-sm">
                Write Your Script
              </span>
            </li>

            <li className="flex items-center gap-2">
              <span className="bg-[#c7f038] h-6 w-6 rounded-full flex items-center justify-center text-sm font-bold">
                3
              </span>

              <span className="text-neutral-300 text-sm">
                Generate & Download
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-12">
        {cards.map((item, index) => (
          <div
            key={index}
            className="flex flex-col md:flex-row bg-white rounded-3xl shadow-xl overflow-hidden"
          >
            {/* Content */}
            <div className="flex-1 p-6 sm:p-8 flex flex-col justify-center gap-4">
              <div className="flex flex-row-reverse items-center justify-between">
                <div className="h-6 w-6 flex items-center justify-center text-xs text-neutral-500 font-semibold">
                  <span>0{item.point}</span>
                </div>

                <span className="text-black bg-[#c6f12f] px-4 py-1 rounded-full text-xs font-bold uppercase">
                  {item.tag}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold max-w-xs">
                {item.title}
              </h2>

              <p className="text-sm text-neutral-500 max-w-xs">
                {item.description}
              </p>

              <div className="border-t border-neutral-200 pt-3 max-w-xs">
                <span className="uppercase text-xs tracking-wide text-neutral-500">
                  Outcome
                </span>

                <p className="text-sm font-semibold mt-1">
                  {item.outcome}
                </p>
              </div>
            </div>

            {/* Media / Animation */}
            <div className="flex items-center justify-center bg-neutral-50 min-h-60 md:min-w-50">
              {item.images.length > 0 ? (
                <video
                  src={item.images[0]}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full/ object-cover md:max-w-50"
                />
              ) : (
                <FeatureAnimation type={item.tag} />
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}