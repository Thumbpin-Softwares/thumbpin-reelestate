import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

/** Get a user by email (case-insensitive) */
export async function getUser(email) {
  if (!email) return null;
  await dbConnect();
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return null;
  return { ...user.toObject(), id: user._id.toString() };
}

/** Create a new user. Returns the user or throws if email already taken. */
export async function createUser({ email, password, name }) {
  await dbConnect();
  
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new Error("An account with this email already exists.");

  const hashedPassword = password ? await bcrypt.hash(password, 12) : undefined;
  
  const user = await User.create({
    email: email.toLowerCase(),
    name: name || email.split("@")[0],
    hashedPassword,
  });

  return { id: user._id.toString(), email: user.email, name: user.name };
}
