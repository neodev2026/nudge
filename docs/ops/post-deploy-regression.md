# 배포 후 최소 회귀 테스트 체크리스트

**문서 위치**: `docs/ops/post-deploy-regression.md`  
**실행 시점**: Production 배포 완료 직후 매회 실시  
**예상 시간**: 약 15분  
**환경**: nudge.neowithai.com (Production)  
**결과 저장**: `docs/ops/test-results/YYYY-MM-DD-HH-deploy.md`

---

## 실행 방법

1. 아래 항목을 순서대로 확인한다.
2. 각 항목 결과를 **Pass / Fail / Skip**으로 기록한다.
3. **Fail이 1개라도 있으면 즉시 롤백을 검토한다.**
4. 결과를 `docs/ops/test-results/YYYY-MM-DD-HH-deploy.md`에 저장한다.

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
```
