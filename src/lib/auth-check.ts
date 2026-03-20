import { cookies } from "next/headers";

export async function requireAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token");
  return !!token?.value;
}
