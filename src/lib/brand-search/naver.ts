const NAVER_BASE_URL = "https://openapi.naver.com";

export interface NaverItem {
  title: string;
  link: string;
  description: string;
}

export interface NaverLocalItem {
  title: string;
  link: string;
  description: string;
  address: string;
  telephone: string;
  category: string;
}

export interface NaverSearchResult {
  webResults: NaverItem[];
  blogResults: NaverItem[];
  cafeResults: NaverItem[];
  newsResults: NaverItem[];
  localResults: NaverLocalItem[];
  totalCounts: {
    web: number;
    blog: number;
    cafe: number;
    news: number;
    local: number;
  };
  score: number;
  scoreBreakdown: {
    officialWebsite: number;
    blogMentions: number;
    localRegistration: number;
    newsCoverage: number;
    cafeMentions: number;
    brandContent: number;
  };
}

type NaverEndpoint =
  | "/v1/search/webkr.json"
  | "/v1/search/blog.json"
  | "/v1/search/cafearticle.json"
  | "/v1/search/news.json"
  | "/v1/search/local.json";

interface NaverApiResponse {
  total: number;
  items: Record<string, string>[];
}

async function callNaverApi(
  endpoint: NaverEndpoint,
  query: string,
): Promise<NaverApiResponse> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("NAVER_CLIENT_ID or NAVER_CLIENT_SECRET is not set");
  }

  const params = new URLSearchParams({
    query: query,
    display: "10",
    start: "1",
    sort: "sim",
  });

  const url = `${NAVER_BASE_URL}${endpoint}?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Naver API error on ${endpoint}: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<NaverApiResponse>;
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/gi, " ")
    .trim();
}

function normalizeWebItem(item: Record<string, string>): NaverItem {
  return {
    title: stripHtml(item.title || ""),
    link: item.link || "",
    description: stripHtml(item.description || ""),
  };
}

function normalizeLocalItem(item: Record<string, string>): NaverLocalItem {
  return {
    title: stripHtml(item.title || ""),
    link: item.link || "",
    description: stripHtml(item.description || ""),
    address: item.address || item.roadAddress || "",
    telephone: item.telephone || "",
    category: item.category || "",
  };
}

function calculateScore(
  webResults: NaverItem[],
  blogResults: NaverItem[],
  cafeResults: NaverItem[],
  newsResults: NaverItem[],
  localResults: NaverLocalItem[],
  totalCounts: NaverSearchResult["totalCounts"],
  businessName: string,
): NaverSearchResult["scoreBreakdown"] & { total: number } {
  const nameLower = businessName.toLowerCase();

  // Official website in top web results (20pts)
  const hasOfficialSite = webResults
    .slice(0, 5)
    .some(
      (item) =>
        item.title.toLowerCase().includes(nameLower) ||
        item.link.toLowerCase().includes(nameLower.replace(/\s+/g, "")),
    );
  const officialWebsite = hasOfficialSite ? 20 : 0;

  // Blog mentions 10+ results (20pts)
  const blogMentions =
    totalCounts.blog >= 10
      ? 20
      : totalCounts.blog >= 5
        ? 12
        : totalCounts.blog >= 1
          ? 6
          : 0;

  // Place/local registration (20pts)
  const localRegistration = localResults.length > 0 ? 20 : 0;

  // News coverage (15pts)
  const newsCoverage =
    totalCounts.news >= 5 ? 15 : totalCounts.news >= 1 ? 8 : 0;

  // Cafe/community mentions (10pts)
  const cafeMentions =
    totalCounts.cafe >= 3 ? 10 : totalCounts.cafe >= 1 ? 5 : 0;

  // Brand content in top 10 web results (15pts)
  const brandWebCount = webResults.filter(
    (item) =>
      item.title.toLowerCase().includes(nameLower) ||
      item.description.toLowerCase().includes(nameLower),
  ).length;
  const brandContent =
    brandWebCount >= 5
      ? 15
      : brandWebCount >= 3
        ? 10
        : brandWebCount >= 1
          ? 5
          : 0;

  const total =
    officialWebsite +
    blogMentions +
    localRegistration +
    newsCoverage +
    cafeMentions +
    brandContent;

  return {
    officialWebsite,
    blogMentions,
    localRegistration,
    newsCoverage,
    cafeMentions,
    brandContent,
    total,
  };
}

export async function searchNaver(
  businessName: string,
): Promise<NaverSearchResult> {
  const results = await Promise.allSettled([
    callNaverApi("/v1/search/webkr.json", businessName),
    callNaverApi("/v1/search/blog.json", businessName),
    callNaverApi("/v1/search/cafearticle.json", businessName),
    callNaverApi("/v1/search/news.json", businessName),
    callNaverApi("/v1/search/local.json", businessName),
  ]);

  const [webRaw, blogRaw, cafeRaw, newsRaw, localRaw] = results;

  const webData =
    webRaw.status === "fulfilled" ? webRaw.value : { total: 0, items: [] };
  const blogData =
    blogRaw.status === "fulfilled" ? blogRaw.value : { total: 0, items: [] };
  const cafeData =
    cafeRaw.status === "fulfilled" ? cafeRaw.value : { total: 0, items: [] };
  const newsData =
    newsRaw.status === "fulfilled" ? newsRaw.value : { total: 0, items: [] };
  const localData =
    localRaw.status === "fulfilled" ? localRaw.value : { total: 0, items: [] };

  const webResults = (webData.items || []).map(normalizeWebItem);
  const blogResults = (blogData.items || []).map(normalizeWebItem);
  const cafeResults = (cafeData.items || []).map(normalizeWebItem);
  const newsResults = (newsData.items || []).map(normalizeWebItem);
  const localResults = (localData.items || []).map(normalizeLocalItem);

  const totalCounts = {
    web: webData.total || 0,
    blog: blogData.total || 0,
    cafe: cafeData.total || 0,
    news: newsData.total || 0,
    local: localData.total || 0,
  };

  const { total: score, ...scoreBreakdown } = calculateScore(
    webResults,
    blogResults,
    cafeResults,
    newsResults,
    localResults,
    totalCounts,
    businessName,
  );

  return {
    webResults,
    blogResults,
    cafeResults,
    newsResults,
    localResults,
    totalCounts,
    score,
    scoreBreakdown,
  };
}
