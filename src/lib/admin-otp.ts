/**
 * 관리자 텔레그램 OTP 인증
 * Redis 기반 영속 저장
 */

import { timingSafeEqual } from "crypto";
import redis from "./redis";

const OTP_EXPIRY_SEC = 300; // 5분
const OTP_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const LOCKOUT_SEC = 60;
const RESEND_COOLDOWN_SEC = 30;

const KEY_OTP = "otp:admin";
const KEY_COOLDOWN = "otp:admin:cooldown";

interface OtpEntry {
  code: string;
  attempts: number;
  lockedUntil?: number;
}

function generateOTP(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1000000).padStart(OTP_LENGTH, "0");
}

async function sendViaTelegram(message: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error("Admin OTP: TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID 미설정");
    return false;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      },
    );

    if (!res.ok) {
      const err = await res.json();
      console.error("Admin OTP 전송 실패:", err);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Admin OTP 전송 오류:", error);
    return false;
  }
}

export async function sendAdminOTP(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // 재발송 쿨다운 체크
    const cooldown = await redis.get(KEY_COOLDOWN);
    if (cooldown) {
      return {
        success: false,
        error: "잠시 후 다시 시도해주세요. (30초 대기)",
      };
    }

    const code = generateOTP();
    const entry: OtpEntry = { code, attempts: 0 };

    // Redis에 OTP 저장 (TTL 5분)
    await redis.set(KEY_OTP, JSON.stringify(entry), "EX", OTP_EXPIRY_SEC);
    // 쿨다운 플래그 (TTL 30초)
    await redis.set(KEY_COOLDOWN, "1", "EX", RESEND_COOLDOWN_SEC);

    const message = `
[auth/otp] <b>🏠 폴라애드 홈페이지 관리자 인증코드</b>

<b>인증코드:</b> <code>${code}</code>
<b>유효시간:</b> 5분

⏰ ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
`.trim();

    const sent = await sendViaTelegram(message);
    if (!sent) {
      await redis.del(KEY_OTP);
      return {
        success: false,
        error: "인증코드 발송에 실패했습니다. 텔레그램 봇 설정을 확인해주세요.",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("[admin-otp] Redis 오류:", error);
    return { success: false, error: "서버 오류가 발생했습니다." };
  }
}

export async function verifyAdminOTP(code: string): Promise<{
  valid: boolean;
  error?: string;
  lockedUntil?: number;
}> {
  try {
    const raw = await redis.get(KEY_OTP);

    if (!raw) {
      return { valid: false, error: "인증코드를 먼저 요청해주세요." };
    }

    const entry: OtpEntry = JSON.parse(raw);

    // 잠금 상태 체크
    const now = Date.now();
    if (entry.lockedUntil && now < entry.lockedUntil) {
      const remaining = Math.ceil((entry.lockedUntil - now) / 1000);
      return {
        valid: false,
        error: `너무 많은 시도입니다. ${remaining}초 후 다시 시도해주세요.`,
        lockedUntil: entry.lockedUntil,
      };
    }

    entry.attempts++;

    if (entry.attempts >= MAX_ATTEMPTS) {
      entry.lockedUntil = now + LOCKOUT_SEC * 1000;
      entry.attempts = 0;
      await redis.set(KEY_OTP, JSON.stringify(entry), "EX", LOCKOUT_SEC);
      return {
        valid: false,
        error: "인증 시도 횟수를 초과했습니다. 1분 후 다시 시도해주세요.",
        lockedUntil: entry.lockedUntil,
      };
    }

    // timing-safe 비교
    const codeBuffer = Buffer.from(code.padEnd(OTP_LENGTH, "0"));
    const storedBuffer = Buffer.from(entry.code.padEnd(OTP_LENGTH, "0"));
    if (
      codeBuffer.length !== storedBuffer.length ||
      !timingSafeEqual(codeBuffer, storedBuffer)
    ) {
      const ttl = await redis.ttl(KEY_OTP);
      await redis.set(
        KEY_OTP,
        JSON.stringify(entry),
        "EX",
        ttl > 0 ? ttl : OTP_EXPIRY_SEC,
      );
      return {
        valid: false,
        error: `인증코드가 올바르지 않습니다. (${MAX_ATTEMPTS - entry.attempts}회 남음)`,
      };
    }

    // 성공 — OTP 삭제
    await redis.del(KEY_OTP);
    return { valid: true };
  } catch (error) {
    console.error("[admin-otp] Redis 오류:", error);
    return { valid: false, error: "서버 오류가 발생했습니다." };
  }
}
