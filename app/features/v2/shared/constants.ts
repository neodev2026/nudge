/**
 * SNS platform types supported by Nudge v2.
 * Discord is the initial implementation target.
 */
export const SNS_TYPES = [
  "discord",
  "kakao",
  "telegram",
  "email",
] as const;

/**
 * Learning card types for v2.
 * title and description are mandatory for every stage.
 * All others are optional, ordered by display_order.
 */
export const V2_CARD_TYPES = [
  "title",        // Word / term — mandatory, always first
  "description",  // Core meaning — mandatory, always second
  "image",        // Visual association
  "etymology",    // Word origin and root history
  "example",      // Example sentence with translation
  "option",       // Multiple choice or selection interaction
] as const;

/**
 * Stage types for nv2_stages.
 *
 * - welcome        : Delivered once at onboarding before any learning begins
 * - learning       : Standard vocabulary / content learning stage
 * - quiz_5              : Matching quiz triggered at every 5th new stage completion
 *                         (5, 15, 25, 35, 45, ...)
 * - quiz_10             : Matching quiz triggered at every 10th new stage completion
 *                         (10, 20, 30, 40, 50, ...) — replaces quiz_5 at those counts
 * - quiz_daily          : Quiz triggered when the user hits their daily new-stage goal
 * - quiz_final          : Comprehensive quiz triggered on full product completion
 * - congratulations     : Celebration stage delivered after the user masters all stages
 * - sentence_practice   : Sentence ordering + shadowing practice using example cards
 *                         from preceding learning stages in the same session
 */
export const V2_STAGE_TYPES = [
  "welcome",
  "learning",
  "quiz_5",
  "quiz_10",
  "quiz_daily",
  "quiz_final",
  "congratulations",
  "sentence_practice",
] as const;

/**
 * Self-evaluation result after completing a stage.
 */
export const SELF_EVAL_RESULTS = [
  "completed",  // User tapped "암기 완료"
  "retry",      // User tapped "처음부터 다시 보기"
] as const;

/**
 * Schedule types for SNS delivery.
 */
export const V2_SCHEDULE_TYPES = [
  "new",      // First delivery of a new stage
  "review",   // Spaced-repetition review delivery
  "quiz",     // Quiz stage link
  "cheer",    // Encouragement message for incomplete stage
  "welcome",  // Onboarding welcome stage
] as const;

/**
 * Review interval in days per round (1~4).
 */
export const REVIEW_INTERVALS_DAYS: Record<number, number> = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
} as const;

/**
 * Quiz types triggered by cumulative new-stage completion count.
 */
export const QUIZ_TYPES = [
  "quiz_5",   // Triggered after every 5 new stages completed
  "quiz_10",  // Triggered after every 10 new stages (replaces quiz_5 at the 10th)
] as const;

/**
 * Review status of a stage for a user.
 */
export const REVIEW_STATUSES = [
  "none",       // No review scheduled yet
  "r1_pending", // Awaiting 1st review (+1 day)
  "r2_pending", // Awaiting 2nd review (+3 days)
  "r3_pending", // Awaiting 3rd review (+7 days)
  "r4_pending", // Awaiting 4th review (+14 days)
  "mastered",   // All 4 reviews completed
] as const;

/**
 * Delivery status for a schedule row.
 */
export const SCHEDULE_STATUSES = [
  "pending",  // Queued, not yet sent
  "sent",     // Successfully delivered to SNS
  "failed",   // Delivery failed (see error_message)
  "opened",   // User tapped the delivered link
] as const;

/**
 * Daily learning plan presets.
 */
export const DAILY_GOAL_PRESETS = {
  lite:      { new: 3, review: 2 },
  standard:  { new: 5, review: 3 },
  intensive: { new: 10, review: 5 },
} as const;

/**
 * Link access control for user subscriptions.
 *
 * public       — anyone with the link can view and complete stages (no login required)
 * members_only — only authenticated Nudge users can access the session link
 */
export const V2_LINK_ACCESS_TYPES = [
  "public",
  "members_only",
] as const;

/**
 * User session kind.
 *
 * new    — first-time learning session
 * review — spaced-repetition review session (review_round 1~4)
 */
export const V2_SESSION_KINDS = [
  "new",
  "review",
] as const;

/**
 * User session status.
 *
 * pending     — session created, DM sent, user has not started yet
 * in_progress — user has opened the session and completed at least one stage
 * completed   — all stages in the session are completed
 */
export const V2_SESSION_STATUSES = [
  "pending",
  "in_progress",
  "completed",
] as const;

/**
 * Quiz timer duration in seconds per stage_type.
 *
 * Configurable per stage_type — adjust these values to change quiz duration
 * without touching UI code.
 *
 * quiz_5    : 5 stages × 4 seconds = 20 seconds
 * quiz_10   : 10 stages × 4 seconds = 40 seconds
 * quiz_daily: same as quiz_5 (default)
 * quiz_final: 60 seconds (comprehensive review)
 */
export const QUIZ_TIMER_SECONDS: Record<string, number> = {
  quiz_5:     20,
  quiz_10:    40,
  quiz_daily: 20,
  quiz_final: 60,
} as const;

/**
 * Quiz card pool size per stage_type.
 *
 * Defines how many recent learning stages to collect cards from
 * when building the quiz pool. Looks back across sessions if needed.
 *
 * quiz_5    : most recent 5 learning stages (current session)
 * quiz_10   : most recent 10 learning stages (current + previous session)
 * quiz_20   : most recent 20 learning stages (future)
 * quiz_50   : most recent 50 learning stages (future)
 * quiz_100  : most recent 100 learning stages (future)
 * quiz_daily: same as quiz_5
 * quiz_final: all stages in the product
 */
export const QUIZ_CARD_POOL_SIZE: Record<string, number> = {
  quiz_5:     5,
  quiz_10:    10,
  quiz_20:    20,
  quiz_50:    50,
  quiz_100:   100,
  quiz_daily: 5,
  quiz_final: 9999,
} as const;
