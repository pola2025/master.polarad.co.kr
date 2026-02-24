/**
 * 관리자 텔레그램 OTP 인증
 * TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID 환경변수 사용
 */

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5분
const OTP_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000; // 실패 초과 시 1분
const RESEND_COOLDOWN_MS = 30 * 1000; // 재발송 쿨다운 30초

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
  lockedUntil?: number;
}

const otpStore = new Map<"admin", OtpEntry>();

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
  const now = Date.now();
  const existing = otpStore.get("admin");

  // 재발송 쿨다운 체크
  if (
    existing &&
    existing.expiresAt - OTP_EXPIRY_MS + RESEND_COOLDOWN_MS > now
  ) {
    return { success: false, error: "잠시 후 다시 시도해주세요. (30초 대기)" };
  }

  const code = generateOTP();
  otpStore.set("admin", {
    code,
    expiresAt: now + OTP_EXPIRY_MS,
    attempts: 0,
  });

  const message = `
<b>🏠 폴라애드 홈페이지 관리자 인증코드</b>

<b>인증코드:</b> <code>${code}</code>
<b>유효시간:</b> 5분

⏰ ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
`.trim();

  const sent = await sendViaTelegram(message);
  if (!sent) {
    otpStore.delete("admin");
    return {
      success: false,
      error: "인증코드 발송에 실패했습니다. 텔레그램 봇 설정을 확인해주세요.",
    };
  }

  return { success: true };
}

export function verifyAdminOTP(code: string): {
  valid: boolean;
  error?: string;
  lockedUntil?: number;
} {
  const now = Date.now();
  const entry = otpStore.get("admin");

  if (!entry) {
    return { valid: false, error: "인증코드를 먼저 요청해주세요." };
  }

  // 잠금 상태 체크
  if (entry.lockedUntil && now < entry.lockedUntil) {
    const remaining = Math.ceil((entry.lockedUntil - now) / 1000);
    return {
      valid: false,
      error: `너무 많은 시도입니다. ${remaining}초 후 다시 시도해주세요.`,
      lockedUntil: entry.lockedUntil,
    };
  }

  // 만료 체크
  if (now > entry.expiresAt) {
    otpStore.delete("admin");
    return {
      valid: false,
      error: "인증코드가 만료되었습니다. 다시 요청해주세요.",
    };
  }

  entry.attempts++;

  if (entry.attempts >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
    entry.attempts = 0;
    return {
      valid: false,
      error: "인증 시도 횟수를 초과했습니다. 1분 후 다시 시도해주세요.",
      lockedUntil: entry.lockedUntil,
    };
  }

  if (entry.code !== code) {
    return {
      valid: false,
      error: `인증코드가 올바르지 않습니다. (${MAX_ATTEMPTS - entry.attempts}회 남음)`,
    };
  }

  otpStore.delete("admin");
  return { valid: true };
}
