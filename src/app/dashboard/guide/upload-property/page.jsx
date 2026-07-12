export default function Page() {
  return (
    <main className="flex flex-col justify-center items-center">
      <div className="pb-6 max-w-4xl space-y-4">
        <span className="inline-flex w-fit rounded-full bg-[#c7f038] px-4 py-1.5 text-sm font-medium text-neutral-900 shadow-sm">
          Resource Guide
        </span>
        <h1 className="text-6xl! font-light! text-left">
          How to upload good property images
        </h1>
        <p className="py-4 text-black text-xl text-left">
          This comprehensive guide explains how to capture and upload
          property photos that help our AI generate more realistic and
          visually compelling videos.
        </p>
      </div>

      <div className="w-full space-y-6 prose prose-neutral max-w-4xl">
        <h2 className="scroll-mt-24 text-2xl font-semibold tracking-tight text-neutral-900 pt-4 border-t border-neutral-100 first:border-t-0 first:pt-0">Why your source photos matter</h2>
        <p>
          Every home tour, site view, and interior shot our AI generates is
          built on top of the images you upload. The model doesn&apos;t
          invent the property — it enhances and animates what it sees. Sharp,
          well-lit, clutter-free photos give the AI clean signal to work
          with, which means smoother camera moves, more accurate lighting,
          and fewer visual artifacts in the final video. Blurry, dark, or
          heavily cropped photos force the AI to guess at details it can&apos;t
          see, which is where quality drops.
        </p>

        <h2 className="scroll-mt-24 text-2xl font-semibold tracking-tight text-neutral-900 pt-4 border-t border-neutral-100 first:border-t-0 first:pt-0">What to upload</h2>
        <p>
          Aim to cover the property the way a buyer would walk through it.
          For most listings, that means:
        </p>
        <ul>
          <li>
            <strong>Exterior / front facade</strong> — a straight-on shot
            showing the full front of the house, ideally with the driveway
            or walkway leading toward the camera.
          </li>
          <li>
            <strong>Living room and common areas</strong> — shot from a
            corner so the room reads as wide and open, not from the doorway
            looking straight in.
          </li>
          <li>
            <strong>Kitchen</strong> — capture countertops, cabinetry, and
            any island or bar seating in one frame if possible.
          </li>
          <li>
            <strong>Primary bedroom and bathroom</strong> — these are the
            two rooms buyers spend the most time looking at; give them the
            same care as the living room.
          </li>
          <li>
            <strong>Backyard / outdoor space</strong> — include the yard,
            patio, or pool if the listing has one; outdoor space sells
            almost as hard as the interior.
          </li>
          <li>
            <strong>Any standout feature</strong> — a fireplace, a view, a
            home office, a garage — anything that differentiates the
            listing is worth its own photo.
          </li>
        </ul>

        <h2 className="scroll-mt-24 text-2xl font-semibold tracking-tight text-neutral-900 pt-4 border-t border-neutral-100 first:border-t-0 first:pt-0">Technical checklist</h2>
        <p>
          Before you upload, run through this quick checklist — it&apos;s the
          fastest way to guarantee a clean result:
        </p>
        <ul>
          <li>
            <strong>Resolution:</strong> upload the highest resolution
            version you have (1080p or higher). Avoid screenshots or
            heavily compressed exports from messaging apps.
          </li>
          <li>
            <strong>Orientation:</strong> shoot landscape for exteriors and
            wide rooms, portrait for tighter spaces like hallways or
            bathrooms — don&apos;t rotate a portrait photo to fit a landscape
            frame.
          </li>
          <li>
            <strong>Lighting:</strong> shoot during daylight hours with
            curtains open and interior lights on. Avoid harsh midday sun
            through windows, which blows out highlights.
          </li>
          <li>
            <strong>Level horizon:</strong> keep the camera level — tilted
            horizons are one of the most common reasons a generated video
            looks {"\""}off.{"\""}
          </li>
          <li>
            <strong>File format:</strong> JPEG, PNG, or WebP, under 10MB
            per image.
          </li>
        </ul>

        <h2 className="scroll-mt-24 text-2xl font-semibold tracking-tight text-neutral-900 pt-4 border-t border-neutral-100 first:border-t-0 first:pt-0">What to avoid</h2>
        <ul>
          <li>Photos with people, pets, or reflections of the photographer in mirrors or glass.</li>
          <li>Heavy filters, watermarks, or text overlays baked into the image.</li>
          <li>Fisheye or ultra-wide lens shots that visibly distort straight lines.</li>
          <li>Cluttered rooms — clear countertops and floors read far better once animated.</li>
          <li>Duplicate near-identical shots of the same angle — pick your best one per room.</li>
        </ul>

        <h2 className="scroll-mt-24 text-2xl font-semibold tracking-tight text-neutral-900 pt-4 border-t border-neutral-100 first:border-t-0 first:pt-0">Matching photos to the right tool</h2>
        <p>
          Once your images are uploaded to your Asset Library, they power a
          few different generation tools — pick the one that fits what
          you{"\'"}re trying to produce:
        </p>
        <ul>
          <li>
            <strong>Home Tour</strong> — works best with a full set covering
            exterior, living areas, kitchen, bedrooms, and bathrooms in the
            order you&apos;d want them to appear in the walkthrough.
          </li>
          <li>
            <strong>Site View</strong> — best with wide exterior and
            aerial-style shots that establish the property&apos;s surroundings.
          </li>
          <li>
            <strong>Interior Shots</strong> — best with single, well-framed
            room photos rather than tight close-ups of fixtures.
          </li>
        </ul>

        <h2 className="scroll-mt-24 text-2xl font-semibold tracking-tight text-neutral-900 pt-4 border-t border-neutral-100 first:border-t-0 first:pt-0">Quick recap</h2>
        <ol>
          <li>Cover the exterior, main living spaces, kitchen, primary bedroom/bath, and any standout feature.</li>
          <li>Shoot in good daylight, keep the horizon level, and use the highest resolution you have.</li>
          <li>Clear clutter and people out of frame before you shoot.</li>
          <li>Upload one strong photo per angle rather than several near-duplicates.</li>
        </ol>
        <p>
          Better inputs mean better output spend a few extra minutes on
          the photoshoot, and the AI will reward you with a noticeably
          sharper final video.
        </p>
      </div>
    </main>
  );
}