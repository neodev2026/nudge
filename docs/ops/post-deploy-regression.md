# 배포 후 최소 회귀 테스트 체크리스트

**문서 위치**: `docs/ops/post-deploy-regression.md`  
**실행 시점**: Production 배포 완료 직후 매회 실시  
**예상 시간**: 약 35분 (A~G 15분 + H Hyper-Sync 20분 — SRS H-15~17 + 묶음 발송 H-18~21 포함)  
**환경**: nudge.neowithai.com (Production)  
**결과 저장**: `docs/ops/test-results/YYYY-MM-DD-HH-deploy.md`

---

## 실행 방법

1. 아래 항목을 순서대로 확인한다.
2. 각 항목 결과를 **Pass / Fail / Skip**으로 기록한다.
3. Fail 발견 시 영역별 롤백 정책에 따라 조치한다 (아래 참조).
4. 결과를 `docs/ops/test-results/YYYY-MM-DD-HH-deploy.md`에 저장한다.

### 영역별 롤백 정책

| 영역 | Fail 시 조치 |
|---|---|
| A. 인증 / B. 학습 핵심 / C. Discord / D. 상품·구독 / E. 관리자 / F. Marathon / G. 랭킹 | **즉시 전체 롤백 검토** (이전 안정 버전으로 redeploy) |
| H. Hyper-Sync | **부분 롤백 가능** — `app/routes.ts`에서 hyper-sync 라우트 3개 + API 2개를 임시 주석 처리 후 핫픽스 재배포. 전체 롤백은 H 외 영역까지 영향 주므로 회피. |

---

## A. 인증

| # | 항목 | 절차 | 기대 결과 | 결과 |
|---|---|---|---|---|
| A-01 | Google OAuth 로그인 | `/login` → Google로 계속 → 계정 선택 | `/products`로 이동, 로그인 상태 유지 | |
| A-02 | 이메일 로그인 | `/login` → 이메일 + 비밀번호 입력 | 로그인 성공, 리디렉트 정상 | |
| A-03 | 비로그인 접근 차단 | `/products/deutsch-a1/checkout` 직접 접근 | `/login?next=` 으로 리디렉트 | |
| A-04 | 익명 체험 | 랜딩 → "무료 체험" 진입 | 로그인 없이 세션 화면 진입 | |

---

## B. 학습 핵심 흐름

| # | 항목 | 절차 | 기대 결과 | 결과 |
|---|---|---|---|---|
| B-01 | 세션 선택 화면 | `/sessions/:sessionId` 접속 | 학습 목록, Leni의 학습 옵션 표시 | |
| B-02 | Learning 스테이지 진입 | 학습 목록 → 첫 번째 stage 클릭 | 단어 카드 표시, 다음 버튼 동작 | |
| B-03 | TTS 재생 | Learning 카드에서 발음 듣기 버튼 클릭 | 음성 재생 | |
| B-04 | Auto-advance 동작 | 설정 ON 상태에서 Learning 진행 | 카드 완료 후 자동으로 다음 카드 이동 | |
| B-05 | Quiz 스테이지 | Quiz stage 진입 | 4지선다 문제 표시 | |
| B-06 | 세션 완료 | 모든 stage 완료 | 완료 화면 표시, 다음 세션 버튼 | |

---

## C. Discord 연동

| # | 항목 | 절차 | 기대 결과 | 결과 |
|---|---|---|---|---|
| C-01 | Discord DM 링크 | Discord DM에서 세션 링크 클릭 | 로그인 없이 `/sessions/:id` 직접 진입 | |
| C-02 | Discord OAuth 로그인 | `/login` → Discord로 계속 | 로그인 성공, Discord DM 활성화 | |
| C-03 | DM 발송 확인 | 테스트 계정으로 세션 완료 or n8n 웹훅 수동 호출 | 테스트용 Discord 계정에 DM 수신 | |

> **C-03 주의**: 실제 유저에게 DM이 발송되지 않도록 **테스트 전용 Discord 계정**을 지정해서 실시할 것.

---

## D. 상품 및 구독

| # | 항목 | 절차 | 기대 결과 | 결과 |
|---|---|---|---|---|
| D-01 | 상품 목록 | `/products` 접속 | 등록된 상품 목록 표시 | |
| D-02 | 무료 상품 구매 | `/products/deutsch-a1/checkout` → 무료로 시작 | 구독 생성, 학습 시작 가능 | |
| D-03 | 미구독 차단 | 미구독 계정으로 세션 URL 직접 접근 | 구독 안내 화면 표시 | |

