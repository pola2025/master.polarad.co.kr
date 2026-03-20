const NAVER_BASE_URL = "https://openapi.naver.com";

function normalizeBusinessName(name: string): string {
  return name
    .replace(/\(주\)|주식회사|㈜|Inc\.|LLC|Ltd\./gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

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
  const nameCompact = nameLower.replace(/\s+/g, "");

  // Official website (20pts): graduated by position
  const top3Match = webResults
    .slice(0, 3)
    .some(
      (item) =>
        item.title.toLowerCase().includes(nameLower) ||
        item.link.toLowerCase().includes(nameCompact),
    );
  const top5Match = webResults
    .slice(0, 5)
    .some(
      (item) =>
        item.title.toLowerCase().includes(nameLower) ||
        item.link.toLowerCase().includes(nameCompact),
    );
  const top10Match = webResults
    .slice(0, 10)
    .some(
      (item) =>
        item.title.toLowerCase().includes(nameLower) ||
        item.link.toLowerCase().includes(nameCompact),
    );
  const anyNameMatch = webResults.some((item) =>
    item.title.toLowerCase().includes(nameLower),
  );
  const officialWebsite = top3Match
    ? 20
    : top5Match
      ? 15
      : top10Match
        ? 10
        : anyNameMatch
          ? 5
          : 0;

  // Blog presence (20pts): log scale — 1=0, 10=10, 100=20
  const blogMentions = Math.min(
    20,
    Math.round(Math.log10(totalCounts.blog + 1) * 10),
  );

  // Place/local registration (20pts): name match bonus
  const localExactMatch = localResults.some((item) =>
    item.title.toLowerCase().includes(nameLower),
  );
  const localRegistration =
    localResults.length === 0 ? 0 : localExactMatch ? 20 : 15;

  // News coverage (15pts): 1=3, 3=9, 5+=15
  const newsCoverage = Math.min(15, totalCounts.news * 3);

  // Cafe/community mentions (10pts): 1=2, 3=6, 5+=10
  const cafeMentions = Math.min(10, totalCounts.cafe * 2);

  // Brand content in top 10 web results (15pts): 1=5, 2=10, 3+=15
  const brandWebCount = webResults.filter(
    (item) =>
      item.title.toLowerCase().includes(nameLower) ||
      item.description.toLowerCase().includes(nameLower),
  ).length;
  const brandContent = Math.min(15, brandWebCount * 5);

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
  const normalizedName = normalizeBusinessName(businessName);
  const results = await Promise.allSettled([
    callNaverApi("/v1/search/webkr.json", normalizedName),
    callNaverApi("/v1/search/blog.json", normalizedName),
    callNaverApi("/v1/search/cafearticle.json", normalizedName),
    callNaverApi("/v1/search/news.json", normalizedName),
    callNaverApi("/v1/search/local.json", normalizedName),
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
    normalizedName,
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
