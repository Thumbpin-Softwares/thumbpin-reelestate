import { getBackendSession } from "@/lib/backend-session";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

/**
 * Robustly resolves the MongoDB User object for the current request, backed
 * by thumbpin-backend's auth (see getBackendSession). Re-fetches via this
 * app's own Mongoose model (same shared DB) so callers get a full Mongoose
 * document, not the backend's plain JSON user.
 *
 * @returns {Promise<Object|null>} The MongoDB User document
 */
export async function resolveUserFromSession() {
  try {
    const backendUser = await getBackendSession();
    if (!backendUser) {
      console.log("[User Resolver] No session user found");
      return null;
    }

    await dbConnect();

    // 1. Try finding by id (most common)
    if (backendUser._id || backendUser.id) {
      const userById = await User.findById(backendUser._id || backendUser.id);
      if (userById) {
        console.log("[User Resolver] Found user by id:", userById._id);
        return userById;
      }
    }

    // 2. Fallback: Try finding by email
    if (backendUser.email) {
      const userByEmail = await User.findOne({ email: backendUser.email });
      if (userByEmail) {
        console.log("[User Resolver] Found user by email fallback:", userByEmail._id);
        return userByEmail;
      }
    }

    console.log("[User Resolver] User not found in database for session:", backendUser);
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
export async function getResolvedUserId() {
  const user = await resolveUserFromSession();
  return user ? user._id.toString() : null;
}
