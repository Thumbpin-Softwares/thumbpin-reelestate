import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-backend-session";

// Re-exported so the ~9 other admin/* routes that already do
// `import { verifyAdminSession } from "@/app/api/admin/auth/me/route"`
// don't need touching individually — the real implementation now lives in
// lib/admin-backend-session.js and validates against the backend's signed
// admin_token JWT instead of trusting an unsigned local cookie.
export { verifyAdminSession };

export async function GET() {
  const session = await verifyAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ admin: session.email });
}
