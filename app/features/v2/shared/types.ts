import type {
  SNS_TYPES,
  V2_CARD_TYPES,
  SELF_EVAL_RESULTS,
  V2_SCHEDULE_TYPES,
  REVIEW_STATUSES,
  QUIZ_TYPES,
  SCHEDULE_STATUSES,
} from "./constants";

export type SnsType = (typeof SNS_TYPES)[number];
export type V2CardType = (typeof V2_CARD_TYPES)[number];
export type SelfEvalResult = (typeof SELF_EVAL_RESULTS)[number];
export type V2ScheduleType = (typeof V2_SCHEDULE_TYPES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type QuizType = (typeof QUIZ_TYPES)[number];
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

/**
 * Card content structure for v2 learning cards.
 * Used as the JSONB shape for nv2_cards.card_data.
 */
export interface V2CardData {
  presentation: {
    front: string;   // Primary display text (word, image url, question)
    back: string;    // Revealed content (meaning, answer)
    hint?: string;   // Optional hint in learner_locale
  };
  details: {
    explanation: string;  // Supplementary explanation in learner_locale
    example_context?: {
      sentence: string;    // Target-language example sentence
      translation: string; // Translation in learner_locale
    };
    visual_cue?: string;  // Image URL or visual description
  };
  meta: {
    target_locale: string;  // Language being learned (e.g. "en")
    learner_locale: string; // Learner's native language (e.g. "ko")
    logic_key: string;      // Unique key used for quiz card pairing
  };
}

/**
 * Quiz result snapshot stored in nv2_quiz_results.result_snapshot.
 */
export interface QuizResultSnapshot {
  quiz_type: QuizType;
  covered_stage_ids: string[];  // Stage IDs in scope for this quiz
  matched_pairs: number;        // Total correct pairs across all loops
  score: number;                // Total score (word+meaning=10pt, audio+meaning=30pt)
  duration_seconds: number;     // Total elapsed time
  completed_at: string;         // ISO timestamp
}
