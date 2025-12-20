import { NextResponse } from "next/server"
import Airtable from "airtable"

// Airtable 설정 - 폴라애드 콘텐츠 Base
const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN
const POLARAD_BASE_ID = "appbqw2GAixv7vSBV"
const TABLE_NAME = "뉴스레터"

function getBase() {
  if (!AIRTABLE_API_TOKEN) {
    throw new Error("AIRTABLE_API_TOKEN is not configured")
  }

  Airtable.configure({
    apiKey: AIRTABLE_API_TOKEN,
  })

  return Airtable.base(POLARAD_BASE_ID)
}

export interface ContentItem {
  id: string
  date: string
  title: string
  category: string
  content: string
  tags: string
  seoKeywords: string
  publishedAt: string
  status: string
  slug: string
  description: string
  thumbnailUrl: string
  views: number
  instagramPosted: boolean
}

export async function GET() {
  try {
    if (!AIRTABLE_API_TOKEN) {
      return NextResponse.json(
        { error: "AIRTABLE_API_TOKEN is not configured" },
        { status: 500 }
      )
    }

    const base = getBase()
    const records = await base(TABLE_NAME)
      .select({
        sort: [{ field: "date", direction: "desc" }],
      })
      .all()

    const contents: ContentItem[] = records.map((record) => ({
      id: record.id,
      date: (record.get("date") as string) || "",
      title: (record.get("title") as string) || "",
      category: (record.get("category") as string) || "",
      content: (record.get("content") as string) || "",
      tags: (record.get("tags") as string) || "",
      seoKeywords: (record.get("seoKeywords") as string) || "",
      publishedAt: (record.get("publishedAt") as string) || "",
      status: (record.get("status") as string) || "draft",
      slug: (record.get("slug") as string) || "",
      description: (record.get("description") as string) || "",
      thumbnailUrl: (record.get("thumbnailUrl") as string) || "",
      views: (record.get("views") as number) || 0,
      instagramPosted: (record.get("instagram_posted") as boolean) || false,
    }))

    // 통계 계산
    const stats = {
      totalPosts: contents.length,
      publishedPosts: contents.filter((c) => c.status === "published").length,
      draftPosts: contents.filter((c) => c.status === "draft").length,
      scheduledPosts: contents.filter((c) => c.status === "scheduled").length,
      totalViews: contents.reduce((sum, c) => sum + c.views, 0),
    }

    // 카테고리별 집계
    const categoryMap = new Map<string, number>()
    contents.forEach((c) => {
      if (c.category) {
        categoryMap.set(c.category, (categoryMap.get(c.category) || 0) + 1)
      }
    })
    const categories = Array.from(categoryMap.entries()).map(([name, count]) => ({
      name,
      count,
    }))

    return NextResponse.json({
      contents,
      stats,
      categories,
    })
  } catch (error) {
    console.error("Content API Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch content data" },
      { status: 500 }
    )
  }
}
