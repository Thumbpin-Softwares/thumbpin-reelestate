import HowToCard from "../../components/how-to-card";

const data = [
    {
        title : "Upload Your assets",
        step : "Step 01",
        descrption : "Upload your assets such as property images and model photographs you can choose model from the existing collection also. Click on generate to obtain your real estate video ad.",
        img : "/usage/guide/1.avif",
    },
    {
        title : "Edit your generated ad",
        step : "Step 02",
        descrption : "Click on the edit panel on the menu and select the ad you wanna edit. Edit your video add the cuts, trim the segments, add the music from a wide collection of music and add the subtitles on your video",
        img : "/usage/guide/2.avif",
    },
    {
        title : "Export your Ad",
        step : "Step 03",
        descrption : "When you're happy with your ad just click 'Export' and your video will be downloaded on your device",
        img : "/usage/guide/3.avif",
    }
];

export default function Guide(){
    return(
        <main className="flex flex-col gap-8 items-center justify-center">
            <h1 className="text-6xl font-semibold tracking-tight">How to create a real estate Ad</h1>
            <div className="flex flex-row gap-4">
                {data.map((item, index) => (
                    <HowToCard key={index} title={item.title} description={item.descrption} image={item.img} step={item.step} />
                ))}
            </div>
        </main>
    );
}