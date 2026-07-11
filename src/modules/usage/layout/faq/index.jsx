import Collapsible from "../../components/collapsible";

const data = [
    {
        question : "How do you make a real estate Ad?",
        answer : "Generate your video via our generator. Select a template from a list of templates we have. Choose one and follow the steps and add the data as per the form step. Finally generate the video Ad and you can download the generated video Ad",
    },
    {
        question : "What is the best real estate video ad generator?",
        answer : "There are plenty of real estate video builder out there you can use to create your real estate Ad. However Thumbplay is the easiest and most practical software to use to make your videos. You will have access to many video editing tools that won't find in other video generating apps.",
    }
];

export default function Faq(){
    return(
        <main className="flex flex-col items-center gap-4 justify-center">
            <h1 className="text-4xl pb-8 tracking-tight">FAQs</h1>
            {data.map((item, index) => (
                <Collapsible key={index} question={item.question} answer={item.answer} />
            ))}
        </main>
    );
}