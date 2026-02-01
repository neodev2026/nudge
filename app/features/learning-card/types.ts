/**
 * [업데이트] 학습자 언어(Learner Locale)가 추가된 표준 데이터 구조
 */
export interface StandardizedCardData {
    presentation: {
      front: string;  
      back: string;   
      hint?: string; // learner_locale에 해당하는 언어로 작성됨
    };
    details: {
      explanation: string; // learner_locale에 해당하는 언어로 작성됨
      example_context: {
        sentence: string;       
        translation: string; // learner_locale에 해당하는 언어로 작성됨
      };
      visual_cue?: string;      
    };
    meta: {
      target_locale: string; // 학습 대상 언어 (TTS용)
      learner_locale: string; // 학습자의 모국어 (UI 및 설명용)
      logic_key: string;      
    };
}