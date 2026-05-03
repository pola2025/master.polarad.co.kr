import { NextRequest, NextResponse } from "next/server";
import { d1All, d1First, d1Run, nowIso } from "@/lib/d1-client";

// 프론트엔드 캐시 무효화 설정
const FRONTEND_URL = process.env.FRONTEND_URL || "https://polarad.co.kr";
const REVALIDATE_TOKEN = process.env.REVALIDATE_TOKEN;

async function revalidateFrontend(slug?: string) {
  try {
    const response = await fetch(`${FRONTEND_URL}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${REVALIDATE_TOKEN}`,
      },
      body: JSON.stringify({ type: "marketing-news", slug }),
    });
    if (response.ok) {
      console.log("[Revalidate] Frontend cache cleared successfully");
      return true;
    }
    console.warn(
      "[Revalidate] Failed to clear frontend cache:",
      response.status,
    );
    return false;
  } catch (error) {
    console.error("[Revalidate] Error calling frontend:", error);
    return false;
  }
}

export interface ContentItem {
  id: string;
  date: string;
  title: string;
  category: string;
  content: string;
  tags: string;
  seoKeywords: string;
  publishedAt: string;
  status: string;
  slug: string;
  description: string;
  thumbnailUrl: string;
  views: number;
  instagramPosted: boolean;
}

interface ContentRow {
  id: string;
  date: string;
  title: string;
  category: string;
  content: string;
  tags: string;
  seo_keywords: string;
  published_at: string | null;
  status: string;
  slug: string;
  description: string;
  thumbnail_url: string;
  views: number;
  instagram_posted: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    // 단건 조회 — 본문(content) 포함 전체 컬럼
    if (id) {
      const row = await d1First<ContentRow>(
        `SELECT id, date, title, category, content, tags, seo_keywords, published_at,
                status, slug, description, thumbnail_url, views, instagram_posted
         FROM content WHERE id = ?`,
        [id],
      );
      if (!row) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const item: ContentItem = {
        id: row.id,
        date: row.date || "",
        title: row.title || "",
        category: row.category || "",
        content: row.content || "",
        tags: row.tags || "",
        seoKeywords: row.seo_keywords || "",
        publishedAt: row.published_at || "",
        status: row.status || "draft",
        slug: row.slug || "",
        description: row.description || "",
        thumbnailUrl: row.thumbnail_url || "",
        views: row.views || 0,
        instagramPosted: !!row.instagram_posted,
      };
      return NextResponse.json({ content: item });
    }

    // 목록 조회 — content(본문 LONGTEXT) 제외. 다이얼로그 열 때 별도 단건 fetch.
    type ContentListRow = Omit<ContentRow, "content">;
    const rows = await d1All<ContentListRow>(
      `SELECT id, date, title, category, tags, seo_keywords, published_at,
              status, slug, description, thumbnail_url, views, instagram_posted
       FROM content
       ORDER BY date DESC, created_at DESC`,
    );

    const contents: ContentItem[] = rows.map((r) => ({
      id: r.id,
      date: r.date || "",
      title: r.title || "",
      category: r.category || "",
      content: "",
      tags: r.tags || "",
      seoKeywords: r.seo_keywords || "",
      publishedAt: r.published_at || "",
      status: r.status || "draft",
      slug: r.slug || "",
      description: r.description || "",
      thumbnailUrl: r.thumbnail_url || "",
      views: r.views || 0,
      instagramPosted: !!r.instagram_posted,
    }));

    const stats = {
      totalPosts: contents.length,
      publishedPosts: contents.filter((c) => c.status === "published").length,
      draftPosts: contents.filter((c) => c.status === "draft").length,
      scheduledPosts: contents.filter((c) => c.status === "scheduled").length,
      totalViews: contents.reduce((sum, c) => sum + c.views, 0),
    };

    const categoryMap = new Map<string, number>();
    contents.forEach((c) => {
      if (c.category) {
        categoryMap.set(c.category, (categoryMap.get(c.category) || 0) + 1);
      }
    });
    const categories = Array.from(categoryMap.entries()).map(
      ([name, count]) => ({ name, count }),
    );

    return NextResponse.json({ contents, stats, categories });
  } catch (error) {
    console.error("Content API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch content data" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...fields } = body;
    if (!id) {
      return NextResponse.json(
        { error: "Record ID is required" },
        { status: 400 },
      );
    }

    const fieldMap: Record<string, string> = {
      title: "title",
      content: "content",
      category: "category",
      status: "status",
      slug: "slug",
      description: "description",
      tags: "tags",
      seoKeywords: "seo_keywords",
      thumbnailUrl: "thumbnail_url",
      date: "date",
      publishedAt: "published_at",
    };

    const sets: string[] = [];
    const params: (string | number)[] = [];
    for (const [key, value] of Object.entries(fields)) {
      const col = fieldMap[key];
      if (col && value !== undefined) {
        sets.push(`${col} = ?`);
        params.push(value as string | number);
      }
    }
    if (fields.instagramPosted !== undefined) {
      sets.push("instagram_posted = ?");
      params.push(fields.instagramPosted ? 1 : 0);
    }
    if (sets.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    sets.push("updated_at = ?");
    params.push(nowIso());
    params.push(id);

    const result = await d1Run(
      `UPDATE content SET ${sets.join(", ")} WHERE id = ?`,
      params,
    );
    if (!result.meta?.changes) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    revalidateFrontend(fields.slug as string | undefined).catch(() => {});

    return NextResponse.json({
      success: true,
      id,
      message: "Content updated successfully",
      revalidated: true,
    });
  } catch (error) {
    console.error("Content Update Error:", error);
    return NextResponse.json(
      { error: "Failed to update content" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "Record ID is required" },
        { status: 400 },
      );
    }

    const result = await d1Run("DELETE FROM content WHERE id = ?", [id]);
    if (!result.meta?.changes) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    revalidateFrontend().catch(() => {});

    return NextResponse.json({
      success: true,
      id,
      message: "Content deleted successfully",
      revalidated: true,
    });
  } catch (error) {
    console.error("Content Delete Error:", error);
    return NextResponse.json(
      { error: "Failed to delete content" },
      { status: 500 },
    );
  }
}
