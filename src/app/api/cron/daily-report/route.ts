import { NextRequest, NextResponse } from "next/server";
import { getYesterdayOverview, getTopPages } from "@/lib/google-analytics";

const CRON_SECRET = process.env.CRON_SECRET;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export const maxDuration = 30;

async function sendTelegram(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("[DailyReport] 텔레그램 환경변수 미설정");
    return false;
  }

  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    },
  );

  if (!res.ok) {
    const err = await res.json();
    console.error("[DailyReport] 텔레그램 발송 실패:", err);
    return false;
  }
  return true;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}분 ${s}초`;
}

export async function GET(request: NextRequest) {
  if (CRON_SECRET) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const [yesterday, topPages] = await Promise.all([
      getYesterdayOverview(),
      getTopPages(),
    ]);

    const now = new Date();
    now.setDate(now.getDate() - 1);
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const dayName = dayNames[now.getDay()];

    const pagesText = topPages
      .slice(0, 5)
      .map((p, i) => `  ${i + 1}. ${p.title.slice(0, 20)} — ${p.views}회`)
      .join("\n");

    const message = [
      `📊 <b>폴라애드 일별 접속 통계</b>`,
      `📅 ${dateStr} (${dayName})`,
      ``,
      `👥 방문자: <b>${yesterday.totalUsers}명</b>`,
      `🆕 신규: <b>${yesterday.newUsers}명</b>`,
      `📄 페이지뷰: <b>${yesterday.pageViews}회</b>`,
      `🔄 세션: <b>${yesterday.sessions}회</b>`,
      `⏱ 평균 체류: <b>${formatDuration(yesterday.avgSessionDuration)}</b>`,
      `📉 이탈률: <b>${yesterday.bounceRate.toFixed(1)}%</b>`,
      ``,
      `📌 <b>인기 페이지 TOP 5</b>`,
      pagesText,
      ``,
      `🔗 <a href="https://master.polarad.co.kr">대시보드 바로가기</a>`,
    ].join("\n");

    const sent = await sendTelegram(message);

    return NextResponse.json({
      success: sent,
      date: dateStr,
      stats: {
        visitors: yesterday.totalUsers,
        newUsers: yesterday.newUsers,
        pageViews: yesterday.pageViews,
        sessions: yesterday.sessions,
      },
    });
  } catch (error) {
    console.error("[DailyReport] 오류:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
