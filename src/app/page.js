import { Navbar } from "@/modules/home/components/navbar";
import Hero from "@/modules/home/layout/hero";
import About from "@/modules/home/layout/about";
import Footer from "@/modules/common/layout/footer";
import Cta from "@/modules/home/layout/cta";
import Review from "@/modules/home/layout/reviews";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3, BUCKET, getAssetUrl } from "@/lib/r2";

// Cache the rendered page for 5 minutes so the R2 list only runs once per deploy cycle
export const revalidate = 300;

const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov"]);

async function getWebVideos() {
  try {
    const list = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: "web-assets/" })
    );
    const videos = (list.Contents ?? []).filter((obj) => {
      const ext = obj.Key.slice(obj.Key.lastIndexOf(".")).toLowerCase();
      return VIDEO_EXTS.has(ext);
    });
    const urls = await Promise.all(
      videos.map(async (obj) => {
        const url = await getAssetUrl(obj.Key);
        return url;
      })
    );
    return urls;
  } catch {
    return [];
  }
}

export default async function LandingPage() {
  const heroVideos = await getWebVideos();

  return (
    <main className="min-h-screen bg-[#f7f5e8]">
      <Navbar />
      <Hero videos={heroVideos} />
      <div className="bg-[#f5f6f0] py-12">
        <About />
      </div>
      <div className="bg-white py-12">
        <Review />
      </div>
      <div className="bg-white pb-12">
        <Cta />
      </div>
      <Footer />
    </main>
  );
}
