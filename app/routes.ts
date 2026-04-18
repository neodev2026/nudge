/**
 * Application Routes Configuration
 *
 * Route groups:
 *  - Core utilities (robots, sitemap)
 *  - API routes (settings, cron, v2 actions)
 *  - v2 nav layout (/, /products, /login, /join)
 *  - v2 public routes (/stages, /sessions, /quiz, /auth, etc.)
 *  - Legacy / future routes (commented out)
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

    // v2 Cron endpoints
    ...prefix("/v2/cron", [
      route("/daily-reset",   "features/v2/cron/api/daily-reset.tsx"),
      route("/enqueue-daily", "features/v2/cron/api/enqueue-daily.tsx"),
      route("/enqueue-nudge", "features/v2/cron/api/enqueue-nudge.tsx"),
      route("/dispatch",      "features/v2/cron/api/dispatch.tsx"),
    ]),

    // v2 action endpoints
    ...prefix("/v2", [
      route("/stage/:stageId/complete",      "features/v2/stage/api/complete.tsx"),
      route("/stage/:stageId/retry",         "features/v2/stage/api/retry.tsx"),
      route("/products/:slug/start",         "features/v2/products/api/start-learning.tsx"),
      route("/products/:slug/purchase",      "features/v2/products/api/purchase.tsx"),
      route("/products/:slug/trial",         "features/v2/products/api/trial.tsx"),
      route("/sessions/:sessionId/complete",       "features/v2/session/api/complete.tsx"),
      route("/sessions/:sessionId/reset-progress", "features/v2/session/api/reset-progress.tsx"),
      route("/quiz/:stageId/result",         "features/v2/quiz/api/result.tsx"),
      route("/sentence/:stageId/result",     "features/v2/sentence/api/result.tsx"),
      route("/chat/:sessionId/message",      "features/v2/chat/api/message.tsx"),
      route("/dictation/:stageId/result",    "features/v2/dictation/api/result.tsx"),
      route("/writing/:stageId/result",      "features/v2/writing/api/result.tsx"),
      route("/auth/delete-account",             "features/v2/auth/screens/delete-account.tsx"),
    ]),
  ]),

  // ── Admin ────────────────────────────────────────────────────────────────
  route("/admin/login",  "features/admin/screens/login.tsx"),
  route("/admin/logout", "features/admin/screens/logout.tsx"),
  layout("core/layouts/admin.layout.tsx", [
    ...prefix("/admin", [
      index("features/admin/screens/dashboard.tsx"),
      route("/users",                              "features/admin/screens/users.tsx"),
      route("/trial-sessions",                     "features/admin/screens/trial-sessions.tsx"),
      route("/products/new",                       "features/admin/screens/product-new.tsx"),
      route("/products/:id",                       "features/admin/screens/product-detail.tsx"),
      route("/products/:id/stages/new",            "features/admin/screens/stage-new.tsx"),
      route("/products/:id/stages/:stageId",       "features/admin/screens/stage-edit.tsx"),
      route("/products/:id/sessions/:sessionId",   "features/admin/screens/session-edit.tsx"),
    ]),
  ]),
  ...prefix("/admin/api", [
    route("/stages/upsert",            "features/admin/api/stages.tsx"),
    route("/stages/:id/delete",        "features/admin/api/stage-delete.tsx"),
    route("/cards/upsert",             "features/admin/api/cards.tsx"),
    route("/cards/:id/delete",         "features/admin/api/card-delete.tsx"),
    route("/sessions/:id/delete",      "features/admin/api/session-delete.tsx"),
    route("/turns/grant",              "features/admin/api/turn-grant.tsx"),
    route("/users/:authUserId/update", "features/admin/api/user-update.tsx"),
    route("/users/:authUserId/delete", "features/admin/api/user-delete.tsx"),
    route("/maintenance/toggle",       "features/admin/api/maintenance.tsx"),
  ]),

  // ── v2 Nav layout (top navigation bar) ───────────────────────────────────
  // Applied to: landing, product list/detail, login, join
  layout("core/layouts/v2-nav.layout.tsx", [
    index("features/v2/home/screens/home-page.tsx"),
    route("/products",       "features/v2/products/screens/products-page.tsx"),
    route("/products/:slug", "features/v2/products/screens/product-detail-page.tsx"),
    route("/products/:slug/checkout", "features/v2/products/screens/checkout.tsx"),

    // v2 auth pages
    route("/login",   "features/v2/auth/screens/login.tsx"),
    route("/join",    "features/v2/auth/screens/join.tsx"),
    route("/account", "features/v2/auth/screens/account.tsx"),
  ]),

  // ── v2 Learning routes (no nav bar — full-screen mobile) ─────────────────
  layout("core/layouts/v2.layout.tsx", [
    route("/stages/:stageId",           "features/v2/stage/screens/stage-page.tsx"),
    route("/sessions/:sessionId",       "features/v2/session/screens/session-choice-page.tsx"),
    route("/sessions/:sessionId/list",  "features/v2/session/screens/session-page.tsx"),
    route("/sessions/:sessionId/chat",  "features/v2/chat/screens/chat-page.tsx"),
    route("/quiz/:stageId",             "features/v2/quiz/screens/quiz-page.tsx"),
    route("/sentence/:stageId",         "features/v2/sentence/screens/sentence-page.tsx"),
    route("/dictation/:stageId",        "features/v2/dictation/screens/dictation-page.tsx"),
    route("/writing/:stageId",          "features/v2/writing/screens/writing-page.tsx"),

    ...prefix("/legal", [
      route("/:slug", "features/legal/screens/policy.tsx"),
    ]),
  ]),

  // ── Auth routes (outside layout — redirect-only) ─────────────────────────
  ...prefix("/auth", [
    route("/discord/start",       "features/v2/auth/screens/discord-start.tsx"),
    route("/discord/start-oauth", "features/v2/auth/screens/discord-start-oauth.tsx"),
    route("/discord/callback",    "features/v2/auth/screens/discord-callback.tsx"),
    route("/google/start",        "features/v2/auth/screens/google-start.tsx"),
    route("/google/callback",     "features/v2/auth/screens/google-callback.tsx"),
    route("/logout",              "features/v2/auth/screens/logout.tsx"),
  ]),

  // ── Maintenance ──────────────────────────────────────────────────────────
  route("/maintenance", "features/v2/home/screens/maintenance-page.tsx"),

  // ── Legacy routes ────────────────────────────────────────────────────────
  // [Dashboard — v1]
  // layout("core/layouts/private.layout.tsx", { id: "private-dashboard" }, [ ... ]),
  //
  // [Payments]
  // ...prefix("/payments", [ ... ]),
  //
  // [Blog]
  // layout("features/blog/layouts/blog.layout.tsx", [ ... ]),

] satisfies RouteConfig;
