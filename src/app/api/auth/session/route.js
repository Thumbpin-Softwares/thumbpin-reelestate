import { NextResponse } from "next/server";
import { getBackendSession } from "@/lib/backend-session";

// Thin wrapper so client components can read the backend-auth session
// without needing to know the backend's URL or handle cross-origin cookies
// themselves — the cookie only needs to reach this Next.js server.
export async function GET() {
  const user = await getBackendSession();
  return NextResponse.json({ user });
}
