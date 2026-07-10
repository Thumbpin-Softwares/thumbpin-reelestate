import TrustMarker from "../../components/trust-marker";
import Image from "next/image";
import { VideoIcon, Scissors, Music, Captions } from "lucide-react";

export default function Hero(){
    return(
        <main className="flex items-center justify-between">
            <div className="flex flex-col gap-4 w-lg">
                <TrustMarker />
                <h1 className="text-6xl font-semibold tracking-tight">Real Estate Video Ad maker</h1>
                <span className="text-neutral-600 text-sm">Create beautiful real estate ads with just a few clicks that are perfect for you</span>

                <div>
                    
                </div>
            </div>
            <div className="flex items-center justify-center gap-4">
                <div className="flex flex-col gap-2 bg-neutral-100/50 rounded-xl ring-2 ring-neutral-200/50 p-4">
                    <div className="flex gap-0.5 flex-col p-4 items-center justify-center rounded-xl bg-[#c7f03b]">
                        <VideoIcon />
                        <span className="text-xs">Genrator</span>
                    </div>
                    <div className="flex gap-0.5 flex-col p-4 items-center justify-center rounded-xl bg-black text-[#c7f03b]">
                        <Scissors />
                        <span className="text-xs">Editor</span>
                    </div>
                    <div className="flex gap-0.5 flex-col p-4 items-center justify-center rounded-xl bg-black text-[#c7f03b]">
                        <Music />
                        <span className="text-xs">Music</span>
                    </div>
                    <div className="flex gap-0.5 flex-col p-4 items-center justify-center rounded-xl bg-black text-[#c7f03b]">
                        <Captions />
                        <span className="text-xs">Subtitle</span>
                    </div>
                </div>
                <Image src="/usage/hero/1.webp" width={300} height={300} alt="real estate" />
            </div>
        </main>
    );
}