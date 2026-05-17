import { createHmac, randomInt, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import redis from "@/lib/redis";
import { escapeHtml } from "@/lib/html-escape";
import { sendHtmlMail } from "@/lib/mailer";
import type { ChatRoom } from "@/lib/chat-shared";

export const CLIENT_CHAT_COOKIE = "client_chat_token";

const OTP_EXPIRY_SEC = 10 * 60;
const OTP_COOLDOWN_SEC = 60;
const MAX_ATTEMPTS = 5;
const SESSION_DAYS = 30;
const AUTH_RATE_WINDOW_SEC = 10 * 60;
const OTP_REQUESTS_PER_WINDOW = 20;
const OTP_VERIFY_PER_WINDOW = 60;

interface CustomerOtpEntry {
  hash: string;
  attempts: number;
}

function getSecret(): Uint8Array {
  const secret =
    process.env.CHAT_AUTH_SECRET ||
    process.env.JWT_SECRET ||
    process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error("CHAT_AUTH_SECRET/JWT_SECRET/ADMIN_PASSWORD 환경변수 누락");
  }
  return new TextEncoder().encode(secret);
}

function getSecretString(): string {
  return new TextDecoder().decode(getSecret());
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isSameEmail(a: string, b: string): boolean {
  return normalizeEmail(a) === normalizeEmail(b);
}

function otpKey(roomId: string, email: string): string {
  return `chat:otp:${roomId}:${normalizeEmail(email)}`;
}

function cooldownKey(roomId: string, email: string): string {
  return `chat:otp-cooldown:${roomId}:${normalizeEmail(email)}`;
}

function authRateKey(roomId: string, ip: string, action: string): string {
  return `chat:auth-rate:${action}:${roomId}:${ip}`;
}

export function getRequestIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function checkCustomerChatAuthRateLimit(input: {
  roomId: string;
  ip: string;
  action: "request" | "verify";
}): Promise<boolean> {
  if (!input.ip || input.ip === "unknown") return true;
  const limit =
    input.action === "request" ? OTP_REQUESTS_PER_WINDOW : OTP_VERIFY_PER_WINDOW;
  const key = authRateKey(input.roomId, input.ip, input.action);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, AUTH_RATE_WINDOW_SEC);
  }
  return count <= limit;
}

function makeOtpHash(roomId: string, email: string, code: string): string {
  return createHmac("sha256", getSecretString())
    .update(`${roomId}:${normalizeEmail(email)}:${code}`)
    .digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function generateOtp(): string {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

function chatInviteHtml(room: ChatRoom, code: string): string {
  const chatUrl = escapeHtml(room.chatUrl);
  const customerName = escapeHtml(room.company || room.clientName || "고객");
  return `
    <div style="font-family:Arial,'Noto Sans KR',sans-serif;line-height:1.6;color:#111827">
      <h2 style="margin:0 0 12px">폴라애드 고객 채팅 인증번호</h2>
      <p>${customerName}님, 아래 인증번호로 채팅방 입장을 완료해주세요.</p>
      <div style="margin:20px 0;padding:18px;border-radius:14px;background:#f3f4f6;font-size:28px;font-weight:700;letter-spacing:4px;text-align:center">${code}</div>
      <p>채팅방 링크: <a href="${chatUrl}" target="_blank" rel="noreferrer">${chatUrl}</a></p>
      <p style="font-size:13px;color:#6b7280">인증번호는 10분 동안 유효합니다. 링크만으로는 입장되지 않으며, 등록된 이메일 인증이 필요합니다.</p>
    </div>
  `;
}

export async function sendCustomerChatOtp(
  room: ChatRoom,
  email: string,
): Promise<{ success: boolean; error?: string }> {
  const normalized = normalizeEmail(email);
  if (!normalized || !room.clientEmail || !isSameEmail(normalized, room.clientEmail)) {
    return { success: true };
  }

  const cooldown = await redis.get(cooldownKey(room.id, normalized));
  if (cooldown) {
    return { success: false, error: "인증번호는 1분 후 다시 요청할 수 있습니다." };
  }

  const code = generateOtp();
  const entry: CustomerOtpEntry = {
    hash: makeOtpHash(room.id, normalized, code),
    attempts: 0,
  };

  await redis.set(otpKey(room.id, normalized), JSON.stringify(entry), "EX", OTP_EXPIRY_SEC);
  await redis.set(cooldownKey(room.id, normalized), "1", "EX", OTP_COOLDOWN_SEC);

  await sendHtmlMail({
    to: normalized,
    subject: "[폴라애드] 고객 채팅 인증번호",
    html: chatInviteHtml(room, code),
  });

  return { success: true };
}

export async function createCustomerChatToken(input: {
  roomId: string;
  email: string;
}): Promise<string> {
  return new SignJWT({
    scope: "client-chat",
    roomId: input.roomId,
    email: normalizeEmail(input.email),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function verifyCustomerChatOtp(input: {
  room: ChatRoom;
  email: string;
  code: string;
}): Promise<{ valid: boolean; token?: string; error?: string }> {
  const email = normalizeEmail(input.email);
  const code = input.code.trim();
  if (!email || !isSameEmail(email, input.room.clientEmail)) {
    return { valid: false, error: "인증정보가 올바르지 않습니다." };
  }
  if (!/^\d{6}$/.test(code)) {
    return { valid: false, error: "6자리 인증번호를 입력해주세요." };
  }

  const key = otpKey(input.room.id, email);
  const raw = await redis.get(key);
  if (!raw) {
    return { valid: false, error: "인증번호를 다시 요청해주세요." };
  }

  const entry = JSON.parse(raw) as CustomerOtpEntry;
  const expectedHash = makeOtpHash(input.room.id, email, code);
  if (!safeEqual(entry.hash, expectedHash)) {
    const attempts = entry.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await redis.del(key);
      return {
        valid: false,
        error: "인증 시도 횟수를 초과했습니다. 인증번호를 다시 요청해주세요.",
      };
    }
    const ttl = await redis.ttl(key);
    await redis.set(
      key,
      JSON.stringify({ ...entry, attempts }),
      "EX",
      ttl > 0 ? ttl : OTP_EXPIRY_SEC,
    );
    return { valid: false, error: "인증번호가 올바르지 않습니다." };
  }

  await redis.del(key);
  const token = await createCustomerChatToken({ roomId: input.room.id, email });
  return { valid: true, token };
}

export async function validateCustomerChatSession(
  token: string | undefined,
  roomId: string,
): Promise<{ email: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.scope !== "client-chat" || payload.roomId !== roomId) return null;
    return { email: typeof payload.email === "string" ? payload.email : "" };
  } catch {
    return null;
  }
}

export async function requireCustomerChatSession(
  request: NextRequest,
  roomId: string,
): Promise<{ email: string } | null> {
  return validateCustomerChatSession(
    request.cookies.get(CLIENT_CHAT_COOKIE)?.value,
    roomId,
  );
}

export function setCustomerChatCookie(
  response: NextResponse,
  token: string,
): void {
  response.cookies.set(CLIENT_CHAT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}