---

## E. 관리자

| # | 항목 | 절차 | 기대 결과 | 결과 |
|---|---|---|---|---|
| E-01 | 관리자 접근 | `/admin` 접속 (관리자 계정) | 대시보드 표시 | |
| E-02 | 사용자 목록 | `/admin/users` | 사용자 목록 로드 | |
| E-03 | 마라톤 시즌 목록 | `/admin/marathon-seasons` | 시즌 목록 로드, 활성 시즌 배지 표시 | |

---

## F. Marathon Mode

| # | 항목 | 절차 | 기대 결과 | 결과 |
|---|---|---|---|---|
| F-01 | 진입점 표시 | `/sessions/:sessionId` 접속 | 마라톤 모드 옵션 표시 | |
| F-02 | 익명 차단 | 비로그인으로 `/products/deutsch-a1/marathon` 접근 | `/login?next=...` 리디렉트 | |
| F-03 | 스트림 시작 | 마라톤 모드 진입 | 첫 번째 카드 표시 | |
| F-04 | 이어하기 | 진행 중 브라우저 닫기 → 재접속 | 이어하기 버튼 표시, 진행 지점 복원 | |
| F-05 | 전체 출력 | 전체 출력 버튼 클릭 | 새 탭에서 프린트 페이지 열림 (`/products/:slug/marathon/print`) | |

---

## G. 마라톤 랭킹

| # | 항목 | 절차 | 기대 결과 | 결과 |
|---|---|---|---|---|
| G-01 | 헤더 메뉴 표시 | 비로그인으로 `/products` 접속 → 상단 nav 확인 | `학습 방법` `학습 상품` `마라톤 랭킹` 세 항목 표시 | |
| G-02 | 랭킹 페이지 비로그인 접근 | 비로그인으로 `/marathon-ranking` 접속 | 로그인 없이 페이지 정상 렌더링, 랭킹 목록 표시 | |
| G-03 | 학습 랭킹 점수 표시 | 활성 시즌 중 Marathon 스테이지 완료 후 `/marathon-ranking` 확인 | 완료한 스테이지 수가 점수로 표시됨 | |
| G-04 | 관리자 시즌 생성 | `/admin/marathon-seasons` → 새 시즌 폼 입력 후 생성 | 시즌 목록에 추가됨, 활성 시즌이면 배지 표시 | |

---

## H. Hyper-Sync

> 스펙: [`docs/core/hyper-sync-spec-2026-05-15.md`](../core/hyper-sync-spec-2026-05-15.md)  
> 상품 slug: `developer-english`

