import { NextResponse } from "next/server"
import type { SourceArticle } from "@/lib/content-generator"
import { getRandomKeyword } from "@/lib/sns-cs-keywords"
import Airtable from "airtable"

// Airtable 설정
const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN
const POLARAD_BASE_ID = "appbqw2GAixv7vSBV"
const TABLE_NAME = "뉴스레터"

function getBase() {
  if (!AIRTABLE_API_TOKEN) {
    throw new Error("AIRTABLE_API_TOKEN is not configured")
  }
  Airtable.configure({ apiKey: AIRTABLE_API_TOKEN })
  return Airtable.base(POLARAD_BASE_ID)
}

/**
 * 구글 검색으로 참고 자료 수집 (WebSearch 대신 간단한 mock)
 * 실제 구현에서는 SerpAPI 또는 Google Custom Search API 사용
 */
async function searchGoogleForKeyword(keyword: string): Promise<SourceArticle[]> {
  // 테스트용 mock 데이터
  // 실제로는 WebSearch 결과를 파싱하거나 SerpAPI 사용
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
  ]
}

/**
 * 테스트용 콘텐츠 생성 API
 * GET /api/content-generator/test
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const keyword = searchParams.get("keyword") || getRandomKeyword()
    const saveToAirtable = searchParams.get("save") === "true"

    console.log(`[Content Generator] Starting with keyword: ${keyword}`)

    // 1. 참고 자료 검색
    const sourceArticles = await searchGoogleForKeyword(keyword)
    console.log(`[Content Generator] Found ${sourceArticles.length} source articles`)

    // 2. 콘텐츠 리라이팅
    const { rewriteContent, generateThumbnail } = await import("@/lib/content-generator")
    const rewrittenContent = await rewriteContent(keyword, sourceArticles)
    console.log(`[Content Generator] Content generated: ${rewrittenContent.title}`)

    // 3. 썸네일 이미지 생성 (HCTI + Cloudinary)
    let thumbnailUrl = ""
    try {
      thumbnailUrl = await generateThumbnail(rewrittenContent.title, keyword)
      console.log(`[Content Generator] Thumbnail generated: ${thumbnailUrl}`)
    } catch (error) {
      console.error(`[Content Generator] Thumbnail generation failed:`, error)
      // 썸네일 생성 실패해도 계속 진행
    }

    const content = {
      ...rewrittenContent,
      thumbnailUrl,
    }

    // 4. Airtable 저장 (옵션)
    let airtableRecordId = null
    if (saveToAirtable) {
      const base = getBase()
      const record = await base(TABLE_NAME).create([
        {
          fields: {
            date: new Date().toISOString().split("T")[0],
            title: content.title,
            category: content.category,
            content: content.content,
            tags: content.tags,
            seoKeywords: content.seoKeywords,
            status: "draft", // 검수 필요
            slug: content.slug,
            description: content.description,
            thumbnailUrl: content.thumbnailUrl,
            views: 0,
          },
        },
      ])
      airtableRecordId = record[0].id
      console.log(`[Content Generator] Saved to Airtable: ${airtableRecordId}`)
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
      airtableRecordId,
      savedToAirtable: saveToAirtable,
    })
  } catch (error) {
    console.error("[Content Generator] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
