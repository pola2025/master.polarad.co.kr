# 세션 핸드오프 — 2026-04-27 D1 마이그 + 콘텐츠 파이프라인 v2

## 완료된 작업

### 1. Airtable → Cloudflare D1 마이그레이션 (전체)

- **master_polarad**: 19테이블 + Worker proxy + 17 라우트 D1 전환 + Vercel 배포 완료
- **polarad_frontend**: worker-secure.js (홈페이지 폼) + marketing-news/airtable.ts (블로그) D1 전환
- **iMac polarad-pipeline/pipeline.py**: 콘텐츠 자동화 D1 직접 INSERT
- 데이터 마이그: 5,470+건 (54초)

### 2. 콘텐츠 파이프라인 v2 (5개/일)

- 카테고리 5개 + launchd 5 plist 분산 (10:30/11:00/11:30/12:00/12:30 KST)
  - ai-trends, ai-news, ai-tips, interior-leadgen (신규), online-ads-leadgen (신규)
- Step 6 Opus 최종 종합 검수 추가 (텍스트+이미지+캡션 일관성, improved_caption 자동 적용)

### 3. 운영 안정화 패치 5종 (오늘 발견 + 즉시 패치)

1. Codex 이미지 3회 재시도 + 15s/30s backoff
2. 이미지 실패 시 status=draft-review 강등
3. Slug 카테고리 prefix 강제 (SLUG_PREFIX_MAP)
4. airtable_check_today: discarded/deleted 무시
5. Post-pipeline: force_category 한정 record (중복 인스타 발행 차단)

### 4. 오늘(4/27) 5개 카테고리 모두 발행 검증

- 폴라애드 홈페이지 5개 슬러그 모두 HTTP 200
- D1 + Instagram + ISR revalidate 모두 정상
- 할루시네이션 케이스 1건 발견 → discarded 처리 + 재발행 → 새 글로 교체

## 인프라 정보

- D1 DB: `polarad-main` (id `34c3517e-d564-486d-95a4-c2e04f183388`, APAC)
- Worker: `https://polarad-d1-proxy.mkt9834.workers.dev`
- iMac: `pola@192.168.219.109` (paramiko SSH 자동화)
- launchd: `com.polarad.content-pipeline-{1-ai-trends,2-ai-news,3-ai-tips,4-interior,5-online-ads}`

## 백업

```
iMac: pipeline.py.bak.20260427_5cat (5 카테고리 추가 직전)
iMac: pipeline.py.bak.20260427_slug_imgfail (slug+img patches 직전)
iMac: pipeline.py.bak.20260427_v3 (check_today + force_category 직전)
iMac: .env.bak.20260427 (D1 변수 추가 직전)
master_polarad: git commit d4785a8 (D1 마이그 본 commit)
polarad_frontend: git commit b54f95f (marketing-news D1)
```

## 다음 세션 시작 시 확인 사항

1. **launchd 자동 발행 안정성** — 4/28 10:30부터 5회 자동 정상 작동 확인
2. **할루시네이션 패턴 추가 발견 시** — title 자연스러움 검증 (단어 나열형 거부) 패치 검토
3. **Step 6 Opus 검수 결과 누적 분석** — improved_caption 적용 빈도, warn 패턴
4. **Gemini 텍스트 검색 그라운딩** — 사용자 결정으로 그대로 유지 (전환 보류)

## 미완료 / 보류

- (보류) Gemini 텍스트 검색 → Codex web search 전환 (사용자 "그대로 유지" 결정)
- (보류) title 자연스러움 검증 (단어 나열 거부) — 향후 필요 시
- 폴라애드 프론트 Vercel preview env에 D1_PROXY 누락 (Production+Development만 등록됨, preview 누락은 git-branch prompt 차이)
- AIRTABLE\_\* env 정리 — 1~2주 안정 후 .env.local + Vercel env에서 제거
- Airtable bases 백업/archive — 운영 안정 확인 후

## 참고 문서

- [메모리 — D1 마이그레이션](C:\Users\flame.claude\projects\F--master-polarad\memory\project_d1_migration.md)
- [메모리 — 콘텐츠 파이프라인 v2](C:\Users\flame.claude\projects\F--master-polarad\memory\project_content_pipeline_v2.md)
- [메모리 — Revenue 시스템](C:\Users\flame.claude\projects\F--master-polarad\memory\project_revenue_system.md)
