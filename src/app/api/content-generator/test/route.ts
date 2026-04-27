import { NextResponse } from "next/server";
import type { SourceArticle } from "@/lib/content-generator";
import { getRandomKeyword } from "@/lib/sns-cs-keywords";
import { d1Run, newId, nowIso } from "@/lib/d1-client";

/**
 * 구글 검색으로 참고 자료 수집 (mock)
 */
async function searchGoogleForKeyword(
  keyword: string,
): Promise<SourceArticle[]> {
  return [
    {
      title: `${keyword} - 완벽 해결 가이드`,
      url: "https://example.com/guide1",
      snippet: `${keyword}로 인해 불편을 겪고 계신가요? 이 문제는 주로 정책 위반이나 의심스러운 활동으로 인해 발생합니다. 해결을 위해서는 먼저 계정 상태를 확인하고, 필요한 경우 신원 인증을 진행해야 합니다.`,
    },
    {
      title: `${keyword} 해결 방법 총정리`,
      url: "https://example.com/guide2",
      snippet: `많은 사용자들이 ${keyword} 문제로 어려움을 겪고 있습니다. 가장 효과적인 해결책은 공식 지원 채널을 통한 이의 제기입니다. 24-48시간 내에 답변을 받을 수 있으며, 필요한 서류를 미리 준비하면 더 빠른 해결이 가능합니다.`,
    },
    {
      title: `2024 ${keyword} 최신 대처법`,
      url: "https://example.com/guide3",
      snippet: `최근 플랫폼 정책 변경으로 ${keyword} 케이스가 증가하고 있습니다. 예방을 위해서는 커뮤니티 가이드라인을 숙지하고, 의심스러운 활동을 피하는 것이 중요합니다. 문제 발생 시 당황하지 말고 체계적으로 대응하세요.`,
    },
  ];
}

/**
 * 테스트용 콘텐츠 생성 API
 * GET /api/content-generator/test?keyword=...&save=true
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get("keyword") || getRandomKeyword();
    const saveToD1 = searchParams.get("save") === "true";

    console.log(`[Content Generator] Starting with keyword: ${keyword}`);

    const sourceArticles = await searchGoogleForKeyword(keyword);
    console.log(
      `[Content Generator] Found ${sourceArticles.length} source articles`,
    );

    const { rewriteContent, generateThumbnail } =
      await import("@/lib/content-generator");
    const rewrittenContent = await rewriteContent(keyword, sourceArticles);
    console.log(
      `[Content Generator] Content generated: ${rewrittenContent.title}`,
    );

    let thumbnailUrl = "";
    try {
      thumbnailUrl = await generateThumbnail(rewrittenContent.title, keyword);
      console.log(`[Content Generator] Thumbnail generated: ${thumbnailUrl}`);
    } catch (error) {
      console.error(`[Content Generator] Thumbnail generation failed:`, error);
    }

    const content = { ...rewrittenContent, thumbnailUrl };

    let recordId: string | null = null;
    if (saveToD1) {
      recordId = newId();
      const now = nowIso();
      await d1Run(
        `INSERT INTO content
          (id, date, title, category, content, tags, seo_keywords, status, slug,
           description, thumbnail_url, views, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordId,
          new Date().toISOString().split("T")[0],
          content.title,
          content.category,
          content.content,
          content.tags,
          content.seoKeywords,
          "draft",
          content.slug,
          content.description,
          content.thumbnailUrl,
          0,
          now,
          now,
        ],
      );
      console.log(`[Content Generator] Saved to D1: ${recordId}`);
    }

    return NextResponse.json({
      success: true,
      keyword,
      content: {
        title: content.title,
        description: content.description,
        category: content.category,
        seoKeywords: content.seoKeywords,
        tags: content.tags,
        slug: content.slug,
        thumbnailUrl: content.thumbnailUrl,
        contentPreview: content.content.substring(0, 500) + "...",
        fullContentLength: content.content.length,
      },
      recordId,
      saved: saveToD1,
    });
  } catch (error) {
    console.error("[Content Generator] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
