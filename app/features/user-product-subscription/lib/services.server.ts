import db from "~/core/db/drizzle-client.server";
import { eq, and, asc } from "drizzle-orm";
import { userSNSConnection } from "~/features/user-sns-connection/schema";
import { learningContent } from "~/features/learning-content/schema";
import { learningCard } from "~/features/learning-card/schema";
import { learningContentProgress } from "~/features/learning-content-progress/schema";
import { userLearningContentProgress } from "~/features/user-learning-content-progress/schema";
import { userProductSubscription } from "~/features/user-product-subscription/schema";
import { cardDeliveryQueue } from "~/features/card-delivery/schema";

/**
 * Maps subscription tiers to their respective dispatch delay durations (in seconds).
 */
const TIER_DELAY_MAP = {
  basic: 7200,    // 2 hours
  premium: 300,   // 5 minutes
  vip: 0          // Instant
};

/**
 * Executes the complete subscription and learning engine initialization.
 * Wrapped in a single transaction to ensure data atomicity.
 */
export async function subscribeAndInitializeAction(
  userId: string, 
  productId: string,
  snsConnectionId: string,
  tier: "basic" | "premium" | "vip" = "basic",
  dailyGoal: number = 10 // Added: Configurable daily goal, defaulting to 10
) {
  // Determine the dispatch delay based on the chosen subscription tier
  const dispatchDelaySeconds = TIER_DELAY_MAP[tier];

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
    // Stores the daily goal and the calculated dispatch delay for n8n Flow 1.
    const [subscription] = await tx
      .insert(userProductSubscription)
      .values({
        userId,
        learningProductId: productId,
        userSnsConnectionId: snsConnection.id,
        subscriptionTier: tier,
        dailyGoal, // [Added]
        dispatchDelaySeconds, // [Added]
        isActive: true,
        pushEnabled: true,
        subscribedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userProductSubscription.userId, userProductSubscription.learningProductId],
        set: { 
          subscriptionTier: tier, 
          dailyGoal, // [Added] Ensure goal is updated
          dispatchDelaySeconds, // [Added] Ensure delay policy is updated
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
      // General Statistics Tracking
      await tx
        .insert(userLearningContentProgress)
        .values({
          userId,
          learningProductId: productId,
          learningContentId: content.id,
        })
        .onConflictDoNothing();

      // SM-2 Algorithm Variable Initialization
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
    // Starts the learning cycle immediately upon subscription.
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