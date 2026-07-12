import Collapsible from "../../components/collapsible";

const data = [
    {
        question : "How do you make a real estate Ad?",
        answer : "Generate your video via our generator. Select a template from a list of templates we have. Choose one and follow the steps and add the data as per the form step. Finally generate the video Ad and you can download the generated video Ad",
    },
    {
        question : "What is the best real estate video ad generator?",
        answer : "There are plenty of real estate video builder out there you can use to create your real estate Ad. However Thumbplay is the easiest and most practical software to use to make your videos. You will have access to many video editing tools that won't find in other video generating apps.",
    },
    {
        question : "Can I edit a video after creating it?",
        answer : "Yes, the platform includes an \"Edit\" tab in the sidebar menu where you can manage and adjust your projects. ",
    },
    {
        question : "Where can I find my previously generated videos?",
        answer : "All your saved videos and assets are stored in the \"Library\" section accessible from the left-hand navigation menu. ",
    },
    {
        question : "What should I do if I get stuck while creating an Ad?",
        answer : "You can click on the \"Help Center\" tab for documentation or use the \"Chat with us\" option in the sidebar to get direct support.",
    },
    {
        question : "Can I use my own avatar or presenter?",
        answer : "Yes. You can browse the platform's library of Real Estate (RE) agents, upload your own custom presenter, or choose from your previously saved assets.",
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