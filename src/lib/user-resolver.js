import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-config";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

/**
 * Robustly resolves the MongoDB User object from a Next-Auth session.
 * This is necessary because session.user.id can sometimes be an email or an external provider ID
 * instead of the MongoDB _id string.
 * 
 * @param {Object} request - The Next.js request object
 * @returns {Promise<Object|null>} The MongoDB User document
 */
export async function resolveUserFromSession(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      console.log("[User Resolver] No session user found");
      return null;
    }

    await dbConnect();

    // 1. Try finding by session.user.id (most common)
    if (session.user.id) {
      const userById = await User.findById(session.user.id);
      if (userById) {
        console.log("[User Resolver] Found user by session.user.id:", userById._id);
        return userById;
      }
    }

    // 2. Fallback: Try finding by session.user.email
    if (session.user.email) {
      const userByEmail = await User.findOne({ email: session.user.email });
      if (userByEmail) {
        console.log("[User Resolver] Found user by session.user.email fallback:", userByEmail._id);
        return userByEmail;
      }
    }

    console.log("[User Resolver] User not found in database for session:", session.user);
    return null;
  } catch (error) {
    console.error("[User Resolver] Error resolving user:", error);
    return null;
  }
}

/**
 * Gets just the MongoDB _id string for the user.
 * 
 * @param {Object} request - The Next.js request object
 * @returns {Promise<string|null>} The MongoDB _id string
 */
export async function getResolvedUserId(request) {
  const user = await resolveUserFromSession(request);
  return user ? user._id.toString() : null;
}
