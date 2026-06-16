import { useRef } from "react";

export default function TemplateCard({ template, onClick }) {
  const videoRef = useRef(null);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => videoRef.current?.play()}
      onMouseLeave={() => {
        if (videoRef.current) {
          videoRef.current.pause();

          videoRef.current.currentTime = 0;
        }
      }}
      className="group flex flex-col rounded-2xl border border-neutral-200 overflow-hidden bg-white hover:border-neutral-400 hover:shadow-xl transition-all duration-300 text-left"
    >
      {/* VIDEO */}
      <div className="relative w-full" style={{ aspectRatio: "9/16" }}>
        <video
          ref={videoRef}
          src={template.video}
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300 bg-neutral-900"
        />

        <div className="absolute inset-0 flex items-center justify-center group-hover:opacity-0 transition-opacity duration-200">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white ml-0.5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* TITLE OVER VIDEO */}
        <div className="absolute bottom-2 left-2 right-2">
          <h4 className="text-white text-xs font-semibold leading-snug whitespace-normal wrap-break-words bg-black/40 backdrop-blur-md px-2 py-1 rounded-md">
            {template.title}
          </h4>
        </div>
      </div>
    </button>
  );
}