| # | 항목 | 절차 | 기대 결과 | 결과 |
|---|---|---|---|---|
| H-01 | 익명 미션 목록 | localStorage 초기화 후 `/hyper-sync` 접속 | 로그인 없이 미션 목록 표시, `anonymous_id`가 localStorage(`nudge_anon_id`)에 생성됨 | |
| H-02 | 비활성 미션 숨김 | 관리자에서 테스트 미션 1개 비활성화 후 `/hyper-sync` 재접속 | 해당 미션이 목록에서 사라짐 | |
| H-03 | 미션 시작 + 카드 진행 | 첫 미션 [시작하기] 클릭 | 세션 화면 진입, 1번 카드 앞면 + TTS 자동 1회 재생. 2초 후 뒷면 + [기억함]/[기억못함] 버튼 등장 | |
| H-04 | 타이머 자동 unknown | 뒷면 노출 후 3초 무동작 | SVG ring으로 카운트다운 시각화, 0초 도달 시 자동 '기억못함' 처리, 붉은 흔들림 애니메이션 | |
| H-05 | 5-step 복습 순서 | 카드 1개 [기억못함] 후 흐름 관찰 | step 1(단어 정방향, en TTS) → 2(역방향, ko TTS) → 3(예문, en TTS) → 4(역방향, ko TTS) → 5(단어 정방향, en TTS) 순서 노출 | |
| H-06 | 복습 중 '기억함' 즉시 통과 | 복습 step 2 진행 중 [기억함] 클릭 | step 3~5 스킵, 다음 일반 카드 또는 다음 복습 항목으로 이동 | |
| H-07 | 결과 화면 — 익명 | 익명으로 미션 완료 | 전체/기억함/기억못함 카운트 정확. 헤더에 [로그인][회원가입], 본문에 "로그인하면 Discord 복습" CTA 노출 | |
| H-08 | 결과 화면 — 로그인 | Discord 연동 테스트 계정으로 완료 (기억못함 ≥ 1) | "복습 예약 완료" 메시지. DB `nv2_schedules`에 `schedule_type='hyper_sync_review'` row 1건 생성 | |
| H-09 | scheduled_at timezone | H-08 직후 DB 확인 | `scheduled_at` = 사용자 `timezone` 기준 **다음 캘린더일 09:00**의 UTC ISO. 오후/저녁 완료여도 같은 날 발송 시각 잡히지 않음 | |
| H-10a | DM 발송 — Discord 연동 | 테스트 계정 schedule을 `POST /api/v2/cron/dispatch?schedule_id=N` 강제 호출 (CRON_SECRET 필요) | 테스트 계정 Discord에 복습 DM 수신, `status='sent'`, `sent_at` 업데이트 | |
| H-10b | 이메일 폴백 — Discord 미연동 | 이메일만 있는 테스트 계정 schedule을 같은 방식으로 dispatch | 테스트 이메일로 복습 메일 수신, `status='sent'` | |
| H-11 | 복습 페이지 진입 | DM/이메일의 [복습 시작] 버튼 클릭 | `/hyper-sync/review/:scheduleId` 진입, 5-step 복습 시작. DB `opened_at` 업데이트 | |
| H-12 | 다음 미션 이동 | 결과 화면 [다음 미션] 클릭 | 다음 `session_number` 미션의 진행 화면으로 이동. 상태가 깨끗하게 초기화되어 1번 카드부터 시작 | |
| H-13 | 중복 enqueue 방지 | (A,B,C)가 pending인 상태에서 다른 미션에서 (B,C,D) 기억못함 → enqueue 호출 | 새 schedule row 1건 추가 (cardIds=[D]), 기존 row와 별도 존재 | |
| H-14 | 비로그인 헤더 CTA | localStorage 초기화 후 `/hyper-sync` 접속 | 헤더 우측에 [로그인], [회원가입] 버튼 표시. 로그인 후 사라짐 | |
| H-15 | SRS — 첫 세션 [기억함] → r2_pending | 로그인 + 새 stage에서 step 1 [기억함] 후 DB 확인 | `nv2_stage_progress` row: `review_status='r2_pending'`, `review_round=2`. `nv2_schedules` row 1건: `review_round=2`, `scheduled_at` ≈ 사용자 tz 기준 3일 후 09:00 | |
| H-16 | SRS — 복습 step 1 pass → 다음 round 진입 | r1 schedule 강제 dispatch → DM/이메일 → 클릭 → review에서 step 1 [기억함] | progress: `r1→r2_pending`, `review_round=2`. 새 schedule: `review_round=2`, scheduled +3일. 결과 화면에 "↑ 1개 표현이 다음 단계로 이동" 표시 | |
| H-17 | SRS — mastered + 기억못함 → r1 강등 | r4_pending 통과해 mastered인 stage가 미션에 노출됐을 때 [기억못함] 처리 (수동: DB로 stage를 mastered 상태로 만든 뒤 시작) | progress: `mastered → r1_pending`, retry_count++. 새 schedule: `review_round=1`, scheduled +1일 | |
| H-18 | Dispatch 묶음 발송 | 같은 사용자에게 hyper_sync_review pending 2건 이상 만든 후 `POST /api/v2/cron/dispatch` (force 없이) 호출 | DM 1통만 도착. 본문에 합산된 카드 수. 모든 pending row → `status='sent'`. 발송 URL은 `/hyper-sync/review?ids=...` 형태 | |
| H-19 | Review 페이지 10개 청크 페이지네이션 | H-18에서 받은 DM 클릭 (15개 이상의 카드 누적된 상태) | 첫 묶음 10개 진행 → "묶음 1/2 완료 · N개 남음" 화면 → [다음 묶음 시작] → 나머지 카드 진행 → 최종 결과 화면. 진행 텍스트에 "묶음 1/2 · 복습 N/5" 표시 | |
| H-20 | Force-test 단건 발송 (회귀용) | `POST /api/v2/cron/dispatch?schedule_id=N` 으로 hyper_sync_review 단건 강제 호출 | 단건 DM 발송, `/hyper-sync/review/:scheduleId` 형태 URL (legacy 호환). 묶음 발송 동작에 영향 없음 | |
| H-21 | Legacy 단일 schedule URL backward compat | 과거 발송된 (Phase 1/2 초기) `/hyper-sync/review/:scheduleId` URL 직접 접속 | 정상 동작 — 단일 schedule만 로드, 청크 1개로 진행 | |

