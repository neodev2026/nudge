/**
 * 구독 티어 (Subscription Tier) Enum 정의
 * - basic: 무료 (학습 대기 2시간)
 * - premium: 월 3,900원 (학습 대기 5분)
 * - vip: 월 8,900원 (즉시 학습, AI 개인화 카드 제공)
 */
export const SUBSCRIPTION_TIERS = ['basic', 'premium', 'vip'] as const;
