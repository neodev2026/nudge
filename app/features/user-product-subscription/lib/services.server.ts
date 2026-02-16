import db from "~/core/db/drizzle-client.server";
import { eq, and, asc } from "drizzle-orm";
import { userSNSConnection } from "~/features/user-sns-connection/schema";
import { learningContent } from "~/features/learning-content/schema";
import { learningCard, learningContentProgress } from "~/features/learning-card/schema";
import { userLearningContentProgress } from "~/features/user-learning-content-progress/schema";
import { userProductSubscription } from "~/features/user-product-subscription/schema";
import { cardDeliveryQueue } from "~/features/card-delivery/schema";

/**
 * Executes the complete subscription and learning engine initialization.
 * Wrapped in a single transaction to ensure data atomicity.
 */
export async function subscribeAndInitializeAction(
  userId: string, 
  productId: string,
  snsConnectionId: string,
  tier: "basic" | "premium" | "vip" = "basic"
) {
  return await db.transaction(async (tx) => {
    // 1. Validate Active SNS Connection
    const [snsConnection] = await tx
      .select()
      .from(userSNSConnection)
      .where(
        and(
          eq(userSNSConnection.userId, userId),
          eq(userSNSConnection.id, snsConnectionId),
          eq(userSNSConnection.isActive, true),
          eq(userSNSConnection.pushEnabled, true)
        )
      )
      .orderBy(asc(userSNSConnection.isPrimary))
      .limit(1);

    if (!snsConnection) {
      throw new Error("SNS_CONNECTION_REQUIRED"); 
    }

    // 2. Create or Update Product Subscription
    const [subscription] = await tx
      .insert(userProductSubscription)
      .values({
        userId,
        learningProductId: productId,
        userSnsConnectionId: snsConnection.id,
        subscriptionTier: tier,
        isActive: true,
        pushEnabled: true,
        subscribedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userProductSubscription.userId, userProductSubscription.learningProductId],
        set: { 
          subscriptionTier: tier, 
          isActive: true, 
          userSnsConnectionId: snsConnection.id,
          updated_at: new Date() 
        },
      })
      .returning();

    // 3. Fetch All Active Contents for the Product
    const contents = await tx
      .select({ id: learningContent.id })
      .from(learningContent)
      .where(
        and(
          eq(learningContent.learningProductId, productId),
          eq(learningContent.isActive, true)
        )
      )
      .orderBy(asc(learningContent.displayOrder));

    if (contents.length === 0) {
      return { success: true, message: "No contents found" };
    }

    // 4. Initialize Progress for Each Content
    for (const content of contents) {
      // General Statistics
      await tx
        .insert(userLearningContentProgress)
        .values({
          userId,
          learningProductId: productId,
          learningContentId: content.id,
        })
        .onConflictDoNothing();

      // SM-2 Algorithm Variables
      await tx
        .insert(learningContentProgress)
        .values({
          userId,
          learningContentId: content.id,
          iteration: 0,
          easiness: 2.5,
          interval: 0,
          nextReviewAt: new Date(),
        })
        .onConflictDoNothing();
    }

    // 5. Queue the First Learning Card
    const firstContent = contents[0];
    const [firstCard] = await tx
      .select({ id: learningCard.id })
      .from(learningCard)
      .where(
        and(
          eq(learningCard.learningContentId, firstContent.id),
          eq(learningCard.isActive, true),
          eq(learningCard.isValid, true)
        )
      )
      .orderBy(asc(learningCard.displayOrder))
      .limit(1);

    if (firstCard) {
      await tx
        .insert(cardDeliveryQueue)
        .values({
          userId,
          connectionId: snsConnection.id,
          learningCardId: firstCard.id,
          scheduledAt: new Date(),
          status: 'pending',
        });
    }

    return { success: true, subscriptionId: subscription?.id };
  });
}