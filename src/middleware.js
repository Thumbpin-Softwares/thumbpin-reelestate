import { withAuth } from "next-auth/middleware";

// Protect all /dashboard/* routes — unauthenticated users are redirected to /auth/login
export default withAuth({
  pages: {
    signIn: "/auth/login",
  },
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
