# 폴라애드 종합 대시보드 PRD

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **프로젝트명** | PolarAd Admin Dashboard |
| **버전** | 1.0.0 |
| **작성일** | 2025-12-20 |
| **배포 URL** | https://master-polarad-co-kr.vercel.app |
| **참조 사이트** | https://polarad.co.kr (프로덕션) |

---

## 1. 목표 및 배경

### 1.1 배경
폴라애드 웹사이트(polarad.co.kr)의 운영을 위한 통합 관리 대시보드가 필요합니다.
현재 방문 통계, 콘텐츠 관리, 문의 관리 등이 분산되어 있어 일원화된 관리 시스템이 요구됩니다.

### 1.2 목표
- 실시간 방문 통계 모니터링 (GA4 연동)
- 사이트 콘텐츠 관리 (마케팅 뉴스 아티클)
- 고객 문의 관리
- 성과 지표 시각화

---

## 2. 기술 스택

### 2.1 프론트엔드
- **Framework**: Next.js 14+ (App Router)
- **UI Library**: shadcn/ui
- **Styling**: Tailwind CSS
- **Charts**: Recharts 또는 Chart.js
- **State**: React Server Components + Client Components

### 2.2 백엔드/데이터
- **Analytics**: Google Analytics Data API (GA4)
- **GA4 속성 ID**: 514776969
- **인증**: Google OAuth 2.0 (서비스 계정)

### 2.3 배포
- **Platform**: Vercel
- **Project**: master-polarad-co-kr

---

## 3. 기능 요구사항

### Phase 1: 기본 구축 (MVP)

#### 3.1 대시보드 홈
- [ ] 오늘/어제/7일/30일 방문자 수 카드
- [ ] 실시간 활성 사용자 수
- [ ] 페이지뷰 추이 차트 (일별)
- [ ] 인기 페이지 Top 5
- [ ] 유입 경로 분포 (Direct, Organic, Referral, Social)

#### 3.2 GA4 통계 페이지
- [ ] 기간 선택 필터
- [ ] 세션 수, 사용자 수, 페이지뷰 상세
- [ ] 기기별 분포 (Desktop/Mobile/Tablet)
- [ ] 지역별 방문자 분포
- [ ] 랜딩 페이지 성과
- [ ] 이탈률, 평균 세션 시간

#### 3.3 사이드바 네비게이션
- [ ] 대시보드 (홈)
- [ ] 방문 통계
- [ ] 콘텐츠 관리 (Phase 2)
- [ ] 문의 관리 (Phase 2)
- [ ] 설정

### Phase 2: 확장 기능

#### 3.4 콘텐츠 관리
- [ ] 마케팅 뉴스 아티클 목록
- [ ] 아티클 조회수 통계
- [ ] 아티클 CRUD (향후)

#### 3.5 문의 관리
- [ ] 문의 내역 목록
- [ ] 문의 상태 관리 (신규/확인/완료)
- [ ] 문의 상세 보기

---

## 4. 화면 설계

### 4.1 레이아웃 구조
```
┌─────────────────────────────────────────────────────┐
│  Header (로고 + 사용자 정보)                         │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│ Sidebar  │         Main Content Area               │
│ (240px)  │                                          │
│          │                                          │
│ - 대시보드│                                          │
│ - 통계    │                                          │
│ - 콘텐츠  │                                          │
│ - 문의    │                                          │
│ - 설정    │                                          │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

### 4.2 대시보드 홈 레이아웃
```
┌─────────────────────────────────────────────────────┐
│ 통계 카드 4개 (오늘 방문자, 페이지뷰, 세션, 이탈률)   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [7일간 방문 추이 차트]           [유입 경로 차트]  │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [인기 페이지 Top 5]              [기기별 분포]     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 5. GA4 Data API 연동

### 5.1 필요한 데이터
| 지표 | GA4 Metric | 설명 |
|------|------------|------|
| 활성 사용자 | activeUsers | 기간 내 활성 사용자 |
| 신규 사용자 | newUsers | 신규 방문자 |
| 세션 수 | sessions | 총 세션 수 |
| 페이지뷰 | screenPageViews | 페이지 조회수 |
| 이탈률 | bounceRate | 이탈률 |
| 평균 세션 시간 | averageSessionDuration | 평균 체류 시간 |

### 5.2 필요한 디멘션
| 디멘션 | GA4 Dimension | 설명 |
|--------|---------------|------|
| 날짜 | date | 일별 데이터 |
| 페이지 경로 | pagePath | 페이지별 분석 |
| 기기 카테고리 | deviceCategory | Desktop/Mobile/Tablet |
| 유입 매체 | sessionDefaultChannelGroup | 채널별 분석 |
| 국가 | country | 지역별 분석 |

### 5.3 인증 설정
1. Google Cloud Console에서 서비스 계정 생성
2. GA4 속성에 서비스 계정 이메일 추가 (조회 권한)
3. 서비스 계정 JSON 키 다운로드
4. 환경 변수로 설정

---

## 6. 파일 구조

```
master_polarad/
├── docs/
│   └── PRD.md
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx          # 대시보드 레이아웃
│   │   │   ├── page.tsx            # 홈 (대시보드)
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx        # GA4 상세 통계
│   │   │   ├── content/
│   │   │   │   └── page.tsx        # 콘텐츠 관리
│   │   │   └── settings/
│   │   │       └── page.tsx        # 설정
│   │   ├── api/
│   │   │   └── analytics/
│   │   │       └── route.ts        # GA4 API 엔드포인트
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                     # shadcn/ui 컴포넌트
│   │   ├── dashboard/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── StatCard.tsx
│   │   │   └── Charts/
│   │   └── analytics/
│   │       ├── VisitorChart.tsx
│   │       ├── TrafficSourceChart.tsx
│   │       └── TopPagesTable.tsx
│   └── lib/
│       ├── utils.ts
│       └── google-analytics.ts     # GA4 API 클라이언트
├── .env.local                      # 환경 변수 (GA4 키)
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## 7. 환경 변수

```env
# Google Analytics Data API
GOOGLE_APPLICATION_CREDENTIALS=./credentials/ga4-service-account.json
GA4_PROPERTY_ID=514776969

# 또는 JSON 내용 직접 설정
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

---

## 8. 마일스톤

### Week 1: 기본 구조
- [x] PRD 문서 작성
- [ ] Next.js 프로젝트 초기화
- [ ] shadcn/ui 설정
- [ ] 레이아웃 (Sidebar, Header) 구현
- [ ] 대시보드 홈 UI 구현 (더미 데이터)

### Week 2: GA4 연동
- [ ] Google Cloud 서비스 계정 설정
- [ ] GA4 Data API 연동
- [ ] 실제 데이터로 차트 연동
- [ ] 기간 필터 구현

### Week 3: 확장 및 배포
- [ ] 상세 통계 페이지 구현
- [ ] 반응형 최적화
- [ ] Vercel 배포
- [ ] 성능 최적화

---

## 9. 참고 자료

- [Google Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [shadcn/ui 문서](https://ui.shadcn.com)
- [Next.js 14 App Router](https://nextjs.org/docs/app)
- 기존 사이트 디자인 가이드: `F:\polasales\website\.claude\DESIGN_GUIDE.md`
