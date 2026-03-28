/**
 * Application Routes Configuration
 *
 * Route groups:
 *  - Core utilities (robots, sitemap)
 *  - API routes (settings, cron, v2 actions)
 *  - v2 public routes (/, /products, /stages, /sessions, /quiz, /auth)
 *  - Legacy / future routes (commented out)
 *
 * 파일이 실제로 생성된 시점에 주석을 해제하세요.
 * 주석 처리된 라우트 = 아직 파일 미생성
 */
import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes";

export default [
  // ── Core ────────────────────────────────────────────────────────────────
  route("/robots.txt", "core/screens/robots.ts"),
  route("/sitemap.xml", "core/screens/sitemap.ts"),

  // ── API ─────────────────────────────────────────────────────────────────
  ...prefix("/api", [
    ...prefix("/settings", [
      route("/theme",  "features/settings/api/set-theme.tsx"),
      route("/locale", "features/settings/api/set-locale.tsx"),
    ]),

    // v2 Cron endpoints — uncomment as each file is created
    // ...prefix("/v2/cron", [
    //   route("/dispatch",        "features/v2/cron/api/dispatch.tsx"),
    //   route("/review-schedule", "features/v2/cron/api/review-schedule.tsx"),
    //   route("/daily-reset",     "features/v2/cron/api/daily-reset.tsx"),
    // ]),

    // ✅ 구현 완료
    ...prefix("/v2", [
      route("/stage/:stageId/complete",     "features/v2/stage/api/complete.tsx"),
      route("/stage/:stageId/retry",        "features/v2/stage/api/retry.tsx"),
      route("/products/:slug/start",        "features/v2/products/api/start-learning.tsx"),
      route("/sessions/:sessionId/complete","features/v2/session/api/complete.tsx"),
      // route("/quiz/:quizId/result",      "features/v2/quiz/api/result.tsx"),
    ]),
  ]),

  // ── Admin (이메일 로그인 필요) ────────────────────────────────────────────
  route("/admin/login",  "features/admin/screens/login.tsx"),
  route("/admin/logout", "features/admin/screens/logout.tsx"),
  layout("core/layouts/admin.layout.tsx", [
    ...prefix("/admin", [
      index("features/admin/screens/dashboard.tsx"),
      // 🔜 파일 생성 후 주석 해제
      // route("/products/new",                        "features/admin/screens/product-new.tsx"),
      route("/products/:id",                        "features/admin/screens/product-detail.tsx"),
      route("/products/:id/stages/new",             "features/admin/screens/stage-new.tsx"),
      route("/products/:id/stages/:stageId",        "features/admin/screens/stage-edit.tsx"),
      // route("/products/:id/sessions/new",          "features/admin/screens/session-new.tsx"),
      // route("/products/:id/sessions/:sessionId",   "features/admin/screens/session-edit.tsx"),
    ]),
  ]),

  // Admin API actions (outside layout — no sidebar needed)
  ...prefix("/admin/api", [
    route("/stages/upsert",       "features/admin/api/stages.tsx"),
    route("/stages/:id/delete",   "features/admin/api/stage-delete.tsx"),
    route("/cards/upsert",        "features/admin/api/cards.tsx"),
    route("/cards/:id/delete",    "features/admin/api/card-delete.tsx"),
  ]),

  // ── v2 Public layout ──────────────────────────────────────────────────
  layout("core/layouts/v2.layout.tsx", [

    // ✅ 구현 완료
    index("features/v2/home/screens/home-page.tsx"),

    // ✅ 구현 완료
    route("/products",       "features/v2/products/screens/products-page.tsx"),
    route("/products/:slug", "features/v2/products/screens/product-detail-page.tsx"),

    // ✅ 구현 완료
    route("/stages/:stageId",   "features/v2/stage/screens/stage-page.tsx"),

    // ✅ 구현 완료
    route("/sessions/:sessionId", "features/v2/session/screens/session-page.tsx"),

    // 🔜 파일 생성 후 주석 해제
    // route("/quiz/:quizId", "features/v2/quiz/screens/quiz-page.tsx"),

    // ✅ 구현 완료
    ...prefix("/auth", [
      route("/discord/start",    "features/v2/auth/screens/discord-start.tsx"),
      route("/discord/callback", "features/v2/auth/screens/discord-callback.tsx"),
    ]),

    // Legal
    ...prefix("/legal", [
      route("/:slug", "features/legal/screens/policy.tsx"),
    ]),
  ]),

  // ── Legacy routes ────────────────────────────────────────────────────────
  // [Auth — v1]
  // layout("core/layouts/navigation.layout.tsx", [ ... ]),
  //
  // [Dashboard — v1]
  // layout("core/layouts/private.layout.tsx", { id: "private-dashboard" }, [ ... ]),
  //
  // [Payments]
  // ...prefix("/payments", [ ... ]),
  //
  // [Blog]
  // layout("features/blog/layouts/blog.layout.tsx", [ ... ]),
  //
  // [v1 Learning Cards]
  // route("/learning-products", ...),
  //
  // [Lite — 개발 중단]
  // layout("core/layouts/lite.layout.tsx", [ ... ]),
  //
  // [Debug — 배포 전 제거]
  // ...prefix("/debug", [ ... ]),

] satisfies RouteConfig;
