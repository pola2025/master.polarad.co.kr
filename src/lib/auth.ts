/**
 * Auth Module - JWT 기반
 */

import { SignJWT, jwtVerify } from "jose";

const TOKEN_EXPIRY = "7d";
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;

function getSecretKey(): Uint8Array {
  const secret = process.env.ADMIN_PASSWORD || "polarad-admin-secret-key";
  return new TextEncoder().encode(secret);
}

interface RateLimitData {
  count: number;
  resetAt: number;
}
const memoryRateLimitStore = new Map<string, RateLimitData>();

export async function generateToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getSecretKey());
}

export async function validateToken(token: string): Promise<boolean> {
  if (!token || typeof token !== "string") return false;
  try {
    await jwtVerify(token, getSecretKey());
    return true;
  } catch {
    return false;
  }
}

export function validateTokenSync(token: string): boolean {
  return !!(token && typeof token === "string");
}

export async function checkRateLimit(ip: string): Promise<{
  allowed: boolean;
  remaining?: number;
  retryAfter?: number;
}> {
  const now = Date.now();
  const data = memoryRateLimitStore.get(ip);

  if (!data || now >= data.resetAt) {
    memoryRateLimitStore.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_SECONDS * 1000,
    });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (data.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((data.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  data.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX - data.count };
}
