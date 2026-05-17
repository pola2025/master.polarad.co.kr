# master_polarad 세션 핸드오프 — 2026-04-27

## 작업 요약

접수관리 상세 모달 우측 잘림 버그 수정 + 블랙리스트 동작 검증 + 글로벌 웹 아키텍처 룰 저장

## 커밋 (배포 완료)

- `aeef3fc` fix(inquiries): 상세모달 가로 오버플로우 — overflow-x-hidden + break-all/break-words
- `9ff49c9` fix(inquiries): grid 컬럼 auto 사이징 → minmax(0,1fr) (실제 근본 원인 해결)

## 핵심 해결 (재사용 가치 높음)

**문제**: shadcn `DialogContent`의 기본 `display:grid` + `grid-auto-columns:auto`가 자식의 max-content를 따라 컬럼을 부풀려 `max-w-lg`를 무력화. 긴 고객 이름(`#인테리어. #리모델링. __주거. 상업. 업무공간.`) 입력 시 헤더 619px → 컨테이너 512px 초과 → "블랙리스트 등록" 버튼 우측 잘림.

**해결**: `grid-cols-[minmax(0,1fr)]` 추가로 컬럼을 0~1fr 가변 트랙으로 강제.

**라이브 DOM 검증**:

- 적용 전: scrollWidth 667, headerRow 619, button R=1201 (dialog R=1101 초과)
- 적용 후: scrollWidth 510, headerRow 462, button R=1044 (정상)

상세: `F:\obsidian\Pola\Troubleshooting\css.md` (shadcn Dialog 항목 추가됨)

## 블랙리스트 동작 검증 (사용자 확인 완료)

D1 `blacklist` 테이블이 단일 SoT — Meta webhook과 홈페이지 폼(worker-secure.js) 양쪽 동일 동작:

- D1 inquiry 저장 (status=Hold, memo=[블랙리스트])
- 고객 SMS/이메일 스킵
- 관리자 텔레그램 블랙리스트 알림만 (`⚫ [polarad/form]` 또는 `⚫ [webhook/meta-lead]`)

## 글로벌 룰 추가

`C:\Users\flame\.claude\rules\web-architecture.md` — Vercel(Next.js) + Cloudflare(D1·Workers) 하이브리드 기본 아키텍처. Airtable 미사용. 신규 홈페이지·서비스 프로젝트 기본 출발점.

## Q&A 정리

- **Vercel 대안**: Cloudflare Pages가 가장 넉넉(무제한 대역폭). 단 Next.js는 Vercel 네이티브가 OpenNext 어댑터보다 빠름. 현재 하이브리드(폼=CF, 대시보드=Vercel)가 합리적.
- **Meta 비즈니스 인증 실패 메시지**: 파트너의 Business Portfolio가 Meta 인증 미통과 → 수락 자체는 가능하나 광고비 한도·기능 제한 발생. 광고대행 SOP에 "온보딩 = 비즈니스 인증부터" 단계 박을 것 권장.
- **Google OAuth invalid_client**: env var 줄바꿈(`\n`) 가장 흔한 원인. `vercel env pull` 후 `cat -A`로 확인. `printf "%s"`로 재설정.

## 미커밋 파일 (다음 세션에서 정리)

```
docs/email-open-notification-wireframe.html
docs/make-meta-lead-webhook-setup.html
docs/upstash-redis-setup-guide.html
scripts/send-design20-intro.mjs
scripts/seo-audit-polarad.ts
workers/d1-proxy/migrations/0002_content_extra_columns.sql
master_polarad_20260427_d1-content-pipeline-v2_세션핸드오프.md (이전 세션 잔재)
```

## 다음 액션 후보

- [ ] Google Ads API Basic Access 승인 후속 작업 (NEXT_SESSION_google-ads-followup.md)
- [ ] 이메일 오픈 알림 와이어프레임 검토 (docs/email-open-notification-wireframe.html)
- [ ] D1 콘텐츠 파이프라인 v2 후속 (이전 세션 잔재 파일 정리)

## 참고 트러블슈팅

- `F:\obsidian\Pola\Troubleshooting\css.md` — shadcn Dialog 모달 우측 잘림 (이번 세션 추가)
- `F:\obsidian\Pola\Troubleshooting\vercel.md` — Vercel env var 줄바꿈 사고 (OAuth 디버깅 시 참조)
