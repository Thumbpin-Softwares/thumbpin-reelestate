import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const ADMIN_SESSION_TOKEN = "admin_session";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_TOKEN);
  return NextResponse.json({ success: true });
}
