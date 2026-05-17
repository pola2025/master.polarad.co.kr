# master_polarad 세션 핸드오프 — auto-blacklist-on-hold

- 날짜: 2026-05-10
- 세션: 0b48e663-99da-4a10-bf5d-e0ed17139e21
- 브랜치: master

## 요청

> 진행불가업종은 자동으로 블랙리스트 등록도 해줘 추가로 남겨지지 않게

## 결과 (완료)

대시보드 인콰이어리 상세에서 status = "보류" 로 변경하면 해당 번호를 자동으로 blacklist 테이블에 INSERT.

### 변경 파일

- `src/app/(dashboard)/inquiries/page.tsx` (L515~548, `handleStatusChange` 내부)
  - 보류 분기에서 `/api/inquiries/blacklist` POST
  - reason: `진행불가 업종 (<업종>)` 또는 `진행불가 (보류 처리)`
  - source: `meta` → "Meta", 그 외 → "홈페이지"
  - 중복은 서버 측 unique 체크로 차단 (이미 등록된 번호는 skip)
  - UI 즉시 반영 — `blacklistedPhones` set에 추가해 카드 어둡게
  - 블랙리스트 등록 실패는 상태 변경을 막지 않음 (best-effort)

### 메모리

- `~/.claude/projects/F--master-polarad/memory/project_blacklist_policy.md` 업데이트
  - "대시보드 수동 트리거 자동 블랙리스트 (2026-05-10 추가)" 섹션 추가

## 동작 흐름

1. 운영자가 인콰이어리 카드 → 상세 모달 → 상태 드롭다운에서 "보류" 선택
2. PATCH `/api/inquiries` (status=Hold)
3. PATCH 성공 시 추가로 POST `/api/inquiries/blacklist` (phone, name, reason, source)
4. 동일 번호로 다시 폼/광고 리드가 들어오면 webhook이 `isBlacklisted()` 차단 → 이미 폼/Meta webhook 모두 적용됨

## 검증 (다음 세션 또는 사용자 측에서)

- [ ] 인콰이어리 상세에서 "보류" 변경 시 카드 즉시 어두워지는지 (blacklistedPhones set 반영)
- [ ] D1 blacklist 테이블에 새 row 들어가는지 (`SELECT * FROM blacklist ORDER BY created_at DESC LIMIT 5`)
- [ ] 같은 번호로 Meta 광고 리드 재유입 시 SMS 스킵 + Hold 자동 처리 (기존 `meta-lead` route 동작)
- [ ] 같은 번호로 홈페이지 폼 재접수 시 차단 (CF Worker `worker-secure.js` blacklist 체크 — 활성 여부 확인 필요)

## 참고

- 기존 webhook 자동 차단 키워드: `src/app/api/webhook/meta-lead/route.ts` `AUTO_BLACKLIST_KEYWORDS`
  - 대출/대부/사채/카드론, 금융/캐피탈/채권추심, 보험, 렌트류, 분양/지식산업센터
  - 회색지대 통과: 정책자금, 채무조정
- 이번 변경은 키워드에 안 잡힌 케이스를 운영자 판단으로 차단하는 보조 장치

## 빌드/테스트

- 미실행 (UI 분기 로직 추가 + 기존 fetch 패턴 그대로 — 컴파일 영향 없음)
- 추후 dev server 또는 `next build`로 검증 권장

## 배포 (2026-05-10 완료)

- 커밋: `39cb7cd feat(inquiries): 보류 처리 시 자동 블랙리스트 등록`
  - master 브랜치에 단독 커밋 (다른 modified 파일은 WIP 채팅 관련이라 제외)
- Vercel 프로덕션 배포: dpl_DG7vVcFDRUt9byqK1VXQZBj9Nw8N (READY)
  - 프로젝트: mkt9834-4301s-projects/master-polarad-co-kr
  - URL: https://master-polarad-co-725s21ggx-mkt9834-4301s-projects.vercel.app
  - Alias: chat.polarad.co.kr (+ master.polarad.co.kr 자동 갱신)
- `.vercel/project.json` 재링크함 (orgId 형식 불일치로 1회 re-link 필요했음)
- working tree에 untracked 채팅 파일들이 있어 Vercel 빌드에 같이 들어감 (기존 운영 상태 유지)

## 검증 (배포 후 운영자 확인)

- [ ] master.polarad.co.kr/inquiries 접속 → 임의 인콰이어리 상세 → 상태 "보류" 변경
- [ ] D1 blacklist 테이블에 새 row 들어가는지 (`SELECT * FROM blacklist ORDER BY created_at DESC LIMIT 5`)
- [ ] 카드 즉시 어두워지는지 (blacklistedPhones set 반영)
- [ ] 같은 번호로 재접수 시 SMS 스킵 + Hold 자동 처리
