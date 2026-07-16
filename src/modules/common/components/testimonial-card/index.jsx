export default function TestimonialCard({ review, name, designation }) {
  return (
    <main className="flex items-start justify-between h-72 flex-col rounded-3xl w-82 bg-black text-white p-6">
      <p className="text-sm text-justify">{review}</p>
        <div className="flex flex-col">
          <span className="text-[#c7f038]">{name}</span>
          <span className="text-xs text-neutral-300">{designation}</span>
        </div>
    </main>
  );
}
