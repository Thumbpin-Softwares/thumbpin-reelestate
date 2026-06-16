"use server";

import { redirect } from "next/navigation";

// These are kept for backward compatibility if anything calls them,
// but the actual auth is now handled via next-auth/react on the client.
// Google OAuth and credentials login happen directly via signIn() from next-auth/react.

export async function signOut() {
  // Redirect to NextAuth signout endpoint
  redirect("/api/auth/signout");
}

// Deprecated — kept so any old imports don't crash
export async function login() {}
export async function signup() {}
export async function signInWithGoogle() {}
