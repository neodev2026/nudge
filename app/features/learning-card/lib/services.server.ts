/**
 * Learning Card Service
 * Handles the SM-2 algorithm logic, progress updates, and next nudge scheduling.
 */
import db from "~/core/db/drizzle-client.server";
import { eq, and, sql, asc, desc } from "drizzle-orm";

// Schema imports
import { learningCard, learningContentProgress } from "../schema";
import { learningContent } from "~/features/learning-content/schema";
import { userSNSConnection } from "~/features/user-sns-connection/schema";
import { cardDeliveryQueue } from "~/features/card-delivery/schema";
import { userLearningContentProgress } from "~/features/user-learning-content-progress/schema";

/**
 * Processes user feedback for a card and prepares the next learning step.
 * Uses a single database transaction to ensure data integrity.
 */
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
    // 1. Fetch current card details to identify the content
    const [targetCard] = await tx
      .select()
      .from(learningCard)
      .where(eq(learningCard.id, cardId))
      .limit(1);

    if (!targetCard) throw new Error("Card not found");

    // 2. Fetch user's current progress for this specific content
    const [currentProgress] = await tx
      .select()
      .from(learningContentProgress)
      .where(
        and(
          eq(learningContentProgress.userId, userId),
          eq(learningContentProgress.learningContentId, targetCard.learningContentId)
        )
      )
      .limit(1);

    if (!currentProgress) throw new Error("Progress record not found");

    // 3. Fetch a valid SNS connection for the next delivery
    const [snsConnection] = await tx
      .select({ id: userSNSConnection.id })
      .from(userSNSConnection)
      .where(
        and(
          eq(userSNSConnection.userId, userId),
          eq(userSNSConnection.isActive, true),
          eq(userSNSConnection.pushEnabled, true)
        )
      )
      .orderBy(desc(userSNSConnection.isPrimary))
      .limit(1);

    if (!snsConnection) {
      throw new Error("No active SNS connection found for delivery");
    }

    // 4. SM-2 Algorithm Calculation
    let { iteration, easiness, interval, currentCardIndex } = currentProgress;

    if (quality >= 3) {
      // Correct response
      if (iteration === 0) {
        interval = 1;
      } else if (iteration === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easiness);
      }
      iteration += 1;
    } else {
      // Incorrect response: reset iteration
      iteration = 0;
      interval = 1;
    }

    // Adjust Easiness Factor (EF): minimum value is 1.3
    easiness = easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (easiness < 1.3) easiness = 1.3;

    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + interval);

    // 5. Card Rotation Logic: Determine the next card in the sequence
    const nextCardIndex = (currentCardIndex + 1) % 10;

    // Join with learningContent to get the content name for the UI
    const [nextCardData] = await tx
      .select({
        id: learningCard.id,
        type: learningCard.cardType,
        contentName: learningContent.contentName,
      })
      .from(learningCard)
      .innerJoin(
        learningContent, 
        eq(learningCard.learningContentId, learningContent.id)
      )
      .where(
        and(
          eq(learningCard.learningContentId, targetCard.learningContentId),
          eq(learningCard.isActive, true),
          eq(learningCard.isValid, true)
        )
      )
      .orderBy(asc(learningCard.displayOrder))
      .offset(nextCardIndex)
      .limit(1);

    // 6. Database Updates

    // A. Update SM-2 progress state
    await tx
      .update(learningContentProgress)
      .set({
        iteration,
        easiness: easiness,
        interval,
        currentCardIndex: nextCardIndex,
        nextReviewAt,
        lastReviewAt: new Date(),
        updated_at: new Date(),
      })
      .where(
        and(
          eq(learningContentProgress.userId, userId),
          eq(learningContentProgress.learningContentId, targetCard.learningContentId)
        )
      );

    // B. Update general learning statistics
    await tx
      .update(userLearningContentProgress)
      .set({
        studyCount: sql`${userLearningContentProgress.studyCount} + 1`,
        lastFeedbackScore: quality,
        lastStudiedAt: new Date(),
        updated_at: new Date(),
      })
      .where(
        and(
          eq(userLearningContentProgress.userId, userId),
          eq(userLearningContentProgress.learningContentId, targetCard.learningContentId)
        )
      );

    // C. Finalize the current delivery record
    await tx
      .update(cardDeliveryQueue)
      .set({
        status: "feedback_received",
        updated_at: new Date(),
      })
      .where(eq(cardDeliveryQueue.id, deliveryId));

    // D. Queue the next nudge in the delivery table
    if (nextCardData) {
      await tx.insert(cardDeliveryQueue).values({
        userId,
        connectionId: snsConnection.id,
        learningCardId: nextCardData.id,
        scheduledAt: nextReviewAt,
        status: "pending",
        previousDeliveryId: deliveryId,
      });
    }

    // Return next session details for immediate UI feedback
    return { 
      success: true, 
      nextReviewAt, 
      nextCardName: nextCardData?.contentName || "Unknown",
      nextCardType: nextCardData?.type || "Unknown"
    };
  });
}