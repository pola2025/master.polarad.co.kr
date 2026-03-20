import { cookies } from "next/headers";
import { validateToken } from "@/lib/auth";

export async function requireAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token");
  if (!token?.value) return false;
  return validateToken(token.value);
}
