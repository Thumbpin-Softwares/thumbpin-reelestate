import Link from "next/link";

export default function Hero(){
    return(
        <main className="h-[70vh] bg-[#f5efe8] flex flex-col gap-2 items-center justify-center">
            <h1 className="text-[42px] w-4xl text-center tracking-wide font-bold">Create <span className="bg-[#c7f038] px-2 py-1 rounded text-black">Winning</span> Ads in Minutes.</h1>
            <p className="w-xl text-md text-center">
                In 15 minutes, we'll turn your product URL into live ads, clone a competitor creative, and show you what's winning in your niche.
            </p>

            <div className="pt-6 flex gap-2 items-center justify-center">
                <Link href="/auth/signup">
                <span className="text-black bg-[#c7f038] text-md px-6 py-4 hover:opacity-90 cursor-pointer rounded-lg shadow-sm font-bold">
                  Get Started Now
                </span>
            </Link>

            <span className="text-xs text-neutral-400">No credit card · Free to start</span>
            </div>
        </main>
    );
}