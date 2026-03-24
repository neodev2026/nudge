/**
 * Application Routes Configuration
 *
 * Route groups:
 *  - Core utilities (robots, sitemap)
 *  - API routes (settings, cron)
 *  - v2 public routes (/, /products, /stage, /quiz, /auth)
 *  - Legacy / future routes (commented out — re-enable when needed)
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

    // v2 Stage / Quiz action endpoints — uncomment as each file is created
    // ...prefix("/v2", [
    //   route("/stage/:stageId/complete", "features/v2/stage/api/complete.tsx"),
    //   route("/stage/:stageId/retry",    "features/v2/stage/api/retry.tsx"),
    //   route("/quiz/:quizId/result",     "features/v2/quiz/api/result.tsx"),
    // ]),
  ]),

  // ── v2 Public layout (로그인/비로그인 모두 접근 가능) ──────────────────────
  layout("core/layouts/v2.layout.tsx", [

    // ✅ 구현 완료
    index("features/v2/home/screens/home-page.tsx"),

    // 🔜 파일 생성 후 주석 해제
    // route("/products",     "features/v2/products/screens/products-page.tsx"),
    // route("/products/:id", "features/v2/products/screens/product-detail-page.tsx"),

    // 🔜 파일 생성 후 주석 해제
    // route("/stages/:stageId", "features/v2/stage/screens/stage-page.tsx"),

    // 🔜 파일 생성 후 주석 해제
    // route("/quiz/:quizId", "features/v2/quiz/screens/quiz-page.tsx"),

    // 🔜 파일 생성 후 주석 해제
    // ...prefix("/auth", [
    //   route("/discord/start",    "features/v2/auth/screens/discord-start.tsx"),
    //   route("/discord/callback", "features/v2/auth/screens/discord-callback.tsx"),
    // ]),

    // Legal — always needed for deployment
    ...prefix("/legal", [
      route("/:slug", "features/legal/screens/policy.tsx"),
    ]),
  ]),

  // ── Legacy routes (supaplate 기본 제공 — 추후 필요 시 재활성화) ───────────
  //
  // [Auth — v1 방식]
  // layout("core/layouts/navigation.layout.tsx", [
  //   route("/auth/confirm", "features/auth/screens/confirm.tsx"),
  //   route("/error",        "core/screens/error.tsx"),
  //   layout("core/layouts/public.layout.tsx", [
  //     route("/login", "features/auth/screens/login.tsx"),
  //     route("/join",  "features/auth/screens/join.tsx"),
  //     ...prefix("/auth", [
  //       route("/api/resend",            "features/auth/api/resend.tsx"),
  //       route("/forgot-password/reset", "features/auth/screens/forgot-password.tsx"),
  //       route("/magic-link",            "features/auth/screens/magic-link.tsx"),
  //       ...prefix("/otp", [
  //         route("/start",    "features/auth/screens/otp/start.tsx"),
  //         route("/complete", "features/auth/screens/otp/complete.tsx"),
  //       ]),
  //       ...prefix("/social", [
  //         route("/start/:provider",    "features/auth/screens/social/start.tsx"),
  //         route("/complete/:provider", "features/auth/screens/social/complete.tsx"),
  //       ]),
  //     ]),
  //   ]),
  //   layout("core/layouts/private.layout.tsx", { id: "private-auth" }, [
  //     ...prefix("/auth", [
  //       route("/forgot-password/create", "features/auth/screens/new-password.tsx"),
  //       route("/email-verified",         "features/auth/screens/email-verified.tsx"),
  //     ]),
  //     route("/logout",            "features/auth/screens/logout.tsx"),
  //     route("/user-sns-settings", "features/user-sns-connection/screens/sns-settings-page.tsx"),
  //   ]),
  //   route("/contact", "features/contact/screens/contact-us.tsx"),
  // ]),
  //
  // [Dashboard — v1]
  // layout("core/layouts/private.layout.tsx", { id: "private-dashboard" }, [
  //   layout("features/users/layouts/dashboard.layout.tsx", [
  //     ...prefix("/dashboard", [index("features/users/screens/dashboard.tsx")]),
  //     route("/account/edit", "features/users/screens/account.tsx"),
  //   ]),
  // ]),
  //
  // [Payments]
  // ...prefix("/payments", [
  //   index("features/payments/screens/payments.tsx"),
  //   route("/checkout", "features/payments/screens/checkout.tsx"),
  //   layout("core/layouts/private.layout.tsx", { id: "private-payments" }, [
  //     route("/success", "features/payments/screens/success.tsx"),
  //     route("/failure", "features/payments/screens/failure.tsx"),
  //   ]),
  // ]),
  //
  // [Blog]
  // layout("features/blog/layouts/blog.layout.tsx", [
  //   ...prefix("/blog", [
  //     index("features/blog/screens/posts.tsx"),
  //     route("/:slug", "features/blog/screens/post.tsx"),
  //   ]),
  // ]),
  //
  // [v1 Learning Cards]
  // route("/learning-products",            "features/learning-product/screens/products-page.tsx"),
  // route("/learning-products/:productId", "features/learning-product/screens/product-detail-page.tsx"),
  // route("/welcome",                      "features/users/screens/welcome-page.tsx"),
  // route("/cards/simulation",             "features/learning-card/screens/simulation.tsx"),
  // route("/cards/simulation-page",        "features/learning-card/screens/simulation-page.tsx"),
  // layout("core/layouts/private.layout.tsx", [
  //   route("/cards/:cardId", "features/learning-card/screens/learning-card.tsx"),
  // ]),
  //
  // [Lite — 개발 중단]
  // layout("core/layouts/lite.layout.tsx", [
  //   ...prefix("/lite", [
  //     index("features/lite/screens/home-page.tsx"),
  //     route("products/:id",          "features/lite/screens/product-detail-page.tsx"),
  //     route("success",               "features/lite/screens/sns-conn-success-page.tsx"),
  //     route("cards/:delivery_id",    "features/lite/screens/learning-card-page.tsx"),
  //     route("auth/discord/callback", "features/lite/callback/auth-discord-callback.tsx"),
  //   ]),
  // ]),
  //
  // [Debug — 개발 전용, 배포 전 제거]
  // ...prefix("/debug", [
  //   route("/sentry",    "debug/sentry.tsx"),
  //   route("/analytics", "debug/analytics.tsx"),
  // ]),

] satisfies RouteConfig;