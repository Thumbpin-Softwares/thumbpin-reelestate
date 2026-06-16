import { withAuth } from "next-auth/middleware";

// Protect all /app/* routes — unauthenticated users are redirected to /auth/login
export default withAuth({
  pages: {
    signIn: "/auth/login",
  },
});

export const config = {
  matcher: ["/app/:path*"],
};
