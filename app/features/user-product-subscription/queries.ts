import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";

/**
 * Creates or updates a user's product subscription.
 * Note: The Supabase client requires keys to match the database column names (snake_case).
 */
export const createSubscription = async (
  client: SupabaseClient<Database>,
  { 
    userId, 
    productId, 
    snsConnectionId, 
    tier,
    dailyGoal
  }: { 
    userId: string; 
    productId: string; 
    snsConnectionId: string; 
    tier: "basic" | "premium" | "vip";
    dailyGoal: number;
  }
) => {
  const { data, error } = await client
    .from("user_product_subscription")
    .upsert({
      user_id: userId,
      learning_product_id: productId,
      user_sns_connection_id: snsConnectionId,
      subscription_tier: tier,
      daily_goal: dailyGoal,
      is_active: true,
      push_enabled: true,
      subscribed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Initializes all required learning data upon successful product subscription.
 * This includes progress tracking and scheduling the first delivery.
 */
export const initializeSubscriptionData = async (
  client: SupabaseClient<Database>,
  { 
    userId, 
    productId, 
    snsConnectionId 
  }: { 
    userId: string; 
    productId: string; 
    snsConnectionId: string;
  }
) => {
  debugger;

  // 1. Fetch all active contents for the subscribed product
  const { data: contents, error: contentsError } = await client
    .from("learning_content")
    .select("id, display_order")
    .eq("learning_product_id", productId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (contentsError) throw contentsError;
  if (!contents || contents.length === 0) return;

  // 2. Initialize progress for all contents
  // Create entries for both general progress and SM-2 algorithm tracking
  for (const content of contents) {
    // Initialize general user progress
    const { error: userProgressError } = await client
      .from("user_learning_content_progress")
      .upsert({
        user_id: userId,
        learning_product_id: productId,
        learning_content_id: content.id,
      }, { onConflict: 'user_id,learning_product_id,learning_content_id' });

    if (userProgressError) throw userProgressError;

    // Initialize SM-2 algorithm variables
    const { error: sm2Error } = await client
      .from("learning_content_progress")
      .upsert({
        user_id: userId,
        learning_content_id: content.id,
        iteration: 0,
        easiness: 2.5,
        interval: 0,
        next_review_at: new Date().toISOString(),
      }, { onConflict: 'user_id,learning_content_id' });

    if (sm2Error) throw sm2Error;
  }

  // 3. Identify and queue the first learning card
  const firstContent = contents[0];
  const { data: firstCard, error: cardError } = await client
    .from("learning_card")
    .select("id")
    .eq("learning_content_id", firstContent.id)
    .eq("is_active", true)
    .eq("is_valid", true)
    .order("display_order", { ascending: true })
    .limit(1)
    .single();

  if (cardError && cardError.code !== "PGRST116") throw cardError; // PGRST116 is 'no rows'

  // 4. Insert the first nudge into the delivery queue
  if (firstCard) {
    const { error: queueError } = await client
      .from("card_delivery_queue")
      .insert({
        user_id: userId,
        connection_id: snsConnectionId,
        learning_card_id: firstCard.id,
        scheduled_at: new Date().toISOString(), // Schedule for immediate pick-up by n8n
        status: "pending",
      });

    if (queueError) throw queueError;
  }

  return { success: true };
};