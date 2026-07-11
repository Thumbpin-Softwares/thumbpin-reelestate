import Image from "next/image";

export default function HowToCard({ image, step, title, description }) {
  return (
    <main className="bg-black p-8 rounded-3xl w-84 h-120 flex flex-col items-center justify-between">
      {image ? (
        <Image
          src={image}
          alt={title || "Illustration"}
          height={400}
          width={400}
        />
      ) : null}
      <div className="w-full flex flex-col gap-8 items-start justify-between h-48">
        <div className="">
          <span className="text-neutral-400 font-semibold">{step}</span>
          <h1 className="text-white font-semibold text-2xl">{title}</h1>
        </div>
        <p className="text-neutral-400 text-justify text-sm">{description}</p>
      </div>
    </main>
  );
}
