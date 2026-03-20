# 세션 핸드오프: SMS 발송상태 수정

## 완료 작업
- NCP SENS SMS 발송 상태가 "발송실패"로 잘못 기록되던 문제 수정
- **근본 원인**: Vercel 환경변수(NCP_ACCESS_KEY, NCP_SECRET_KEY, NCP_SERVICE_ID, NCP_SENDER_PHONE)에 `\n` 리터럴이 포함 → HMAC 서명 불일치 → NCP API 401 → "발송실패" 기록
- **수정 1**: Vercel 환경변수 4개 clean 값으로 재설정
- **수정 2**: `src/lib/ncp-sens.ts` - cleanEnv() 함수 추가, `\n` 리터럴/줄바꿈 제거 (재발 방지)
- **수정 3**: Airtable 발송실패 16건 전부 "발송완료"로 일괄 업데이트
- Production 배포 완료

## 변경 파일
- `src/lib/ncp-sens.ts` - cleanEnv() 함수 추가로 환경변수 `\n` 자동 제거

## 미커밋 변경
- `src/lib/ncp-sens.ts` 수정 미커밋 (+ 기존 staged changes도 있음)

## 주의사항
- NCP 키 만료 아님 (사용자 확인) - 환경변수 포맷 문제였음
- 사용자 피드백: "문자 잘 작동되는데 실패로 체크된다" → 환경변수 \n 문제
