/**
 * [Queries for Nudge Lite]
 * All queries are managed here using the Supabase Client.
 * All comments are in English according to the project policy.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";

/**
 * Fetch all active learning products for the Lite version's exhibition section.
 * Returns only products marked as 'is_active'.
 */
export const getLiteActiveProducts = async (
  client: SupabaseClient<Database>
) => {
  const { data, error } = await client
    .from("learning_product")
    .select("*")
    .eq("is_active", true);

  if (error) throw error;
  return data;
};

/**
 * Fetch a specific learning product by its ID.
 */
export const getLiteProductDetail = async (
  client: SupabaseClient<Database>,
  product_id: string
) => {
  const { data, error } = await client
    .from("learning_product")
    .select("*")
    .eq("id", product_id)
    .single();

  if (error) throw error;
  return data;
};

/**
 * Fetch all learning contents associated with a specific product.
 * Ordered by 'order_index' to show the curriculum correctly.
 */
export const getLiteProductContents = async (
  client: SupabaseClient<Database>,
  product_id: string
) => {
  const { data, error } = await client
    .from("learning_content")
    .select("id, content_name, description, display_order")
    .eq("learning_product_id", product_id)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data;
};

/**
 * Create or update a Lite user profile based on SNS ID and Type.
 */
export const upsertLiteProfile = async (
  client: SupabaseClient<Database>,
  {
    sns_type,
    sns_id,
  }: { sns_type: Database["public"]["Enums"]["sns_type"]; sns_id: string }
) => {
  const { data, error } = await client
    .from("lite_profiles")
    .upsert({ sns_type, sns_id, subscription_status: "active" })
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Initialize learning progress for a Lite user.
 * Sets the first content and card as the starting point.
 */
export const initializeLiteProgress = async (
  client: SupabaseClient<Database>,
  {
    sns_type,
    sns_id,
    learning_product_id,
    current_content_id,
    total_cards_count,
  }: {
    sns_type: Database["public"]["Enums"]["sns_type"];
    sns_id: string;
    learning_product_id: string;
    current_content_id: string;
    total_cards_count: number;
  }
) => {
  const { data, error } = await client
    .from("lite_content_progress")
    .insert({
      sns_type,
      sns_id,
      learning_product_id,
      current_content_id,
      completed_cards_count: 0,
      total_cards_count,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Check if the Lite user already has progress for a specific product.
 */
export const getLiteProgress = async (
  client: SupabaseClient<Database>,
  { sns_type, sns_id, learning_product_id }: { sns_type: Database["public"]["Enums"]["sns_type"]; sns_id: string; learning_product_id: string }
) => {
  const { data, error } = await client
    .from("lite_content_progress")
    .select("*")
    .eq("sns_type", sns_type)
    .eq("sns_id", sns_id)
    .eq("learning_product_id", learning_product_id)
    .maybeSingle(); // Returns null if not found instead of throwing error

  if (error) throw error;
  return data;
};

/**
 * Fetch the first learning card.
 * Table 'learning_card' uses 'id' as PK and 'display_order' for sequence.
 */
export const getFirstCardOfContent = async (
  client: SupabaseClient<Database>,
  learning_content_id: string
) => {
  const { data, error } = await client
    .from("learning_card")
    .select("id, card_data, display_order") // card_data contains the payload
    .eq("learning_content_id", learning_content_id)
    .eq("is_active", true) // Ensure the card is ready for users
    .eq("is_valid", true)  // Quality check
    .order("display_order", { ascending: true })
    .limit(1)
    .single();

  if (error) throw error;
  return data;
};

/**
 * Update progress with the last sent card.
 * 'last_card_id' references 'learning_card.id' (UUID).
 */
export const updateProgressLastCard = async (
  client: SupabaseClient<Database>,
  { 
    sns_type, 
    sns_id, 
    learning_product_id, 
    last_card_id 
  }: { 
    sns_type: string; 
    sns_id: string; 
    learning_product_id: string; 
    last_card_id: string; 
  }
) => {
  const { error } = await client
    .from("lite_content_progress")
    .update({ last_card_id })
    .match({ sns_type, sns_id, learning_product_id });

  if (error) throw error;
};

/**
 * Fetch detailed content of a specific card.
 */
export const getLiteCardDetail = async (
  client: SupabaseClient<Database>,
  card_id: string
) => {
  const { data, error } = await client
    .from("learning_card")
    .select("id, card_data, learning_content_id")
    .eq("id", card_id)
    .single();

  if (error) throw error;
  return data;
};

/**
 * Record user feedback and increment completed count.
 * Uses the custom naming 'progress_id' for the Lite table.
 */
export const recordLiteFeedback = async (
  client: SupabaseClient<Database>,
  { 
    sns_type, 
    sns_id, 
    learning_product_id, 
    score 
  }: { 
    sns_type: string; 
    sns_id: string; 
    learning_product_id: string; 
    score: number;
  }
) => {
  // 1. Get current progress to increment count
  const { data: progress } = await client
    .from("lite_content_progress")
    .select("completed_cards_count")
    .match({ sns_type, sns_id, learning_product_id })
    .single();

  const new_count = (progress?.completed_cards_count || 0) + 1;

  // 2. Update feedback score and count
  const { error } = await client
    .from("lite_content_progress")
    .update({ 
      last_feedback_score: score,
      completed_cards_count: new_count,
      updated_at: new Date().toISOString()
    })
    .match({ sns_type, sns_id, learning_product_id });

  if (error) throw error;
};

/**
 * Update the delivery status after a successful SNS push.
 */
export const markLiteDeliveryAsSent = async (
  client: SupabaseClient<Database>,
  delivery_id: string
) => {
  const { error } = await client
    .from("lite_card_deliveries")
    .update({ 
      status: "sent",
      sent_at: new Date().toISOString()
    })
    .eq("delivery_id", delivery_id);

  if (error) throw error;
};

/**
 * Fetch a batch of pending deliveries that are scheduled for now or in the past.
 * Joins with 'learning_card' to get the content payload (card_data).
 */
export const getLitePendingDeliveries = async (
  client: SupabaseClient<Database>,
  limit: number = 50
) => {
  const now = new Date().toISOString();

  const { data, error } = await client
    .from("lite_card_deliveries")
    .select(`
      delivery_id,
      sns_type,
      sns_id,
      learning_product_id,
      card_id,
      scheduled_at,
      learning_card ( id, card_data )
    `)
    .eq("status", "pending")
    .lte("scheduled_at", now) // Filter for items ready to be sent
    .order("scheduled_at", { ascending: true }) // Process oldest first (FIFO)
    .limit(limit);

  if (error) throw error;
  return data;
};

/**
 * Mark a delivery as failed and record the error message.
 * Increments retry_count for the next retry attempt.
 */
export const markLiteDeliveryAsFailed = async (
  client: SupabaseClient<Database>,
  { delivery_id, error_message }: { delivery_id: string; error_message: string }
) => {
  // 1. Get current retry count
  const { data: current } = await client
    .from("lite_card_deliveries")
    .select("retry_count")
    .eq("delivery_id", delivery_id)
    .single();

  const new_retry_count = (current?.retry_count || 0) + 1;
  
  // 2. Set next retry time (e.g., current time + 15 minutes for basic backoff)
  const next_retry = new Date();
  next_retry.setMinutes(next_retry.getMinutes() + 15);

  const { error } = await client
    .from("lite_card_deliveries")
    .update({ 
      status: "retry_required", // Status from constants
      last_error: error_message,
      retry_count: new_retry_count,
      next_retry_at: next_retry.toISOString()
    })
    .eq("delivery_id", delivery_id);

  if (error) throw error;
};