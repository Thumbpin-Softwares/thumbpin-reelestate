import TestimonialCard from "../../components/testimonial-card";

const data = [
    {
        name : "",
        designation : "",
        image : "",
        review : ""
    },
    {
        name : "",
        designation : "",
        image : "",
        review : ""
    },
    {
        name : "",
        designation : "",
        image : "",
        review : ""
    },
];

export default function Testimonial() {
  return (
    <main className="flex flex-col items-center justify-center">
      <div className="flex flex-col items-center justify-center">
        <h1 className="text-4xl tracking-tight">Loved By Real Estate Content Creators</h1>
        <h1 className="text-4xl tracking-tight font-semibold">Loved By Top Rated Real Estate Firms</h1>
      </div>
    </main>
  );
}
