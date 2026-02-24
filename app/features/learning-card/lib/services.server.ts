/**
 * Learning Card Service
 * Acts as a proxy between the Remix server and n8n orchestration engine.
 */
import db from "~/core/db/drizzle-client.server";
import { eq } from "drizzle-orm";
import { cardDeliveryQueue } from "~/features/card-delivery/schema";

export async function processCardFeedback({
  userId,
  deliveryId,
  cardId,
  quality,
}: {
  userId: string;
  deliveryId: string;
  cardId: string;
  quality: number;
}) {
  return await db.transaction(async (tx) => {
    // 1. Mark the current delivery as received to prevent duplicate processing
    await tx
      .update(cardDeliveryQueue)
      .set({
        status: "feedback_received",
        updated_at: new Date(),
      })
      .where(eq(cardDeliveryQueue.id, deliveryId));

    // 2. Delegate business logic (SM-2, Scheduling) to n8n Flow 5
    const n8nWebhookUrl = process.env.N8N_FLOW5_WEBHOOK_URL;
    if (!n8nWebhookUrl) throw new Error("n8n Webhook URL is not configured");

    const response = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Nudge-Secret": process.env.N8N_WEBHOOK_AUTH_KEY || "", // Secure auth between server and n8n
      },
      body: JSON.stringify({
        user_id: userId,
        delivery_id: deliveryId,
        learning_card_id: cardId,
        feedback_score: quality,
      }),
    });

    if (!response.ok) {
      throw new Error(`n8n communication failed: ${response.statusText}`);
    }

    // 3. Return the calculated next session info provided by n8n
    const result = await response.json();
    return {
      success: true,
      nextReviewAt: result.nextReviewAt,
      nextCardName: result.nextCardName,
      nextCardType: result.nextCardType,
    };
  });
}