// SNS CS 문제 관련 키워드 목록
export const SNS_CS_KEYWORDS = [
  // Instagram 계정 문제
  "인스타그램 계정 정지 해결",
  "인스타그램 계정 비활성화 복구",
  "인스타 커뮤니티 보호 활동 제한",
  "인스타그램 로그인 차단 해결",
  "인스타그램 계정 해킹 복구",

  // Meta 광고 계정 문제
  "메타 광고 계정 정지 해결",
  "페이스북 광고 계정 비활성화",
  "메타 비즈니스 계정 제한",
  "페이스북 광고 정책 위반 해결",

  // Threads 계정 문제
  "쓰레드 계정 정지",
  "쓰레드 계정 제한 해결",

  // 공통 에러 메시지
  "인스타 특정 활동 제한 해결",
  "메타 계정 이의제기 방법",
  "인스타그램 신원 확인 요청",
]

// 키워드 카테고리
export const KEYWORD_CATEGORIES = {
  instagram_account: [
    "인스타그램 계정 정지 해결",
    "인스타그램 계정 비활성화 복구",
    "인스타 커뮤니티 보호 활동 제한",
    "인스타그램 로그인 차단 해결",
    "인스타그램 계정 해킹 복구",
    "인스타 특정 활동 제한 해결",
    "인스타그램 신원 확인 요청",
  ],
  meta_ads: [
    "메타 광고 계정 정지 해결",
    "페이스북 광고 계정 비활성화",
    "메타 비즈니스 계정 제한",
    "페이스북 광고 정책 위반 해결",
    "메타 계정 이의제기 방법",
  ],
  threads: [
    "쓰레드 계정 정지",
    "쓰레드 계정 제한 해결",
  ],
}

// 랜덤 키워드 선택
export function getRandomKeyword(): string {
  const index = Math.floor(Math.random() * SNS_CS_KEYWORDS.length)
  return SNS_CS_KEYWORDS[index]
}

// 카테고리별 키워드 가져오기
export function getKeywordsByCategory(category: keyof typeof KEYWORD_CATEGORIES): string[] {
  return KEYWORD_CATEGORIES[category]
}
