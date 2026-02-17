/**
 * Card Delivery Status Enum Values
 * Updated to include retry states for worker reliability.
 */
export const CARD_DELIVERY_STATUS = [
  "pending",           // Initial state, waiting for the first delivery attempt
  "sent",              // Successfully delivered via SNS (e.g., Discord)
  "retry_required",    // [New] Transient error occurred; scheduled for a retry
  "failed",            // Permanent failure or max retries reached
  "cancelled",         // Manually or system cancelled
  "opened",            // User clicked the link in the message
  "feedback_received", // User submitted learning feedback
] as const;

export type CardDeliveryStatus = (typeof CARD_DELIVERY_STATUS)[number];