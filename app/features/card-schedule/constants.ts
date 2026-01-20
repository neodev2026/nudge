export const DELIVERY_STATUSES = [
    'pending',           // 전송 대기 중
    'sent',              // 전송 완료
    'failed',            // 전송 실패
    'opened',            // 사용자가 카드 열람
    'feedback_received', // 피드백 받음 (학습 완료)
] as const;