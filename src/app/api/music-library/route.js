const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

export const revalidate = 300; // cache listing for 5 minutes

// Thin proxy to thumbpin-backend's GET /music-library. Public — no auth.
export async function GET() {
  const backendRes = await fetch(`${BACKEND_URL}/api/v1/music-library`, {
    next: { revalidate: 300 },
  });

  const data = await backendRes.json().catch(() => ({ tracks: [] }));
  return new Response(JSON.stringify(data), {
    status: backendRes.status,
    headers: { "Content-Type": "application/json" },
  });
}
