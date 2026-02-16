/**
 * Card Delivery Status Enum Values
 * Includes tracking statuses from the original card_schedule design
 */
export const CARD_DELIVERY_STATUS = [
    "pending",           // Waiting to be picked up by n8n worker
    "sent",              // Successfully sent via SNS
    "failed",            // Error occurred during transmission
    "cancelled",         // Manually or system cancelled (e.g., unsubscribed)
    "opened",            // User clicked the link in the message
    "feedback_received", // User submitted learning feedback via the card
  ] as const;
  
  export type CardDeliveryStatus = (typeof CARD_DELIVERY_STATUS)[number];