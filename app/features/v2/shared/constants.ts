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
 */
export const V2_STAGE_TYPES = [
  "welcome",
  "learning",
  "quiz_5",
  "quiz_10",
  "quiz_current_session",
  "quiz_current_and_prev_session",
  "quiz_daily",
  "quiz_final",
  "congratulations",
  "sentence_practice",
  "dictation",   // Listen to TTS and type what you hear
  "writing",     // Compose sentences using session vocabulary with AI feedback
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
 *
 * new     — daily learning DM (new session link)
 * review  — spaced-repetition review session DM
 * cheer   — nudge/encouragement DM for incomplete sessions
 * welcome — onboarding welcome DM sent once on first sign-in
 */
export const V2_SCHEDULE_TYPES = [
  "new",
  "review",
  "cheer",
  "welcome",
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
  "quiz_5",
  "quiz_10",
] as const;

/**
 * Review status of a stage for a user.
 */
export const REVIEW_STATUSES = [
  "none",
  "r1_pending",
  "r2_pending",
  "r3_pending",
  "r4_pending",
  "mastered",
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
 */
export const V2_LINK_ACCESS_TYPES = [
  "public",
  "members_only",
] as const;

/**
 * User session kind.
 */
export const V2_SESSION_KINDS = [
  "new",
  "review",
] as const;

/**
 * User session status.
 */
export const V2_SESSION_STATUSES = [
  "pending",
  "in_progress",
  "completed",
] as const;

/**
 * Quiz timer duration in seconds per stage_type.
 */
export const QUIZ_TIMER_SECONDS: Record<string, number> = {
  quiz_5:                        90,
  quiz_10:                       120,
  quiz_current_session:          90,
  quiz_current_and_prev_session: 120,
  quiz_daily:                    20,
  quiz_final:                    60,
} as const;

/**
 * Quiz card pool size per stage_type.
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

/**
 * Fixed local times (hour, minute) at which enqueue-nudge Cron runs.
 * Leni sends a cheer DM if the user has not completed their session by each time slot.
 * The Cron runs every 30 minutes and matches users whose local time falls within
 * [scheduled_hour:scheduled_minute, +30 minutes).
 */
export const NUDGE_SCHEDULE_TIMES = [
  { hour: 9,  minute: 0  },  // 09:00
  { hour: 11, minute: 30 },  // 11:30
  { hour: 14, minute: 0  },  // 14:00
  { hour: 17, minute: 30 },  // 17:30
  { hour: 21, minute: 0  },  // 21:00
] as const;

/**
 * Leni cheer messages sent as nudge DMs when a user has not completed their session.
 * Keyed by local hour. Four variants per slot — one is chosen at random.
 *
 * Character: Leni, 15-year-old German girl studying with Nudge.
 * Tone: warm, bright, encouraging. Polite Korean (존댓말).
 * Occasionally sprinkles German expressions.
 */
export const NUDGE_MESSAGES: Record<number, string[]> = {
  9: [
    "혹시 오늘 학습 잊으신 건 아니죠? 😄 저도 깜빡할 뻔 했어요! 같이 해봐요!",
    "아직 안 하셨죠? 괜찮아요, 저도 방금 시작했어요! 🌟 같이 해요~",
    "오늘 학습 아직이시죠? Ich auch! 저도요! 😆 우리 같이 해봐요!",
    "혹시 학습 링크 못 보셨어요? 📬 저 여기 기다리고 있었어요!",
  ],
  11: [
    "오전에 많이 바쁘셨죠? 😊 점심 맛있게 드시고, 딱 5분만요! 저도 같이 할게요!",
    "점심 식사는 하셨어요? 🍱 밥 먹고 나서 잠깐 해봐요! 생각보다 금방 끝나요~",
    "오전이 너무 바쁘셨나봐요! Kein Problem! 😄 점심 드시고 나서 함께 해봐요!",
    "배고프실 시간이에요! 🍜 맛있는 거 드시고 오늘 학습도 같이 해봐요, 응원해요!",
  ],
  14: [
    "오후에도 많이 바쁘시죠? 😢 저도 오늘 공부하기 싫었는데 그래도 했어요! 조금만요, 약속해요? 🤙",
    "피곤하시죠? 저도 그래요~ 😪 그래도 오늘 학습만큼은 꼭 같이 해요! Versprochen! (약속!)",
    "오늘 정말 바쁘신가봐요! 😅 딱 이것만 하고 쉬어요! 저 믿죠? 금방이에요~",
    "아직 안 하셨군요! 😮 사실 저도 미루고 있었어요... 우리 같이 지금 바로 해요! 🙌",
  ],
  17: [
    "오늘 하루 정말 수고 많으셨어요! 🌇 저녁 맛있게 드시고, 딱 한 번만 더 도전해봐요! 응? 😊",
    "Feierabend! (퇴근 시간!) 🎉 오늘 충분히 열심히 하셨잖아요! 저녁 드시고 마지막으로 같이 해봐요~",
    "저녁 드셨어요? 🍽️ 저 오늘 Schnitzel 먹었어요 😋 맛있는 거 드시고 오늘 학습 꼭 같이 해요!",
    "오후도 고생 많으셨죠? 😄 이따 저녁 드시고 나서 꼭 해요! 저 여기서 기다릴게요~",
  ],
  21: [
    "오늘 하루 정말 수고 많으셨어요 🌙 많이 피곤하시죠? 오늘은 푹 쉬시고, 내일 저랑 꼭 같이 해요! Gute Nacht! 🌟",
    "오늘도 바쁜 하루였죠? 😊 저도 오늘 공부 겨우 다 했어요! 내일은 같이 일찍 시작해봐요~",
    "늦은 시간까지 정말 고생하셨어요 💪 오늘 못 하신 거 너무 신경 쓰지 마세요! 내일 또 도전해봐요!",
    "Gute Nacht! 🌙 오늘은 쉬세요~ 내일 아침 학습 DM 보내드릴게요! 저도 내일 더 열심히 할 거예요! 😄",
  ],
};

/**
 * Returns a random cheer message for the given local hour.
 * Falls back to the 9:00 slot if no message exists for the given hour.
 */
export function getRandomNudgeMessage(local_hour: number): string {
  const messages = NUDGE_MESSAGES[local_hour] ?? NUDGE_MESSAGES[9];
  return messages[Math.floor(Math.random() * messages.length)];
}
