/**
 * Auth Module - JWT 기반
 * Redis 기반 레이트리밋
 */

import { SignJWT, jwtVerify } from "jose";
import redis from "./redis";

const TOKEN_EXPIRY = "7d";
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret)
    throw new Error(
      "JWT_SECRET or ADMIN_PASSWORD environment variable is required",
    );
  return new TextEncoder().encode(secret);
}

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

export async function checkRateLimit(ip: string): Promise<{
  allowed: boolean;
  remaining?: number;
  retryAfter?: number;
}> {
  const key = `rl:login:${ip}`;

  try {
    const count = await redis.incr(key);

    // 첫 요청이면 TTL 설정
    if (count === 1) {
      await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    }

    if (count > RATE_LIMIT_MAX) {
      const ttl = await redis.ttl(key);
      return {
        allowed: false,
        remaining: 0,
        retryAfter: ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECONDS,
      };
    }

    return { allowed: true, remaining: RATE_LIMIT_MAX - count };
  } catch (error) {
    console.error("[auth] 레이트리밋 Redis 오류:", error);
    // Redis 장애 시 허용 (가용성 우선)
    return { allowed: true, remaining: RATE_LIMIT_MAX };
  }
}
