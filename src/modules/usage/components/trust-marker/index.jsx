import Image from "next/image";

const Img = [
  "/usage/trust-marker/1.avif",
  "/usage/trust-marker/2.avif",
  "/usage/trust-marker/3.avif",
];

export default function TrustMarker() {
  return (
    <main className="flex gap-4 items-center">
      <div className="flex items-center gap-1.25">
        {Img.map((items, index) => (
          <div
            key={index}
            className="relative h-8 w-8 border border-black/25 overflow-hidden rounded-full"
          >
            <Image
              src={items}
              alt="actor asset"
              fill
              className="object-cover"
            />
          </div>
        ))}
      </div>
      <h1 className="text-neutral-600 text-sm">
        Trusted by 10k+ real estate agents
      </h1>
    </main>
  );
}
