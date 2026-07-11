"use client";
import {
  Scissors,
  Crop,
  Trash2,
  Play,
  Volume,
  X,
  ChevronDown,
  Sparkles,
  ImagePlus,
  Type,
  Trash2Icon,
  GripVertical,
  Eye,
} from "lucide-react";
import { useEffect, useState } from "react";
import gsap from "gsap";

export default function Feature() {
  const [volumeLevel, setVolumeLevel] = useState(12);

  useEffect(() => {
    const obj = { v: 12 };
    const tween = gsap.to(obj, {
      v: 100,
      duration: 2.5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      onUpdate: () => setVolumeLevel(Math.round(obj.v)),
    });
    return () => tween.kill();
  }, []);

  return (
    <main className="py-12 space-y-14">
      <div className="flex items-center justify-between gap-6">
        <div className="flex w-2xl flex-col items-center justify-center gap-4">
          <h1 className="text-xl font-light tracking-tight">
            Editing essentials
          </h1>
          <div className="bg-neutral-100 flex gap-6 p-4 rounded-3xl drop-shadow-lg ring-2 ring-neutral-200">
            <div className="bg-black ring-3 ring-neutral-400 duration-300 p-6 rounded-2xl drop-shadow-xl">
              <Scissors size={24} color="#c7f038" />
            </div>
            <div className="bg-black ring-3 ring-neutral-400 duration-300 p-6 rounded-2xl drop-shadow-xl">
              <Crop size={24} color="#c7f038" />
            </div>
            <div className="bg-black ring-3 ring-neutral-400 duration-300 p-6 rounded-2xl drop-shadow-xl">
              <Trash2 size={24} color="#c7f038" />
            </div>
          </div>
          <h1 className="font-light tracking-tight">Everything at one place</h1>
        </div>
        <div className="w-xl space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight">
            Trim, Cut and delete segments from your Ad
          </h1>
          <p className="text-justify text-neutral-600">
            Our intuitive editing suite gives you complete control over every
            ad. Instantly trim scenes, remove unwanted moments, and fine-tune
            your video with professional tools designed for speed and
            simplicity. Everything you need to transform an AI-generated draft
            into a polished, high-converting real estate ad is available in one
            seamless workspace.
          </p>
        </div>
      </div>

      <div className="flex items-center flex-row-reverse gap-4">
        <div className="flex w-2xl flex-col items-center justify-center gap-4">
          <h1 className="text-xl font-light tracking-tight">
            Add music of your taste
          </h1>
          <div className="bg-neutral-100 w-84 flex flex-col gap-2 p-4 rounded-3xl drop-shadow-lg ring-2 ring-neutral-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="bg-black flex w-fit p-2 rounded-full">
                  <Play fill="black" stroke="white" size={18} />
                </div>
                <span>Music 1</span>
                <div className="bg-black text-white px-4 py-2 text-sm rounded-lg">
                  Use
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="bg-black flex w-fit p-2 rounded-full">
                    <Play fill="black" stroke="white" size={18} />
                  </div>
                  <span>Music 2</span>
                  <div className="bg-[#c7f038] text-black px-4 py-2 text-sm rounded-lg">
                    Selected
                  </div>
                </div>

                <div className="bg-neutral-100 flex flex-col gap-4 ring-2 rounded-xl ring-neutral-200 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400 text-xs">0:00</span>
                    <span className="text-neutral-400 text-xs">1:00</span>
                  </div>
                  <div className="relative flex h-12 overflow-hidden rounded-lg bg-neutral-200">
                    <div className="w-32 bg-[#c7f038]/50" />
                    <div className="flex-1 bg-neutral-300/50" />

                    <div className="absolute inset-0 flex items-center gap-0.5 px-2 opacity-70">
                      {Array.from({ length: 68 }).map((_, i) => {
                        const heights = [4, 18, 7, 12, 8, 24, 22, 12];
                        return (
                          <div
                            key={i}
                            className="w-0.5 rounded-full bg-black/50"
                            style={{
                              height: `${heights[i % heights.length]}px`,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-neutral-400 flex items-center">
                      <Volume size={18} />
                      Volume ({volumeLevel}%)
                    </span>
                    <div className="flex h-2 overflow-hidden rounded-full">
                      <div
                        className="bg-[#c7f038] transition-[width] duration-75"
                        style={{ width: `${volumeLevel}%` }}
                      />
                      <div className="flex-1 bg-neutral-300/50" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 justify-between">
                    <div className="flex w-full items-center justify-center gap-2 bg-[#c7f038] py-2 rounded-lg text-sm">
                      <Play stroke="black" size={16} />
                      Show Preview
                    </div>
                    <div className="w-8 bg-red-500 p-2 rounded-lg">
                      <X size={18} color="white" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="bg-black flex w-fit p-2 rounded-full">
                  <Play fill="black" stroke="white" size={18} />
                </div>
                <span>Music 3</span>
                <div className="bg-black text-white px-4 py-2 text-sm rounded-lg">
                  Use
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="bg-black flex w-fit p-2 rounded-full">
                  <Play fill="black" stroke="white" size={18} />
                </div>
                <span>Music 4</span>
                <div className="bg-black text-white px-4 py-2 text-sm rounded-lg">
                  Use
                </div>
              </div>
            </div>
          </div>
          <h1 className="font-light tracking-tight">
            100+ non copyright music to choose from{" "}
          </h1>
        </div>
        <div className="w-2xl space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight">
            Personalize Every Ad with the Perfect Soundtrack
          </h1>
          <p className="text-justify text-neutral-600">
            Set the mood of your property showcase with a curated library of
            royalty-free music. Browse tracks, preview them instantly, and
            choose the soundtrack that best matches your brand and the home
            you’re presenting. Fine-tune the volume and timing to create a
            polished, engaging video that captures attention and leaves a
            lasting impression.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-6">
        <div className="flex w-2xl flex-col items-center justify-center gap-4">
          <h1 className="text-xl font-light tracking-tight">
            Add your captions
          </h1>
          <div className="relative flex items-center pl-16">
            <div className="aspect-9/16 w-64 rounded-[28px] bg-black shadow-2xl ring-4 ring-neutral-800 relative overflow-hidden">
              <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-md bg-black/70 px-1 py-1 text-sm text-white border border-white/50">
                Your caption here
              </div>
            </div>
            <div className="-ml-38 bg-neutral-100 w-78 flex flex-col gap-2 p-4 rounded-3xl drop-shadow-lg ring-2 ring-neutral-200 relative z-10">
              <div className="py-2">
                <div className="space-y-2">
                  <span className="text-neutral-600 text-xs">
                    Text Position
                  </span>
                  <div className="flex items-center gap-2 justify-between">
                    <div className="w-full text-center border text-sm py-1 border-black rounded-md bg-black text-[#c5f037]">
                      Top
                    </div>
                    <div className="w-full text-center border text-sm py-1 border-neutral-300 rounded-md">
                      Middle
                    </div>
                    <div className="w-full text-center border text-sm py-1 border-neutral-300 rounded-md">
                      Bottom
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-neutral-600 text-xs">
                    Source Language
                  </span>
                  <div className="w-full flex items-center justify-between px-2 border text-sm py-1 text-neutral-600 border-neutral-300 rounded-md">
                    Auto Detect <ChevronDown size={16} />
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-neutral-600 text-xs">
                    Translate Captions To
                  </span>
                  <div className="w-full flex items-center justify-between px-2 border text-sm py-1 text-neutral-600 border-neutral-300 rounded-md">
                    English <ChevronDown size={16} />
                  </div>
                </div>
              </div>
              <div className="text-[#c7f03a] gap-2 bg-black flex items-center justify-center rounded-lg py-2 text-sm">
                <Sparkles size={16} color="#c7f03a" />
                Add Captions
              </div>
            </div>
          </div>
          <h1 className="font-light tracking-tight">
            Choose from 20+ styles of captions
          </h1>
        </div>
        <div className="w-2xl space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight">
            Generate Captions That Reach Every Viewer
          </h1>
          <p className="text-justify text-neutral-600">
            Make your property videos more engaging and accessible with
            AI-powered captions. Automatically generate subtitles, choose their
            placement and style, and translate them into multiple languages in
            seconds. With beautifully formatted captions, your message stays
            clear and compelling—even when viewers watch with the sound off.
          </p>
        </div>
      </div>

      <div className="flex flex-row-reverse items-center justify-between gap-6">
        <div className="flex w-2xl flex-col items-center justify-center gap-4">
          <h1 className="text-xl font-light tracking-tight">
            Add text overlays and logos
          </h1>
          <div className="bg-neutral-100 w-78 flex flex-col gap-2 p-4 rounded-3xl drop-shadow-lg ring-2 ring-neutral-200 relative z-10">
            <div className="py-2 space-y-2">
              <div className="space-y-2">
                <span className="text-neutral-600 text-xs">Overlays</span>
                <div className="flex items-center gap-2 justify-between">
                  <div className="w-full flex items-center justify-center gap-2 border text-sm py-1 border-black rounded-md bg-black text-[#c5f037]">
                    <Type size={16} color="#c5f037" />
                    Add Text
                  </div>
                  <div className="w-full flex items-center justify-center gap-2 border text-sm py-1 border-neutral-300 rounded-md">
                    <ImagePlus size={16} color="black" />
                    Add Image
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-xs text-neutral-600">Layers</span>
                <div className="flex items-center p-1 rounded-lg justify-between bg-black text-white">
                  <GripVertical size={16} color="#a1a1a1" />
                  <span className="flex text-sm items-center text-neutral-400 gap-2">
                    <Type size={16} color="#a1a1a1" />
                    Text 1
                  </span>
                  <div className="flex gap-2">
                    <Eye color="#a1a1a1" size={16} />
                    <Trash2Icon color="#a1a1a1" size={16} />
                  </div>
                </div>
                <div className="ring-2 ring-neutral-200 p-4 rounded-2xl space-y-2">
                  <div className="">
                    <span className="text-xs text-neutral-600">Text</span>
                    <div className="w-full text-sm h-12 border border-neutral-200 p-2 rounded-lg">
                      Your Text Here
                    </div>
                  </div>
                  <div className="">
                    <span className="text-xs text-neutral-600">Font</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="font-sans text-center text-xs rounded-sm bg-black border border-black text-[#c7f03b] py-1">
                        Sans
                      </div>
                      <div className="font-serif text-center text-xs rounded-sm border border-neutral-300 text-black py-1">
                        Serif
                      </div>
                      <div className="font-mono text-center text-xs rounded-sm border border-neutral-300 text-black py-1">
                        Mono
                      </div>
                      <div className="font-trebuchet text-center text-xs rounded-sm border border-neutral-300 text-black py-1">
                        Trebuchet
                      </div>
                      <div className="font-verdana text-center text-xs rounded-sm border border-neutral-300 text-black py-1">
                        Verdana
                      </div>
                      <div className="font-impact text-center text-xs rounded-sm border border-neutral-300 text-black py-1">
                        Impact
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-red-500 gap-2 border border-red-500 flex items-center justify-center rounded-lg py-2 text-sm">
              <Trash2Icon size={16} color="#fb2c36" />
              Remove
            </div>
          </div>
          <h1 className="font-light tracking-tight">
            Add your own text and logo on your Ad
          </h1>
        </div>
        <div className="w-2xl space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight">
            Elevate Every Video with Custom Branding
          </h1>
          <p className="text-justify text-neutral-600">
            Add your logo, text, and graphic overlays to ensure every property
            video reflects your brand identity. Position and style elements
            exactly where you want them, highlight key property details, and
            create a polished, professional look that makes your listings
            instantly recognizable across every platform.
          </p>
        </div>
      </div>
    </main>
  );
}