> **H 섹션 주의사항**
> - H-10a/b 발송 검증은 반드시 **테스트 전용 Discord 계정 + 테스트 이메일** 사용 (C-03 정책과 동일)
> - H-08 검증용 테스트 미션을 별도 더미로 운영. 실제 운영 미션을 H-02 토글에 사용하지 않을 것
> - H-10a/b 실행 후 schedule status가 'sent'로 바뀜 → 재테스트 시 SQL로 status='pending' 되돌리거나 새 schedule 생성

---

## Hyper-Sync 데이터 확인 (SQL)

배포 후 24시간 내 정상성 점검용. 각 쿼리를 Supabase SQL Editor에서 실행하여 결과 템플릿에 기록한다.

```sql
-- 1. 신규 결과 row 수 (사용자 활동량 지표)
SELECT count(*) AS total_results_24h
FROM nv2_hyper_sync_results
WHERE created_at >= now() - interval '24 hours';

-- 2. 익명 vs 로그인 비율
SELECT
  CASE WHEN auth_user_id LIKE 'anon:%' THEN 'anonymous' ELSE 'authenticated' END AS kind,
  count(*) AS cnt
FROM nv2_hyper_sync_results
WHERE created_at >= now() - interval '24 hours'
GROUP BY 1;

-- 3. 복습 schedule 상태별 카운트
SELECT status, count(*)
FROM nv2_schedules
WHERE schedule_type = 'hyper_sync_review'
  AND created_at >= now() - interval '24 hours'
GROUP BY status;

-- 4. 발송 실패 원인 추적 (status='failed')
SELECT schedule_id, auth_user_id, error_message, sent_at, retry_count
FROM nv2_schedules
WHERE schedule_type = 'hyper_sync_review' AND status = 'failed'
ORDER BY created_at DESC
LIMIT 10;

-- 5. dispatch 적체 확인 (scheduled_at 지났는데 pending인 row)
SELECT count(*) AS overdue_pending
FROM nv2_schedules
WHERE schedule_type = 'hyper_sync_review'
  AND status = 'pending'
  AND scheduled_at < now() - interval '1 hour';
```

**비정상 신호 기준**
- 쿼리 4 결과 ≥ 1 → `error_message` 확인, 발송기 코드 또는 외부 의존성(Discord API, Resend) 점검
- 쿼리 5 결과 ≥ 1 → dispatch cron이 작동 안 함. Supabase cron job 상태 점검
- 쿼리 1 결과 = 0 인데 트래픽 있음으로 추정되는 시점 → save-result API 호출 실패 의심, 브라우저 콘솔/네트워크 탭 점검

---

## 결과 기록 템플릿

결과 파일 저장 위치: `docs/ops/test-results/YYYY-MM-DD-HH-deploy.md`

```markdown
# 배포 후 회귀 테스트 결과

**배포 일시**: YYYY-MM-DD HH:MM  
**배포 커밋**: (git commit hash)  
**테스트 일시**: YYYY-MM-DD HH:MM  
**테스트 환경**: Production (nudge.neowithai.com)

## 결과 요약

- Pass: N
- Fail: N
- Skip: N

## Fail 항목

(없으면 "없음")

## 조치 사항

(없으면 "없음")

## Hyper-Sync 데이터 확인

| 쿼리 | 결과 | 비고 |
|---|---|---|
| 신규 results 24h | N | |
| 익명 / 로그인 비율 | M / N | |
| schedule status 분포 | pending=N, sent=N, failed=N, opened=N | |
| failed 카운트 | N | 1 이상이면 error_message 확인 |
| dispatch 적체 (overdue pending) | N | 1 이상이면 cron 상태 확인 |
```
