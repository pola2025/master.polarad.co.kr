/**
 * 서명페이지 열람 게이트 — 이메일 인증번호 통과 후 HttpOnly 쿠키 발급.
 * 쿠키값 = HMAC(token, EMAIL_TRACKING_SECRET). 위변조 불가.
 * 링크는 무기한 유효 → 쿠키도 장기(1년). 브라우저별 1회 인증.
 */
import { createHmac, timingSafeEqual } from "crypto";

const SECRET =
  process.env.EMAIL_TRACKING_SECRET || process.env.JWT_SECRET || "";

export function gateValue(token: string): string {
  return createHmac("sha256", SECRET)
    .update(`sign-gate:${token}`)
    .digest("hex");
}

export function gateCookieName(token: string): string {
  return `cg_${token.slice(0, 24)}`;
}

export function gateValid(
  token: string,
  cookieVal: string | undefined,
): boolean {
  if (!cookieVal || !SECRET) return false;
  const expected = gateValue(token);
  if (cookieVal.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(cookieVal), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** 이메일 마스킹 — b****@naver.com */
export function maskEmail(email: string): string {
  const [u, d] = String(email).split("@");
  if (!d) return "***";
  const head = u.slice(0, 1);
  return `${head}${"*".repeat(Math.max(3, u.length - 1))}@${d}`;
}
