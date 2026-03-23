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
