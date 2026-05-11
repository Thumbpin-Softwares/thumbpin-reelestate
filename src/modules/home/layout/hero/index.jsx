import Link from "next/link";

export default function Hero(){
    return(
        <main className="h-screen flex flex-col gap-8 items-center justify-center">
            <h1 className="text-6xl w-3xl text-center tracking-wide text-bold">AI-Powered <span className="bg-clip-text bg-linear-to-br from-olive-700 to-orange-400 text-transparent">ultra-realistic</span> mordern Video Ad platform</h1>
            <p className="w-2xl text-lg text-center">
                Script to Reel instantly. Create viral talking-head videos with AI actors, Indian-accent voices, and lip-sync magic. Made for Indian brands & creators.
            </p>

            <Link href="/auth/signup">
                <span className="text-white bg-black text-md px-6 py-4 hover:opacity-90 cursor-pointer rounded-xl">
                  Get Started Now
                </span>
              </Link>
        </main>
    );
}