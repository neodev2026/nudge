/**
 * Learning Card Type Enum
 * 학습 카드 타입 (Piotr Woźniak의 20개 학습 원칙 반영)
 */
export const CARD_TYPES = [
    'basic_meaning',      // 기본 의미 (Woźniak #3, #4)
    'pronunciation',       // 발음 (Woźniak #6, #11)
    'etymology',           // 어원 (Woźniak #1)
    'cloze',               // 빈칸 채우기 (Woźniak #5)
    'contrast',            // 대조 학습 (Woźniak #11)
    'cultural_context',    // 문화적 맥락 (Woźniak #2)
    'example',             // 예문 (Woźniak #2, #12)
    'derivatives',         // 파생어 (Woźniak #19)
    'idiom',               // 관용 표현 (Woźniak #2)
    'pos_specific',        // 품사 특화 (명사 성별, 동사 변화 등)
] as const;

/**
 * 카드 노출 범위 (Scope)
 */
export const CARD_SCOPES = ['shared', 'personalized'] as const;